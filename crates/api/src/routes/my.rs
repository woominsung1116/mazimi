use crate::auth::AuthUser;
use axum::{extract::State, http::StatusCode, Json};
use mazimi_core::models::Program;
use serde_json::{json, Value};
use sqlx::PgPool;

/// GET /api/v1/my/saved
/// Returns bookmarked programs for the authenticated user (JWT-based).
pub async fn get_saved(
    auth_user: AuthUser,
    State(pool): State<PgPool>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let programs = sqlx::query_as::<_, Program>(
        r#"
        SELECT p.* FROM programs p
        INNER JOIN user_bookmarks ub ON ub.program_id = p.id
        WHERE ub.user_id = $1
        ORDER BY ub.created_at DESC
        "#,
    )
    .bind(auth_user.id)
    .fetch_all(&pool)
    .await
    .map_err(crate::errors::internal_error)?;

    Ok(Json(json!({
        "total": programs.len(),
        "items": programs
    })))
}
