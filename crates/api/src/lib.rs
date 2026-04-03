use axum::{
    extract::State,
    http::{header, HeaderValue, Method, Request, StatusCode},
    middleware::{self, Next},
    response::Response,
    routing::{get, post, put},
    Router,
};
use sqlx::PgPool;
use std::sync::Arc;
use tower_governor::{
    governor::GovernorConfigBuilder, key_extractor::PeerIpKeyExtractor, GovernorLayer,
};
use tower_http::cors::CorsLayer;

pub mod auth;
mod routes;

// ── Shared application state ──
//
// `FromRef` lets Axum extract sub-states automatically, so existing handlers
// that declare `State<PgPool>` continue to work without modification.

#[derive(Debug, Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub jwt_secret: String,
    /// "local" | "staging" | "production"
    pub app_env: String,
}

impl axum::extract::FromRef<AppState> for PgPool {
    fn from_ref(state: &AppState) -> Self {
        state.pool.clone()
    }
}

/// Newtype wrapper to avoid a blanket `FromRef<AppState> for String` impl
/// which could collide with other string-typed state fields.
#[derive(Debug, Clone)]
pub struct JwtSecret(pub String);

impl axum::extract::FromRef<AppState> for JwtSecret {
    fn from_ref(state: &AppState) -> Self {
        JwtSecret(state.jwt_secret.clone())
    }
}

pub fn build_app(pool: PgPool, jwt_secret: String) -> Router {
    build_app_with_env(
        pool,
        jwt_secret,
        std::env::var("APP_ENV").unwrap_or_else(|_| "local".to_string()),
    )
}

