use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;
use majimi_core::models::Program;

#[derive(Debug, Deserialize)]
pub struct DashboardQuery {
    pub user_id: Uuid,
}

/// GET /api/v1/dashboard?user_id=UUID
pub async fn get_dashboard(
    State(pool): State<PgPool>,
    Query(q): Query<DashboardQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let db_err = |e: sqlx::Error| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("DB error: {e}") })),
        )
    };

    // Bookmarked count
    let bookmarked_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM user_bookmarks WHERE user_id = $1",
    )
    .bind(q.user_id)
    .fetch_one(&pool)
    .await
    .map_err(db_err)?;

    // Applying count (states: applying, applied, waiting)
    let applying_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM user_program_states WHERE user_id = $1 AND state IN ('applying','applied','waiting')",
    )
    .bind(q.user_id)
    .fetch_one(&pool)
    .await
    .map_err(db_err)?;

    // Top 5 upcoming deadlines from bookmarked programs
    let upcoming_deadlines = sqlx::query_as::<_, Program>(
        r#"
        SELECT p.* FROM programs p
        INNER JOIN user_bookmarks ub ON ub.program_id = p.id
        WHERE ub.user_id = $1
          AND p.deadline_at IS NOT NULL
          AND p.deadline_at > now()
        ORDER BY p.deadline_at ASC
        LIMIT 5
        "#,
    )
    .bind(q.user_id)
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;

    // Estimated monthly and semester from bookmarked active programs
    let (estimated_monthly, estimated_semester): (i64, i64) = sqlx::query_as(
        r#"
        SELECT
            COALESCE(SUM(p.benefit_amount_monthly), 0)::BIGINT,
            COALESCE(SUM(p.benefit_amount_semester), 0)::BIGINT
        FROM programs p
        INNER JOIN user_bookmarks ub ON ub.program_id = p.id
        WHERE ub.user_id = $1 AND p.is_active = true
        "#,
    )
    .bind(q.user_id)
    .fetch_one(&pool)
    .await
    .map_err(db_err)?;

    // Todo items: check for missing profile fields
    let todo_items = build_todo_items(&pool, q.user_id).await.map_err(db_err)?;

    Ok(Json(json!({
        "bookmarked_count": bookmarked_count,
        "applying_count": applying_count,
        "upcoming_deadlines": upcoming_deadlines,
        "estimated_monthly": estimated_monthly,
        "estimated_semester": estimated_semester,
        "todo_items": todo_items
    })))
}

async fn build_todo_items(pool: &PgPool, user_id: Uuid) -> Result<Vec<String>, sqlx::Error> {
    let row: Option<(Option<i32>, Option<String>)> = sqlx::query_as(
        "SELECT income_bracket, enrollment_status FROM user_profiles WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    let mut todos = Vec::new();
    match row {
        None => {
            todos.push("프로필을 입력해주세요".to_string());
        }
        Some((income_bracket, enrollment_status)) => {
            if income_bracket.is_none() {
                todos.push("소득구간 입력하기".to_string());
            }
            if enrollment_status.as_deref().unwrap_or("").is_empty() {
                todos.push("재학증명서 준비하기".to_string());
            }
        }
    }
    Ok(todos)
}
