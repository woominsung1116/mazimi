//! Shared error-response helpers.
//!
//! Handlers that hit an unexpected DB / internal failure should route the
//! error through [`internal_error`] instead of embedding the raw
//! `sqlx::Error` (or any other `Display`-able error) into the JSON body.
//! Raw DB errors can leak schema details, table/column names, constraint
//! names, and query fragments to the client — see CLAUDE.md security
//! checklist item #3 ("에러 메시지 숨기기").
//!
//! The real error is always logged server-side via `tracing::error!` so
//! nothing is lost for debugging; only the HTTP response is sanitized.
//!
//! This is defense-in-depth: `error_sanitization_middleware` in `lib.rs`
//! already rewrites any 5xx response body in non-local environments, but
//! handlers should not rely solely on that safety net — the generic
//! message should be the one actually constructed at the call site too.

use axum::{http::StatusCode, Json};
use serde_json::{json, Value};

/// Generic message returned to the client for any internal/DB failure.
/// Intentionally uninformative by design.
pub const GENERIC_ERROR_MESSAGE: &str = "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";

/// Build a `500 Internal Server Error` response from any displayable error
/// (typically `sqlx::Error`). Logs the full error server-side; the client
/// only ever receives [`GENERIC_ERROR_MESSAGE`].
///
/// Usage: `.map_err(crate::errors::internal_error)?`
pub fn internal_error(e: impl std::fmt::Display) -> (StatusCode, Json<Value>) {
    tracing::error!(error = %e, "internal server error");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": GENERIC_ERROR_MESSAGE })),
    )
}