pub fn build_app_with_env(pool: PgPool, jwt_secret: String, app_env: String) -> Router {
    let state = AppState {
        pool,
        jwt_secret,
        app_env,
    };

    // ── Rate limiter configs ──
    //
    // GovernorConfigBuilder uses a token-bucket model:
    //   per_second(N)      — replenish 1 token every N seconds
    //   per_millisecond(N) — replenish 1 token every N milliseconds
    //   burst_size(B)      — max burst allowed before throttling kicks in
    //
    // Auth endpoints:   5 req/min  → replenish every 12 s, burst 5
    // Admin endpoints: 30 req/min  → replenish every  2 s, burst 30
    // General API:    100 req/min  → replenish every 600 ms, burst 100

    let auth_governor_conf = std::sync::Arc::new(
        GovernorConfigBuilder::default()
            .per_second(12)
            .burst_size(5)
            .key_extractor(PeerIpKeyExtractor)
            .finish()
            .expect("auth rate-limiter config"),
    );

    let admin_governor_conf = std::sync::Arc::new(
        GovernorConfigBuilder::default()
            .per_second(2)
            .burst_size(30)
            .key_extractor(PeerIpKeyExtractor)
            .finish()
            .expect("admin rate-limiter config"),
    );

    let api_governor_conf = std::sync::Arc::new(
        GovernorConfigBuilder::default()
            .per_millisecond(600)
            .burst_size(100)
            .key_extractor(PeerIpKeyExtractor)
            .finish()
            .expect("api rate-limiter config"),
    );

    // ── Auth routes: strict limit (5/min per IP) ──
    let auth_routes = Router::new()
        .route("/api/v1/auth/kakao", post(routes::auth::kakao_login))
        .route(
            "/api/v1/auth/kakao/callback",
            get(routes::auth::kakao_callback),
        )
        .route("/api/v1/auth/refresh", post(routes::auth::refresh))
        .layer(GovernorLayer::new(Arc::clone(&auth_governor_conf)));

    // ── Admin routes: moderate limit (30/min per IP) + JWT auth ──
    // Role enforcement (admin-only) is done inside each handler via AdminUser extractor.
    let admin_routes = Router::new()
        .route(
            "/api/v1/admin/programs",
            get(routes::admin::list_admin_programs),
        )
        .route(
            "/api/v1/admin/programs",
            post(routes::admin::create_program),
        )
        .route(
            "/api/v1/admin/programs/{id}",
            put(routes::admin::update_program),
        )
        .route(
            "/api/v1/admin/programs/{id}/publish",
            post(routes::admin::toggle_publish),
        )
        .route("/api/v1/admin/stats", get(routes::admin::get_stats))
        .route("/api/v1/admin/sync", post(routes::admin::trigger_sync))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ))
        .layer(GovernorLayer::new(Arc::clone(&admin_governor_conf)));

    // ── General public routes: relaxed limit (100/min per IP) ──
    let public_routes = Router::new()
        .route("/health", get(routes::health::health))
        .route("/api/v1/health", get(routes::health::health_detail))
        .route("/api/v1/programs", get(routes::programs::list_programs))
        .route("/api/v1/programs/{id}", get(routes::programs::get_program))
        .route(
            "/api/v1/recommend/preview",
            post(routes::recommend::preview),
        )
        .layer(GovernorLayer::new(Arc::clone(&api_governor_conf)));

    // ── Protected routes: general limit (100/min per IP) + JWT auth ──
    let protected_routes = Router::new()
        .route("/api/v1/auth/me", get(routes::auth::me))
        .route(
            "/api/v1/push/register",
            post(routes::push::register_push_token).delete(routes::push::unregister_push_token),
        )
        .route(
            "/api/v1/profile",
            post(routes::profile::save_profile).get(routes::profile::get_my_profile),
        )
        .route(
            "/api/v1/profile/{user_id}",
            get(routes::profile::get_profile),
        )
        .route(
            "/api/v1/programs/{program_id}/bookmark",
            post(routes::bookmark::toggle_bookmark),
        )
        .route(
            "/api/v1/programs/{program_id}/state",
            post(routes::state::upsert_state),
        )
        .route("/api/v1/dashboard", get(routes::dashboard::get_dashboard))
        .route("/api/v1/alerts", get(routes::alerts::list_alerts))
        .route(
            "/api/v1/alerts/preferences",
            post(routes::alerts::upsert_preferences),
        )
        .route(
            "/api/v1/alerts/notification-preferences",
            get(routes::alerts::get_notification_preferences),
        )
        .route(
            "/api/v1/alerts/notification-preferences",
            put(routes::alerts::update_notification_preferences),
        )
        .route("/api/v1/my/saved", get(routes::my::get_saved))
        .route(
            "/api/v1/my/applications",
            get(routes::state::list_applications),
        )
        .route(
            "/api/v1/my/applications/{program_id}",
            get(routes::state::get_application),
        )
        .route(
            "/api/v1/my/applications/{program_id}",
            put(routes::state::update_application),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ))
        .layer(GovernorLayer::new(Arc::clone(&api_governor_conf)));

    Router::new()
        .merge(auth_routes)
        .merge(admin_routes)
        .merge(public_routes)
        .merge(protected_routes)
        // Apply security headers to every response
        .layer(middleware::from_fn_with_state(
            state.clone(),
            security_headers_middleware,
        ))
        // Apply error sanitization to every response
        .layer(middleware::from_fn_with_state(
            state.clone(),
            error_sanitization_middleware,
        ))
        .layer(build_cors_layer())
        .with_state(state)
}

// ── CORS ──
//
// Allows requests from localhost:3000 (dev) and the production domain
// supplied via the DOMAIN environment variable.  Only the necessary
// HTTP methods and headers are permitted; credentials (cookies/tokens)
// may be sent from these origins.

fn build_cors_layer() -> CorsLayer {
    let mut origins: Vec<HeaderValue> = vec![
        "http://localhost:3000".parse().unwrap(),
        "http://127.0.0.1:3000".parse().unwrap(),
    ];

    if let Ok(domain) = std::env::var("DOMAIN") {
        // Only allow HTTPS for production domains
        let https = format!("https://{domain}");
        if let Ok(v) = https.parse() {
            origins.push(v);
        }
    }

    CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE])
        .allow_credentials(true)
}

// ── Auth middleware ──
//
// Validates the Bearer JWT and injects `AuthUser` into request extensions so
// that downstream handlers can optionally extract it via `Extension<AuthUser>`.

