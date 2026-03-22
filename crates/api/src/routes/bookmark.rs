use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::AuthUser;

/// POST /api/v1/programs/{program_id}/bookmark
/// Toggle bookmark: insert if not exists, delete if exists.
/// The authenticated user's ID is taken from the JWT — no client-supplied user_id accepted.
pub async fn toggle_bookmark(
    auth_user: AuthUser,
    State(pool): State<PgPool>,
    Path(program_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = auth_user.id;

    let existing = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM user_bookmarks WHERE user_id = $1 AND program_id = $2",
    )
    .bind(user_id)
    .bind(program_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("DB error: {e}") })),
        )
    })?;

    let bookmarked = if existing.is_some() {
        sqlx::query("DELETE FROM user_bookmarks WHERE user_id = $1 AND program_id = $2")
            .bind(user_id)
            .bind(program_id)
            .execute(&pool)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": format!("DB error: {e}") })),
                )
            })?;
        false
    } else {
        sqlx::query(
            "INSERT INTO user_bookmarks (user_id, program_id) VALUES ($1, $2)",
        )
        .bind(user_id)
        .bind(program_id)
        .execute(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("DB error: {e}") })),
            )
        })?;
        true
    };

    Ok(Json(json!({ "bookmarked": bookmarked })))
}
