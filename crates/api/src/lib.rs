use axum::{
    extract::State,
    middleware,
    routing::{get, post, put},
    Router,
};
use sqlx::PgPool;
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
}

impl axum::extract::FromRef<AppState> for PgPool {
    fn from_ref(state: &AppState) -> Self {
        state.pool.clone()
    }
}

impl axum::extract::FromRef<AppState> for String {
    fn from_ref(state: &AppState) -> Self {
        state.jwt_secret.clone()
    }
}

pub fn build_app(pool: PgPool, jwt_secret: String) -> Router {
    let state = AppState { pool, jwt_secret };

    // ── Public routes (no auth required) ──
    let public = Router::new()
        .route("/health", get(routes::health::health))
        .route("/api/v1/health", get(routes::health::health_detail))
        // Auth
        .route("/api/v1/auth/kakao", post(routes::auth::kakao_login))
        // Programs (read-only, public)
        .route("/api/v1/programs", get(routes::programs::list_programs))
        .route("/api/v1/programs/{id}", get(routes::programs::get_program))
        // Recommend preview (no account needed)
        .route("/api/v1/recommend/preview", post(routes::recommend::preview));

    // ── Protected routes (require valid JWT) ──
    let protected = Router::new()
        // Profile
        .route("/api/v1/profile", post(routes::profile::save_profile))
        .route("/api/v1/profile/{user_id}", get(routes::profile::get_profile))
        // Bookmark
        .route(
            "/api/v1/programs/{program_id}/bookmark",
            post(routes::bookmark::toggle_bookmark),
        )
        // Program state
        .route(
            "/api/v1/programs/{program_id}/state",
            post(routes::state::upsert_state),
        )
        // Dashboard
        .route("/api/v1/dashboard", get(routes::dashboard::get_dashboard))
        // Alerts
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
        // My
        .route("/api/v1/my/saved", get(routes::my::get_saved))
        .route("/api/v1/my/applications", get(routes::state::list_applications))
        .route(
            "/api/v1/my/applications/{program_id}",
            get(routes::state::get_application),
        )
        .route(
            "/api/v1/my/applications/{program_id}",
            put(routes::state::update_application),
        )
        // Admin
        .route("/api/v1/admin/programs", get(routes::admin::list_admin_programs))
        .route("/api/v1/admin/programs", post(routes::admin::create_program))
        .route("/api/v1/admin/programs/{id}", put(routes::admin::update_program))
        .route(
            "/api/v1/admin/programs/{id}/publish",
            post(routes::admin::toggle_publish),
        )
        .route("/api/v1/admin/stats", get(routes::admin::get_stats))
        .route("/api/v1/admin/sync", post(routes::admin::trigger_sync))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ));

    Router::new()
        .merge(public)
        .merge(protected)
        .layer(CorsLayer::permissive())
        .with_state(state)
}

// ── Auth middleware ──
//
// Validates the Bearer JWT and injects `AuthUser` into request extensions so
// that downstream handlers can optionally extract it via `Extension<AuthUser>`.

async fn auth_middleware(
    State(state): State<AppState>,
    mut req: axum::extract::Request,
    next: middleware::Next,
) -> Result<axum::response::Response, (axum::http::StatusCode, axum::Json<serde_json::Value>)> {
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

    let user_id = uuid::Uuid::parse_str(&claims.sub)
        .map_err(|_| unauthorized("Malformed token subject"))?;

    let auth_user = auth::AuthUser {
        id: user_id,
        role: claims.role,
    };

    // Make AuthUser available to handlers via request extensions
    req.extensions_mut().insert(auth_user);

    Ok(next.run(req).await)
}
