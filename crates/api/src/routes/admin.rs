use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;
use majimi_core::models::Program;

use crate::auth::AdminUser;

/// POST /api/v1/admin/sync
pub async fn trigger_sync(
    _admin: AdminUser,
    State(pool): State<PgPool>,
) -> Json<Value> {
    tokio::spawn(async move {
        tracing::info!("manual sync triggered via admin API");

        match majimi_worker::sources::youth_center::YouthCenterSource::from_env() {
            Ok(src) => {
                if let Err(e) = majimi_worker::pipeline::run_ingestion(&pool, &src).await {
                    tracing::error!(source = "youth_center", error = %e, "ingestion failed");
                }
            }
            Err(e) => {
                tracing::warn!(source = "youth_center", error = %e, "source skipped (env not set)");
            }
        }

        match majimi_worker::sources::gov_benefits::GovBenefitsSource::from_env() {
            Ok(src) => {
                if let Err(e) = majimi_worker::pipeline::run_ingestion(&pool, &src).await {
                    tracing::error!(source = "gov_benefits", error = %e, "ingestion failed");
                }
            }
            Err(e) => {
                tracing::warn!(source = "gov_benefits", error = %e, "source skipped (env not set)");
            }
        }

        tracing::info!("manual sync complete");
    });

    Json(json!({
        "status": "sync_started",
        "message": "동기화 작업이 시작되었습니다"
    }))
}

#[derive(Debug, Deserialize)]
pub struct Pagination {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateProgramInput {
    pub program_type: String,
    pub source_type: Option<String>,
    pub title: String,
    pub summary: Option<String>,
    pub provider_name: Option<String>,
    pub official_url: Option<String>,
    pub program_status: Option<String>,
    pub application_start_at: Option<String>,
    pub application_end_at: Option<String>,
    pub benefit_amount_monthly: Option<i32>,
    pub benefit_amount_semester: Option<i32>,
    pub benefit_amount_once: Option<i32>,
    pub min_age: Option<i32>,
    pub max_age: Option<i32>,
    pub regions: Option<Vec<String>>,
    pub deadline_at: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct UpdateProgramInput {
    pub program_type: Option<String>,
    pub title: Option<String>,
    pub summary: Option<String>,
    pub provider_name: Option<String>,
    pub official_url: Option<String>,
    pub program_status: Option<String>,
    pub application_start_at: Option<String>,
    pub application_end_at: Option<String>,
    pub benefit_amount_monthly: Option<i32>,
    pub benefit_amount_semester: Option<i32>,
    pub benefit_amount_once: Option<i32>,
    pub min_age: Option<i32>,
    pub max_age: Option<i32>,
    pub regions: Option<Vec<String>>,
    pub deadline_at: Option<String>,
    pub is_active: Option<bool>,
}

/// GET /api/v1/admin/programs
pub async fn list_admin_programs(
    _admin: AdminUser,
    State(pool): State<PgPool>,
    Query(pagination): Query<Pagination>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let limit = pagination.limit.unwrap_or(50);
    let offset = pagination.offset.unwrap_or(0);

    let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM programs")
        .fetch_one(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("DB error: {e}") })),
            )
        })?;

    let programs = sqlx::query_as::<_, Program>(
        "SELECT * FROM programs ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("DB error: {e}") })),
        )
    })?;

    Ok(Json(json!({
        "total": total.0,
        "limit": limit,
        "offset": offset,
        "items": programs
    })))
}

/// POST /api/v1/admin/programs
pub async fn create_program(
    _admin: AdminUser,
    State(pool): State<PgPool>,
    Json(input): Json<CreateProgramInput>,
) -> Result<Json<Program>, (StatusCode, Json<Value>)> {
    let source_type = input.source_type.unwrap_or_else(|| "manual".to_string());
    let program_status = input.program_status.unwrap_or_else(|| "open".to_string());
    let is_active = input.is_active.unwrap_or(false);

    let application_start_at = input
        .application_start_at
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| chrono::DateTime::parse_from_rfc3339(s).ok().map(|d| d.with_timezone(&chrono::Utc)))
        .flatten();

    let application_end_at = input
        .application_end_at
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| chrono::DateTime::parse_from_rfc3339(s).ok().map(|d| d.with_timezone(&chrono::Utc)))
        .flatten();

    let deadline_at = input
        .deadline_at
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| chrono::DateTime::parse_from_rfc3339(s).ok().map(|d| d.with_timezone(&chrono::Utc)))
        .flatten();

    let program = sqlx::query_as::<_, Program>(
        r#"
        INSERT INTO programs (
            id, program_type, source_type, title, summary, provider_name,
            official_url, program_status, application_start_at, application_end_at,
            benefit_amount_monthly, benefit_amount_semester, benefit_amount_once,
            min_age, max_age, regions, deadline_at, is_active,
            created_at, updated_at
        ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9,
            $10, $11, $12, $13, $14, $15, $16, $17,
            NOW(), NOW()
        )
        RETURNING *
        "#,
    )
    .bind(&input.program_type)
    .bind(&source_type)
    .bind(&input.title)
    .bind(&input.summary)
    .bind(&input.provider_name)
    .bind(&input.official_url)
    .bind(&program_status)
    .bind(application_start_at)
    .bind(application_end_at)
    .bind(input.benefit_amount_monthly)
    .bind(input.benefit_amount_semester)
    .bind(input.benefit_amount_once)
    .bind(input.min_age)
    .bind(input.max_age)
    .bind(input.regions.as_deref())
    .bind(deadline_at)
    .bind(is_active)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("DB error: {e}") })),
        )
    })?;

    Ok(Json(program))
}

