use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    Json,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::AppState;

// ── Token lifetime: 30 days ──
const TOKEN_EXPIRY_SECS: usize = 30 * 24 * 60 * 60;

// ── Claims stored inside the JWT ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    /// Subject: stringified user UUID
    pub sub: String,
    pub role: String,
    /// Expiry (Unix timestamp)
    pub exp: usize,
    /// Issued-at (Unix timestamp)
    pub iat: usize,
}

// ── Extracted identity available to handlers ──

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: Uuid,
    pub role: String,
}

// ── Token helpers ──

pub fn create_token(user_id: Uuid, role: &str, secret: &str) -> anyhow::Result<String> {
    let now = chrono::Utc::now().timestamp() as usize;
    let claims = Claims {
        sub: user_id.to_string(),
        role: role.to_string(),
        iat: now,
        exp: now + TOKEN_EXPIRY_SECS,
    };
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )?;
    Ok(token)
}

pub fn verify_token(token: &str, secret: &str) -> anyhow::Result<Claims> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(data.claims)
}

// ── Axum extractor: reads Bearer token from Authorization header ──
//
// Axum 0.8 supports `async fn` directly in `impl FromRequestParts` without
// the `#[async_trait]` macro.

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = (StatusCode, Json<serde_json::Value>);

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let unauthorized = |msg: &str| {
            (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": msg })),
            )
        };

        let auth_header = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| unauthorized("Missing Authorization header"))?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or_else(|| unauthorized("Authorization header must use Bearer scheme"))?;

        let claims = verify_token(token, &state.jwt_secret)
            .map_err(|_| unauthorized("Invalid or expired token"))?;

        let user_id = Uuid::parse_str(&claims.sub)
            .map_err(|_| unauthorized("Malformed token subject"))?;

        Ok(AuthUser {
            id: user_id,
            role: claims.role,
        })
    }
}