async fn auth_middleware(
    State(state): State<AppState>,
    mut req: axum::extract::Request,
    next: Next,
) -> Result<Response, (StatusCode, axum::Json<serde_json::Value>)> {
    use axum::http::StatusCode;
    use serde_json::json;

    let unauthorized = |msg: &str| {
        (
            StatusCode::UNAUTHORIZED,
            axum::Json(json!({ "error": msg })),
        )
    };

    let auth_header = req
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| unauthorized("Missing Authorization header"))?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or_else(|| unauthorized("Authorization header must use Bearer scheme"))?;

    let claims = auth::verify_token(token, &state.jwt_secret)
        .map_err(|_| unauthorized("Invalid or expired token"))?;

    if claims.token_type != "access" {
        return Err(unauthorized("Token type must be 'access'"));
    }

    let user_id =
        uuid::Uuid::parse_str(&claims.sub).map_err(|_| unauthorized("Malformed token subject"))?;

    let auth_user = auth::AuthUser {
        id: user_id,
        role: claims.role,
    };

    // RLS defense-in-depth note:
    // Primary access control is enforced at the application level via AuthUser
    // extractor — every handler uses auth_user.id from JWT, never client input.
    // RLS policies provide a secondary safety net. With connection pooling
    // (Supabase pooler), SET LOCAL is transaction-scoped and resets per query.
    // Handlers that need RLS should wrap their queries in a transaction and
    // call set_config within it. The GUC set here is best-effort for simple
    // single-query handlers.
    if let Err(e) = sqlx::query("SELECT set_config('app.current_user_id', $1, true)")
        .bind(auth_user.id.to_string())
        .execute(&state.pool)
        .await
    {
        tracing::warn!(
            user_id = %auth_user.id,
            error = %e,
            "Failed to set app.current_user_id; RLS will treat request as unauthenticated"
        );
    }

    // Make AuthUser available to handlers via request extensions
    req.extensions_mut().insert(auth_user);

    Ok(next.run(req).await)
}

// ── Security headers middleware ──
//
// Adds defensive HTTP headers to every outbound response:
//   - X-Content-Type-Options: nosniff       — prevents MIME-type sniffing
//   - X-Frame-Options: DENY                 — blocks clickjacking via iframes
//   - Strict-Transport-Security             — HSTS for HTTPS deployments
//   - X-Powered-By is removed if present    — hides implementation details

async fn security_headers_middleware(req: Request<axum::body::Body>, next: Next) -> Response {
    let mut response = next.run(req).await;
    let headers = response.headers_mut();

    headers.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    headers.insert("x-frame-options", HeaderValue::from_static("DENY"));
    // max-age=63072000 = 2 years; includeSubDomains covers all subdomains
    headers.insert(
        "strict-transport-security",
        HeaderValue::from_static("max-age=63072000; includeSubDomains"),
    );
    // Remove x-powered-by if any upstream layer added it
    headers.remove("x-powered-by");

    response
}

// ── Error sanitization middleware ──
//
// In non-local environments (APP_ENV != "local") this middleware rewrites
// 5xx JSON error bodies so that internal DB errors and stack traces are
// never sent to clients.  In "local" the full error is preserved for
// easier debugging.
//
// It works by inspecting the response status code; when it is a 5xx the
// body is replaced with a generic message.  4xx errors (auth failures,
// validation errors, not-found) are passed through unchanged.

async fn error_sanitization_middleware(
    State(state): State<AppState>,
    req: Request<axum::body::Body>,
    next: Next,
) -> Response {
    use axum::body::Body;

    let response = next.run(req).await;

    // Local dev: preserve full error details
    if state.app_env == "local" {
        return response;
    }

    let status = response.status();

    // Only sanitize 5xx responses
    if !status.is_server_error() {
        return response;
    }

    // Log the full error server-side before replacing it
    tracing::error!(
        status = status.as_u16(),
        "Internal server error (body redacted in response)"
    );

    // Replace body with a generic message; do not leak DB errors or traces
    let generic_body = serde_json::json!({
        "error": "An internal server error occurred. Please try again later."
    })
    .to_string();

    Response::builder()
        .status(status)
        .header("content-type", "application/json")
        .body(Body::from(generic_body))
        .unwrap_or_else(|_| {
            Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(Body::empty())
                .unwrap()
        })
}
