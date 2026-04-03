use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Redirect,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    auth::{create_refresh_token, create_token, verify_token, AuthUser},
    AppState,
};

// ── Request / Response types ──

#[derive(Debug, Deserialize)]
pub struct KakaoLoginRequest {
    pub access_token: String,
}

// ── Kakao API response shape (minimum fields we need) ──

#[derive(Debug, serde::Deserialize)]
struct KakaoUserMe {
    id: i64,
    kakao_account: Option<KakaoAccount>,
}

#[derive(Debug, serde::Deserialize)]
struct KakaoAccount {
    profile: Option<KakaoProfile>,
}

#[derive(Debug, serde::Deserialize)]
struct KakaoProfile {
    nickname: Option<String>,
    profile_image_url: Option<String>,
}

// ── Handler ──

/// POST /api/v1/auth/kakao
///
/// Accepts a Kakao access token, verifies it against the Kakao API,
/// upserts the user row, and returns a signed JWT.
pub async fn kakao_login(
    State(state): State<AppState>,
    Json(body): Json<KakaoLoginRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let err_internal = |msg: String| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": msg })),
        )
    };
    let err_unauth = |msg: &str| (StatusCode::UNAUTHORIZED, Json(json!({ "error": msg })));

    // 1. Verify the Kakao access token by calling Kakao's user/me endpoint
    let kakao_resp = reqwest::Client::new()
        .get("https://kapi.kakao.com/v2/user/me")
        .bearer_auth(&body.access_token)
        .send()
        .await
        .map_err(|e| {
            tracing::error!("Kakao API request failed: {e}");
            err_internal("인증 처리 중 오류가 발생했습니다".to_string())
        })?;

    if !kakao_resp.status().is_success() {
        return Err(err_unauth("Invalid Kakao access token"));
    }

    let kakao_user: KakaoUserMe = kakao_resp.json().await.map_err(|e| {
        tracing::error!("Failed to parse Kakao response: {e}");
        err_internal("인증 처리 중 오류가 발생했습니다".to_string())
    })?;

    let kakao_id = kakao_user.id.to_string();

    let profile = kakao_user
        .kakao_account
        .as_ref()
        .and_then(|a| a.profile.as_ref());
    let nickname = profile.and_then(|p| p.nickname.clone());
    let image_url = profile.and_then(|p| p.profile_image_url.clone());

    // 2. Upsert user — match on (auth_provider, auth_provider_id)
    let user_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO users (auth_provider, auth_provider_id, role, created_at, updated_at)
        VALUES ('kakao', $1, 'user', now(), now())
        ON CONFLICT (auth_provider, auth_provider_id) DO UPDATE
            SET updated_at = now()
        RETURNING id
        "#,
    )
    .bind(&kakao_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB upsert failed: {e}");
        err_internal("인증 처리 중 오류가 발생했습니다".to_string())
    })?;

    // 3. Upsert nickname/image into user_profiles (only set if not already filled)
    let profile_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM user_profiles WHERE user_id = $1 AND birth_year IS NOT NULL)",
    )
    .bind(user_id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(false);

    if !profile_exists {
        sqlx::query(
            r#"
            INSERT INTO user_profiles (user_id, nickname, profile_image_url, updated_at)
            VALUES ($1, $2, $3, now())
            ON CONFLICT (user_id) DO NOTHING
            "#,
        )
        .bind(user_id)
        .bind(&nickname)
        .bind(&image_url)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Profile upsert failed: {e}");
            err_internal("인증 처리 중 오류가 발생했습니다".to_string())
        })?;
    }

    // 4. Sign access + refresh JWTs
    let access_token = create_token(user_id, "user", &state.jwt_secret).map_err(|e| {
        tracing::error!("Token creation failed: {e}");
        err_internal("인증 처리 중 오류가 발생했습니다".to_string())
    })?;
    let refresh_token = create_refresh_token(user_id, "user", &state.jwt_secret).map_err(|e| {
        tracing::error!("Refresh token creation failed: {e}");
        err_internal("인증 처리 중 오류가 발생했습니다".to_string())
    })?;

    Ok(Json(json!({
        "token": access_token,
        "refresh_token": refresh_token,
        "is_new_user": !profile_exists,
        "user": {
            "id": user_id,
            "nickname": nickname,
            "image": image_url
        }
    })))
}

