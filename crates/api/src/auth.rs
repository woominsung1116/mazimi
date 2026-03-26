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

// ── Token lifetimes ──
//
// Access token: short-lived (30 minutes) — used for API authentication.
// Refresh token: long-lived (30 days) — used to obtain new access tokens
// without re-authenticating via Kakao.
const ACCESS_TOKEN_EXPIRY_SECS: usize = 30 * 60; // 1800 seconds
const REFRESH_TOKEN_EXPIRY_SECS: usize = 30 * 24 * 60 * 60; // 2592000 seconds

// ── Claims stored inside the JWT ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    /// Subject: stringified user UUID
    pub sub: String,
    pub role: String,
    /// Token type: "access" or "refresh"
    #[serde(default = "default_token_type")]
    pub token_type: String,
    /// Expiry (Unix timestamp)
    pub exp: usize,
    /// Issued-at (Unix timestamp)
    pub iat: usize,
}

fn default_token_type() -> String {
    "access".to_string()
}

// ── Extracted identity available to handlers ──

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: Uuid,
    pub role: String,
}

// ── AdminUser extractor — rejects non-admin callers with 403 ──
//
// Add `admin: AdminUser` to any handler signature to enforce role=admin.
// The middleware has already injected AuthUser into extensions; this extractor
// simply reads it and checks the role, returning 403 Forbidden if the role is
// anything other than "admin".

#[derive(Debug, Clone)]
pub struct AdminUser(pub AuthUser);

impl FromRequestParts<AppState> for AdminUser {
    type Rejection = (StatusCode, Json<serde_json::Value>);

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let auth_user = AuthUser::from_request_parts(parts, state).await?;

        if auth_user.role != "admin" {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({ "error": "Forbidden: admin access required" })),
            ));
        }

        Ok(AdminUser(auth_user))
    }
}

// ── Token helpers ──

/// Create a short-lived access token (30 min).
pub fn create_token(user_id: Uuid, role: &str, secret: &str) -> anyhow::Result<String> {
    create_token_with_type(user_id, role, secret, "access", ACCESS_TOKEN_EXPIRY_SECS)
}

/// Create a long-lived refresh token (30 days).
pub fn create_refresh_token(user_id: Uuid, role: &str, secret: &str) -> anyhow::Result<String> {
    create_token_with_type(user_id, role, secret, "refresh", REFRESH_TOKEN_EXPIRY_SECS)
}

fn create_token_with_type(
    user_id: Uuid,
    role: &str,
    secret: &str,
    token_type: &str,
    expiry_secs: usize,
) -> anyhow::Result<String> {
    let now = chrono::Utc::now().timestamp() as usize;
    let claims = Claims {
        sub: user_id.to_string(),
        role: role.to_string(),
        token_type: token_type.to_string(),
        iat: now,
        exp: now + expiry_secs,
    };
    let token = encode(
        &Header::new(jsonwebtoken::Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )?;
    Ok(token)
}

pub fn verify_token(token: &str, secret: &str) -> anyhow::Result<Claims> {
    let validation = Validation::new(jsonwebtoken::Algorithm::HS256);
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
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

        if claims.token_type != "access" {
            return Err(unauthorized("Token type must be 'access'"));
        }

        let user_id = Uuid::parse_str(&claims.sub)
            .map_err(|_| unauthorized("Malformed token subject"))?;

        Ok(AuthUser {
            id: user_id,
            role: claims.role,
        })
    }
}
