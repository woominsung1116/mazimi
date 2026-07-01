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
/// Toggle bookmark: delete if exists (atomic), insert if not.
/// The authenticated user's ID is taken from the JWT — no client-supplied user_id accepted.
pub async fn toggle_bookmark(
    auth_user: AuthUser,
    State(pool): State<PgPool>,
    Path(program_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = auth_user.id;

    // Attempt atomic delete — if the row existed, we get it back.
    let deleted = sqlx::query_scalar::<_, Uuid>(
        "DELETE FROM user_bookmarks WHERE user_id = $1 AND program_id = $2 RETURNING id",
    )
    .bind(user_id)
    .bind(program_id)
    .fetch_optional(&pool)
    .await
    .map_err(crate::errors::internal_error)?;

    if deleted.is_some() {
        // Was deleted (unbookmarked)
        Ok(Json(json!({ "bookmarked": false })))
    } else {
        // Didn't exist, so insert
        sqlx::query("INSERT INTO user_bookmarks (user_id, program_id) VALUES ($1, $2)")
            .bind(user_id)
            .bind(program_id)
            .execute(&pool)
            .await
            .map_err(crate::errors::internal_error)?;
        Ok(Json(json!({ "bookmarked": true })))
    }
}