/// GET /api/v1/auth/me
///
/// Returns the authenticated user's basic info. JWT is already verified by
/// the auth middleware; `AuthUser` is injected via request extensions.
pub async fn me(
    auth_user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let err_internal = |msg: String| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": msg })),
        )
    };
    let err_not_found = || {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "User not found" })),
        )
    };

    let row = sqlx::query_as::<
        _,
        (
            uuid::Uuid,
            Option<String>,
            String,
            Option<String>,
            Option<String>,
            bool,
        ),
    >(
        r#"
        SELECT u.id, u.email, u.role, up.nickname, up.profile_image_url,
               (up.birth_year IS NOT NULL) AS profile_complete
        FROM users u
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE u.id = $1
        "#,
    )
    .bind(auth_user.id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| err_internal(format!("DB query failed: {e}")))?
    .ok_or_else(err_not_found)?;

    Ok(Json(json!({
        "id":               row.0,
        "email":            row.1,
        "nickname":         row.3,
        "image":            row.4,
        "role":             row.2,
        "profile_complete": row.5,
    })))
}

// ── Refresh token ──

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

/// POST /api/v1/auth/refresh
///
/// Accepts a valid refresh token and returns a new access + refresh token pair.
/// The old refresh token is not revoked (stateless); it simply expires.
pub async fn refresh(
    State(state): State<AppState>,
    Json(body): Json<RefreshRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let err = |status: StatusCode, msg: &str| (status, Json(json!({ "error": msg })));

    let claims = verify_token(&body.refresh_token, &state.jwt_secret)
        .map_err(|_| err(StatusCode::UNAUTHORIZED, "Invalid or expired refresh token"))?;

    if claims.token_type != "refresh" {
        return Err(err(
            StatusCode::UNAUTHORIZED,
            "Token is not a refresh token",
        ));
    }

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| err(StatusCode::UNAUTHORIZED, "Malformed token subject"))?;

    // Re-fetch the current role from DB instead of trusting the old token's role
    let (role,): (String,) = sqlx::query_as("SELECT role FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?;

    let access_token = create_token(user_id, &role, &state.jwt_secret)
        .map_err(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "Token creation failed"))?;
    let new_refresh = create_refresh_token(user_id, &role, &state.jwt_secret)
        .map_err(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "Token creation failed"))?;

    Ok(Json(json!({
        "token": access_token,
        "refresh_token": new_refresh
    })))
}

// ── Server-side Kakao OAuth callback ──
//
// Flow: Mobile app opens browser → Kakao login → Kakao redirects here with code
// → backend exchanges code for Kakao token → upserts user → generates JWT
// → redirects to mazimi:// deep link with tokens

#[derive(Debug, Deserialize)]
pub struct KakaoCallbackQuery {
    pub code: String,
    /// The original redirect_uri the client sent to Kakao.
    /// If present, reuse it for the token exchange so the URIs always match.
    pub redirect_uri: Option<String>,
}

