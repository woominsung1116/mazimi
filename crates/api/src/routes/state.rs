use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;
use majimi_core::models::UserProgramState;

const VALID_STATES: &[&str] = &[
    "interested",
    "planning",
    "applying",
    "applied",
    "waiting",
    "received",
    "abandoned",
];

// ── Request / response types ──

#[derive(Debug, Deserialize)]
pub struct UserQuery {
    pub user_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct UpsertStateRequest {
    pub user_id: Uuid,
    pub state: String,
    pub memo: Option<String>,
}

/// Body for PUT /api/v1/my/applications/{program_id}
#[derive(Debug, Deserialize)]
pub struct UpdateStatusRequest {
    pub status: String,
    pub memo: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct StateHistoryEntry {
    pub state: String,
    pub memo: Option<String>,
    pub changed_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct ApplicationDetail {
    pub program_id: Uuid,
    pub program_title: String,
    pub current_status: String,
    pub memo: Option<String>,
    pub applied_at: Option<DateTime<Utc>>,
    pub result_at: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
    pub history: Vec<StateHistoryEntry>,
}

// ── Helpers ──

fn invalid_state_error(state: &str) -> (StatusCode, Json<Value>) {
    (
        StatusCode::BAD_REQUEST,
        Json(json!({
            "error": format!(
                "Invalid status '{}'. Valid values: {}",
                state,
                VALID_STATES.join(", ")
            )
        })),
    )
}

fn db_error(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": format!("DB error: {e}") })),
    )
}

/// Fetch history rows for a (user, program) pair, newest first.
async fn fetch_history(
    pool: &PgPool,
    user_id: Uuid,
    program_id: Uuid,
) -> Result<Vec<StateHistoryEntry>, (StatusCode, Json<Value>)> {
    // Use a local tuple type to avoid a named struct dependency on sqlx::FromRow.
    let rows = sqlx::query_as::<_, (String, Option<String>, DateTime<Utc>)>(
        r#"
        SELECT state, memo, changed_at
        FROM   user_program_state_history
        WHERE  user_id = $1 AND program_id = $2
        ORDER  BY changed_at DESC
        "#,
    )
    .bind(user_id)
    .bind(program_id)
    .fetch_all(pool)
    .await
    .map_err(db_error)?;

    Ok(rows
        .into_iter()
        .map(|(state, memo, changed_at)| StateHistoryEntry {
            state,
            memo,
            changed_at,
        })
        .collect())
}

/// Append one row to the history table.
async fn record_history(
    pool: &PgPool,
    user_id: Uuid,
    program_id: Uuid,
    state: &str,
    memo: Option<&str>,
) -> Result<(), (StatusCode, Json<Value>)> {
    sqlx::query(
        r#"
        INSERT INTO user_program_state_history (user_id, program_id, state, memo)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(user_id)
    .bind(program_id)
    .bind(state)
    .bind(memo)
    .execute(pool)
    .await
    .map_err(db_error)?;
    Ok(())
}

// ── Handlers ──

/// POST /api/v1/programs/{program_id}/state
///
/// Upsert user program state (legacy endpoint, kept for backwards compatibility).
pub async fn upsert_state(
    State(pool): State<PgPool>,
    Path(program_id): Path<Uuid>,
    Json(payload): Json<UpsertStateRequest>,
) -> Result<Json<UserProgramState>, (StatusCode, Json<Value>)> {
    if !VALID_STATES.contains(&payload.state.as_str()) {
        return Err(invalid_state_error(&payload.state));
    }

    let record = sqlx::query_as::<_, UserProgramState>(
        r#"
        INSERT INTO user_program_states (user_id, program_id, state, memo, updated_at)
        VALUES ($1, $2, $3, $4, now())
        ON CONFLICT (user_id, program_id) DO UPDATE SET
            state      = EXCLUDED.state,
            memo       = EXCLUDED.memo,
            updated_at = now()
        RETURNING *
        "#,
    )
    .bind(payload.user_id)
    .bind(program_id)
    .bind(&payload.state)
    .bind(&payload.memo)
    .fetch_one(&pool)
    .await
    .map_err(db_error)?;

    record_history(
        &pool,
        payload.user_id,
        program_id,
        &payload.state,
        payload.memo.as_deref(),
    )
    .await?;

    Ok(Json(record))
}

/// GET /api/v1/my/applications?user_id=UUID
///
/// Returns all programs the user has a status for, with program title and
/// per-entry state-change history.
pub async fn list_applications(
    State(pool): State<PgPool>,
    Query(q): Query<UserQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // (program_id, program_title, state, memo, applied_at, result_at, updated_at)
    type AppRow = (
        Uuid,
        String,
        String,
        Option<String>,
        Option<DateTime<Utc>>,
        Option<DateTime<Utc>>,
        DateTime<Utc>,
    );

    let rows = sqlx::query_as::<_, AppRow>(
        r#"
        SELECT
            ups.program_id,
            p.title        AS program_title,
            ups.state,
            ups.memo,
            ups.applied_at,
            ups.result_at,
            ups.updated_at
        FROM   user_program_states ups
        JOIN   programs p ON p.id = ups.program_id
        WHERE  ups.user_id = $1
        ORDER  BY ups.updated_at DESC
        "#,
    )
    .bind(q.user_id)
    .fetch_all(&pool)
    .await
    .map_err(db_error)?;

    let mut items: Vec<ApplicationDetail> = Vec::with_capacity(rows.len());
    for (program_id, program_title, state, memo, applied_at, result_at, updated_at) in rows {
        let history = fetch_history(&pool, q.user_id, program_id).await?;
        items.push(ApplicationDetail {
            program_id,
            program_title,
            current_status: state,
            memo,
            applied_at,
            result_at,
            updated_at,
            history,
        });
    }

    Ok(Json(json!({
        "total": items.len(),
        "items": items,
    })))
}

/// GET /api/v1/my/applications/{program_id}?user_id=UUID
///
/// Returns status and full history for a single (user, program) pair.
pub async fn get_application(
    State(pool): State<PgPool>,
    Path(program_id): Path<Uuid>,
    Query(q): Query<UserQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // (program_title, state, memo, applied_at, result_at, updated_at)
    type AppRow = (
        String,
        String,
        Option<String>,
        Option<DateTime<Utc>>,
        Option<DateTime<Utc>>,
        DateTime<Utc>,
    );

    let row = sqlx::query_as::<_, AppRow>(
        r#"
        SELECT
            p.title        AS program_title,
            ups.state,
            ups.memo,
            ups.applied_at,
            ups.result_at,
            ups.updated_at
        FROM   user_program_states ups
        JOIN   programs p ON p.id = ups.program_id
        WHERE  ups.user_id = $1 AND ups.program_id = $2
        "#,
    )
    .bind(q.user_id)
    .bind(program_id)
    .fetch_optional(&pool)
    .await
    .map_err(db_error)?;

    let (program_title, state, memo, applied_at, result_at, updated_at) = match row {
        Some(r) => r,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Application status not found" })),
            ))
        }
    };

