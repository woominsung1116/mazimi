use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct BookmarkRequest {
    pub user_id: Uuid,
}

/// POST /api/v1/programs/{program_id}/bookmark
/// Toggle bookmark: insert if not exists, delete if exists.
pub async fn toggle_bookmark(
    State(pool): State<PgPool>,
    Path(program_id): Path<Uuid>,
    Json(payload): Json<BookmarkRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let existing = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM user_bookmarks WHERE user_id = $1 AND program_id = $2",
    )
    .bind(payload.user_id)
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
            .bind(payload.user_id)
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
        .bind(payload.user_id)
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