/// GET /api/v1/auth/kakao/callback?code=xxx
///
/// Server-side OAuth callback. Exchanges the Kakao auth code for tokens,
/// then redirects to the app via deep link.
pub async fn kakao_callback(
    State(state): State<AppState>,
    Query(query): Query<KakaoCallbackQuery>,
) -> Result<Redirect, (StatusCode, Json<Value>)> {
    let err_internal = |msg: String| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": msg })),
        )
    };

    let kakao_client_id = std::env::var("KAKAO_CLIENT_ID").unwrap_or_default();
    let kakao_client_secret = std::env::var("KAKAO_CLIENT_SECRET").unwrap_or_default();

    // Use the redirect_uri the client originally sent to Kakao so the URIs
    // always match, regardless of which IP/hostname was used.  Falls back to
    // CALLBACK_HOST env var → request Host header → localhost.
    //
    // Security: validate the host against an allowlist to prevent open redirect.
    let app_port = std::env::var("APP_PORT").unwrap_or_else(|_| "8080".to_string());
    let callback_host = std::env::var("CALLBACK_HOST").unwrap_or_else(|_| "localhost".to_string());
    let default_uri = format!(
        "http://{}:{}/api/v1/auth/kakao/callback",
        callback_host, app_port
    );

    let callback_uri = if let Some(ref uri) = query.redirect_uri {
        // Validate host against allowlist
        let after_scheme = uri.split_once("://").map(|(_, rest)| rest).unwrap_or("");
        let host_port = after_scheme.split('/').next().unwrap_or("");
        let host_part = host_port.split(':').next().unwrap_or("");
        let allowed = host_part == "localhost"
            || host_part == "127.0.0.1"
            || host_part == callback_host.as_str();
        if allowed {
            uri.clone()
        } else {
            tracing::warn!(
                "redirect_uri host '{}' not in allowlist, falling back to default",
                host_part
            );
            default_uri
        }
    } else {
        default_uri
    };

    // 1. Exchange authorization code for Kakao access token
    let token_resp = reqwest::Client::new()
        .post("https://kauth.kakao.com/oauth/token")
        .form(&[
            ("grant_type", "authorization_code"),
            ("client_id", &kakao_client_id),
            ("client_secret", &kakao_client_secret),
            ("redirect_uri", &callback_uri),
            ("code", &query.code),
        ])
        .send()
        .await
        .map_err(|e| {
            tracing::error!("Kakao token request failed: {e}");
            err_internal("인증 처리 중 오류가 발생했습니다".to_string())
        })?;

    let token_data: serde_json::Value = token_resp.json().await.map_err(|e| {
        tracing::error!("Kakao token parse failed: {e}");
        err_internal("인증 처리 중 오류가 발생했습니다".to_string())
    })?;

    tracing::info!("Kakao token exchange completed — callback_uri={callback_uri}");

    let kakao_access_token = token_data["access_token"].as_str().ok_or_else(|| {
        tracing::error!("No access_token in Kakao response: {token_data}");
        err_internal("인증 처리 중 오류가 발생했습니다".to_string())
    })?;

    // 2. Get user info from Kakao
    let kakao_resp = reqwest::Client::new()
        .get("https://kapi.kakao.com/v2/user/me")
        .bearer_auth(kakao_access_token)
        .send()
        .await
        .map_err(|e| {
            tracing::error!("Kakao user API failed: {e}");
            err_internal("인증 처리 중 오류가 발생했습니다".to_string())
        })?;

    let kakao_user: KakaoUserMe = kakao_resp.json().await.map_err(|e| {
        tracing::error!("Kakao user parse failed: {e}");
        err_internal("인증 처리 중 오류가 발생했습니다".to_string())
    })?;

    let kakao_id = kakao_user.id.to_string();
    let profile = kakao_user
        .kakao_account
        .as_ref()
        .and_then(|a| a.profile.as_ref());
    let nickname = profile.and_then(|p| p.nickname.clone()).unwrap_or_default();
    let image_url = profile
        .and_then(|p| p.profile_image_url.clone())
        .unwrap_or_default();

    // 3. Upsert user
    let user_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO users (auth_provider, auth_provider_id, role, created_at, updated_at)
        VALUES ('kakao', $1, 'user', now(), now())
        ON CONFLICT (auth_provider, auth_provider_id) DO UPDATE
            SET updated_at = now()
        RETURNING id
        "#,
    )
    .bind(&kakao_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB upsert failed: {e}");
        err_internal("인증 처리 중 오류가 발생했습니다".to_string())
    })?;

    // 3b. Upsert nickname/image into user_profiles for new users
    let profile_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM user_profiles WHERE user_id = $1 AND birth_year IS NOT NULL)",
    )
    .bind(user_id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(false);

    sqlx::query(
        r#"
        INSERT INTO user_profiles (user_id, nickname, profile_image_url, updated_at)
        VALUES ($1, $2, $3, now())
        ON CONFLICT (user_id) DO UPDATE SET
            nickname = COALESCE(user_profiles.nickname, EXCLUDED.nickname),
            profile_image_url = COALESCE(user_profiles.profile_image_url, EXCLUDED.profile_image_url),
            updated_at = now()
        "#,
    )
    .bind(user_id)
    .bind(&nickname)
    .bind(&image_url)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Profile upsert failed: {e}");
        err_internal("인증 처리 중 오류가 발생했습니다".to_string())
    })?;

    // 4. Generate JWTs
    let access_token = create_token(user_id, "user", &state.jwt_secret).map_err(|e| {
        tracing::error!("Token creation failed: {e}");
        err_internal("인증 처리 중 오류가 발생했습니다".to_string())
    })?;
    let refresh_token = create_refresh_token(user_id, "user", &state.jwt_secret).map_err(|e| {
        tracing::error!("Refresh token creation failed: {e}");
        err_internal("인증 처리 중 오류가 발생했습니다".to_string())
    })?;

    // 5. Redirect to app deep link with tokens
    let is_new = if profile_exists { "0" } else { "1" };
    let deep_link = format!(
        "mazimi://login?token={}&refresh_token={}&nickname={}&image={}&is_new={}",
        urlencoding::encode(&access_token),
        urlencoding::encode(&refresh_token),
        urlencoding::encode(&nickname),
        urlencoding::encode(&image_url),
        is_new,
    );

    Ok(Redirect::temporary(&deep_link))
}
