use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;
use majimi_core::models::{Program, UserProgramState};

#[derive(Debug, Deserialize)]
pub struct UserQuery {
    pub user_id: Uuid,
}

/// GET /api/v1/my/saved?user_id=UUID
/// Returns bookmarked programs with full program data.
pub async fn get_saved(
    State(pool): State<PgPool>,
    Query(q): Query<UserQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let programs = sqlx::query_as::<_, Program>(
        r#"
        SELECT p.* FROM programs p
        INNER JOIN user_bookmarks ub ON ub.program_id = p.id
        WHERE ub.user_id = $1
        ORDER BY ub.created_at DESC
        "#,
    )
    .bind(q.user_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("DB error: {e}") })),
        )
    })?;

    Ok(Json(json!({
        "total": programs.len(),
        "items": programs
    })))
}

/// GET /api/v1/my/applications?user_id=UUID
/// Returns programs with user_program_states joined.
pub async fn get_applications(
    State(pool): State<PgPool>,
    Query(q): Query<UserQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let states = sqlx::query_as::<_, UserProgramState>(
        "SELECT * FROM user_program_states WHERE user_id = $1 ORDER BY updated_at DESC",
    )
    .bind(q.user_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("DB error: {e}") })),
        )
    })?;

    let program_ids: Vec<Uuid> = states.iter().map(|s| s.program_id).collect();

    let programs = if program_ids.is_empty() {
        vec![]
    } else {
        sqlx::query_as::<_, Program>(
            "SELECT * FROM programs WHERE id = ANY($1)",
        )
        .bind(&program_ids)
        .fetch_all(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("DB error: {e}") })),
            )
        })?
    };

    let items: Vec<Value> = states
        .iter()
        .map(|s| {
            let program = programs.iter().find(|p| p.id == s.program_id);
            json!({
                "state": s,
                "program": program
            })
        })
        .collect();

    Ok(Json(json!({
        "total": items.len(),
        "items": items
    })))
}