    let history = fetch_history(&pool, q.user_id, program_id).await?;

    let detail = ApplicationDetail {
        program_id,
        program_title,
        current_status: state,
        memo,
        applied_at,
        result_at,
        updated_at,
        history,
    };

    Ok(Json(json!(detail)))
}

/// PUT /api/v1/my/applications/{program_id}?user_id=UUID
///
/// Update the application status for one program.  Automatically sets
/// `applied_at` on first transition to "applied" and `result_at` on first
/// transition to "received" or "abandoned".  Every call appends a history row.
///
/// Body: `{ "status": "applying", "memo": "optional note" }`
pub async fn update_application(
    State(pool): State<PgPool>,
    Path(program_id): Path<Uuid>,
    Query(q): Query<UserQuery>,
    Json(payload): Json<UpdateStatusRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !VALID_STATES.contains(&payload.status.as_str()) {
        return Err(invalid_state_error(&payload.status));
    }

    // Choose the right upsert variant based on which timestamp column to set.
    // `COALESCE` ensures we never overwrite a timestamp that was already set.
    let upsert_sql = match payload.status.as_str() {
        "applied" => {
            r#"
            INSERT INTO user_program_states (user_id, program_id, state, memo, applied_at, updated_at)
            VALUES ($1, $2, $3, $4, now(), now())
            ON CONFLICT (user_id, program_id) DO UPDATE SET
                state      = EXCLUDED.state,
                memo       = EXCLUDED.memo,
                applied_at = COALESCE(user_program_states.applied_at, now()),
                updated_at = now()
            RETURNING state, memo, applied_at, result_at, updated_at
            "#
        }
        "received" | "abandoned" => {
            r#"
            INSERT INTO user_program_states (user_id, program_id, state, memo, result_at, updated_at)
            VALUES ($1, $2, $3, $4, now(), now())
            ON CONFLICT (user_id, program_id) DO UPDATE SET
                state     = EXCLUDED.state,
                memo      = EXCLUDED.memo,
                result_at = COALESCE(user_program_states.result_at, now()),
                updated_at = now()
            RETURNING state, memo, applied_at, result_at, updated_at
            "#
        }
        _ => {
            r#"
            INSERT INTO user_program_states (user_id, program_id, state, memo, updated_at)
            VALUES ($1, $2, $3, $4, now())
            ON CONFLICT (user_id, program_id) DO UPDATE SET
                state      = EXCLUDED.state,
                memo       = EXCLUDED.memo,
                updated_at = now()
            RETURNING state, memo, applied_at, result_at, updated_at
            "#
        }
    };

    // (state, memo, applied_at, result_at, updated_at)
    type UpsertRow = (
        String,
        Option<String>,
        Option<DateTime<Utc>>,
        Option<DateTime<Utc>>,
        DateTime<Utc>,
    );

    let (state, memo, applied_at, result_at, updated_at) =
        sqlx::query_as::<_, UpsertRow>(upsert_sql)
            .bind(q.user_id)
            .bind(program_id)
            .bind(&payload.status)
            .bind(&payload.memo)
            .fetch_one(&pool)
            .await
            .map_err(db_error)?;

    record_history(
        &pool,
        q.user_id,
        program_id,
        &payload.status,
        payload.memo.as_deref(),
    )
    .await?;

    Ok(Json(json!({
        "program_id": program_id,
        "status":     state,
        "memo":       memo,
        "applied_at": applied_at,
        "result_at":  result_at,
        "updated_at": updated_at,
    })))
}