/// PUT /api/v1/admin/programs/{id}
pub async fn update_program(
    _admin: AdminUser,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateProgramInput>,
) -> Result<Json<Program>, (StatusCode, Json<Value>)> {
    let existing = sqlx::query_as::<_, Program>("SELECT * FROM programs WHERE id = $1")
        .bind(id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("DB error: {e}") })),
            )
        })?;

    let existing = match existing {
        Some(p) => p,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Program not found" })),
            ))
        }
    };

    let program_type = input.program_type.unwrap_or(existing.program_type);
    let title = input.title.unwrap_or(existing.title);
    let summary = input.summary.or(existing.summary);
    let provider_name = input.provider_name.or(existing.provider_name);
    let official_url = input.official_url.or(existing.official_url);
    let program_status = input.program_status.unwrap_or(existing.program_status);
    let benefit_amount_monthly = input.benefit_amount_monthly.or(existing.benefit_amount_monthly);
    let benefit_amount_semester = input.benefit_amount_semester.or(existing.benefit_amount_semester);
    let benefit_amount_once = input.benefit_amount_once.or(existing.benefit_amount_once);
    let min_age = input.min_age.or(existing.min_age);
    let max_age = input.max_age.or(existing.max_age);
    let regions = input.regions.or(existing.regions);
    let is_active = input.is_active.unwrap_or(existing.is_active);

    let application_start_at = input
        .application_start_at
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| chrono::DateTime::parse_from_rfc3339(s).ok().map(|d| d.with_timezone(&chrono::Utc)))
        .flatten()
        .or(existing.application_start_at);

    let application_end_at = input
        .application_end_at
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| chrono::DateTime::parse_from_rfc3339(s).ok().map(|d| d.with_timezone(&chrono::Utc)))
        .flatten()
        .or(existing.application_end_at);

    let deadline_at = input
        .deadline_at
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| chrono::DateTime::parse_from_rfc3339(s).ok().map(|d| d.with_timezone(&chrono::Utc)))
        .flatten()
        .or(existing.deadline_at);

    let program = sqlx::query_as::<_, Program>(
        r#"
        UPDATE programs SET
            program_type = $1, title = $2, summary = $3, provider_name = $4,
            official_url = $5, program_status = $6, application_start_at = $7,
            application_end_at = $8, benefit_amount_monthly = $9,
            benefit_amount_semester = $10, benefit_amount_once = $11,
            min_age = $12, max_age = $13, regions = $14, deadline_at = $15,
            is_active = $16, updated_at = NOW()
        WHERE id = $17
        RETURNING *
        "#,
    )
    .bind(&program_type)
    .bind(&title)
    .bind(&summary)
    .bind(&provider_name)
    .bind(&official_url)
    .bind(&program_status)
    .bind(application_start_at)
    .bind(application_end_at)
    .bind(benefit_amount_monthly)
    .bind(benefit_amount_semester)
    .bind(benefit_amount_once)
    .bind(min_age)
    .bind(max_age)
    .bind(regions.as_deref())
    .bind(deadline_at)
    .bind(is_active)
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("DB error: {e}") })),
        )
    })?;

    Ok(Json(program))
}

/// POST /api/v1/admin/programs/{id}/publish
pub async fn toggle_publish(
    _admin: AdminUser,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let program = sqlx::query_as::<_, Program>("SELECT * FROM programs WHERE id = $1")
        .bind(id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("DB error: {e}") })),
            )
        })?;

    let program = match program {
        Some(p) => p,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Program not found" })),
            ))
        }
    };

    let new_active = !program.is_active;

    sqlx::query("UPDATE programs SET is_active = $1, updated_at = NOW() WHERE id = $2")
        .bind(new_active)
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("DB error: {e}") })),
            )
        })?;

    Ok(Json(json!({
        "id": id,
        "is_active": new_active
    })))
}

/// GET /api/v1/admin/stats
pub async fn get_stats(
    _admin: AdminUser,
    State(pool): State<PgPool>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let total_programs: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM programs")
        .fetch_one(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("DB error: {e}") })),
            )
        })?;

    let active_programs: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM programs WHERE is_active = true")
            .fetch_one(&pool)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": format!("DB error: {e}") })),
                )
            })?;

    let total_users: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("DB error: {e}") })),
            )
        })?;

    Ok(Json(json!({
        "total_programs": total_programs.0,
        "active_programs": active_programs.0,
        "total_users": total_users.0
    })))
}
