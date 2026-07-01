use axum::{extract::State, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{auth::AuthUser, AppState};

// ── Request types ──

#[derive(Debug, Deserialize)]
pub struct RegisterPushTokenRequest {
    pub token: String,
    pub platform: String,
}

// ── Handlers ──

/// POST /api/v1/push/register
///
/// Upserts an Expo push token for the authenticated user/device pair.
/// The user's ID is taken from the JWT — no client-supplied user_id accepted.
/// Conflicts on `token` (unique) are resolved by updating `user_id`,
/// `platform`, and `updated_at` so a re-registered device stays current.
pub async fn register_push_token(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<RegisterPushTokenRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = auth_user.id;

    const VALID_PLATFORMS: &[&str] = &["ios", "android", "web"];
    if !VALID_PLATFORMS.contains(&body.platform.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid platform" })),
        ));
    }

    sqlx::query(
        r#"
        INSERT INTO push_tokens (user_id, token, platform, created_at, updated_at)
        VALUES ($1, $2, $3, now(), now())
        ON CONFLICT (token) DO UPDATE
            SET user_id    = EXCLUDED.user_id,
                platform   = EXCLUDED.platform,
                updated_at = now()
        "#,
    )
    .bind(user_id)
    .bind(&body.token)
    .bind(&body.platform)
    .execute(&state.pool)
    .await
    .map_err(crate::errors::internal_error)?;

    Ok(Json(json!({ "success": true })))
}

/// DELETE /api/v1/push/register
///
/// Removes all push tokens for the authenticated user.
/// The user's ID is taken from the JWT — no client-supplied user_id accepted.
pub async fn unregister_push_token(
    auth_user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = auth_user.id;

    sqlx::query("DELETE FROM push_tokens WHERE user_id = $1")
        .bind(user_id)
        .execute(&state.pool)
        .await
        .map_err(crate::errors::internal_error)?;

    Ok(Json(json!({ "success": true })))
}
