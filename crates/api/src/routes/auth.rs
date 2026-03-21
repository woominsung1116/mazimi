use axum::{extract::State, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{auth::create_token, AppState};

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
    let err_unauth = |msg: &str| {
        (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": msg })),
        )
    };

    // 1. Verify the Kakao access token by calling Kakao's user/me endpoint
    let kakao_resp = reqwest::Client::new()
        .get("https://kapi.kakao.com/v2/user/me")
        .bearer_auth(&body.access_token)
        .send()
        .await
        .map_err(|e| err_internal(format!("Kakao API request failed: {e}")))?;

    if !kakao_resp.status().is_success() {
        return Err(err_unauth("Invalid Kakao access token"));
    }

    let kakao_user: KakaoUserMe = kakao_resp
        .json()
        .await
        .map_err(|e| err_internal(format!("Failed to parse Kakao response: {e}")))?;

    let kakao_id = kakao_user.id.to_string();

    let profile = kakao_user
        .kakao_account
        .as_ref()
        .and_then(|a| a.profile.as_ref());
    let nickname = profile.and_then(|p| p.nickname.clone());
    let image_url = profile.and_then(|p| p.profile_image_url.clone());

    // 2. Upsert user — match on (auth_provider, auth_provider_id)
    //    Store nickname and image in a separate user_profiles row only when
    //    genuinely new; existing profile data is not overwritten here.
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
    .map_err(|e| err_internal(format!("DB upsert failed: {e}")))?;

    // 3. Sign JWT
    let token = create_token(user_id, "user", &state.jwt_secret)
        .map_err(|e| err_internal(format!("Token creation failed: {e}")))?;

    Ok(Json(json!({
        "token": token,
        "user": {
            "id": user_id,
            "nickname": nickname,
            "image": image_url
        }
    })))
}
