use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::AuthUser;

// ── Notification preferences types ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct NotifChannels {
    pub in_app: bool,
    pub push: bool,
    pub kakao: bool,
    pub email: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdateNotifPrefRequest {
    pub deadline: bool,
    pub new_program: bool,
    pub profile_update: bool,
    pub channels: NotifChannels,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct NotifPrefRow {
    user_id: Uuid,
    notify_deadline: bool,
    notify_new_program: bool,
    notify_profile_update: bool,
    channel_in_app: bool,
    channel_push: bool,
    channel_kakao: bool,
    channel_email: bool,
    updated_at: chrono::DateTime<chrono::Utc>,
}

// ── Request / Response types ────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct PaginationQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
}

fn default_limit() -> i64 {
    20
}

#[derive(Debug, Deserialize)]
pub struct AlertPreferenceRequest {
    pub program_id: Uuid,
    pub enabled: bool,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct AlertDeliveryRow {
    id: Uuid,
    user_id: Uuid,
    program_id: Uuid,
    alert_type: String,
    alert_date: NaiveDate,
    // program info (joined)
    program_title: String,
    official_url: Option<String>,
    deadline_at: Option<chrono::DateTime<chrono::Utc>>,
    application_end_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct AlertSubscriptionRow {
    program_id: Uuid,
    enabled: bool,
    program_title: String,
}

// ── Handlers ────────────────────────────────────────────────────────────────

/// GET /api/v1/alerts?limit=20&offset=0
/// The authenticated user's ID is taken from the JWT — no client-supplied user_id accepted.
pub async fn list_alerts(
    auth_user: AuthUser,
    State(pool): State<PgPool>,
    Query(q): Query<PaginationQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = auth_user.id;
    let limit = q.limit.clamp(1, 100);
    let offset = q.offset.max(0);

    let deliveries = sqlx::query_as::<_, AlertDeliveryRow>(
        r#"
        SELECT
            ad.id,
            ad.user_id,
            ad.program_id,
            ad.alert_type,
            ad.alert_date,
            p.title  AS program_title,
            p.official_url,
            p.deadline_at,
            p.application_end_at
        FROM alert_deliveries ad
        JOIN programs p ON p.id = ad.program_id
        WHERE ad.user_id = $1
        ORDER BY ad.alert_date DESC, ad.created_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(user_id)
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

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM alert_deliveries WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("DB error: {e}") })),
        )
    })?;

    Ok(Json(json!({
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": deliveries
    })))
}

/// POST /api/v1/alerts/preferences
/// The authenticated user's ID is taken from the JWT — no client-supplied user_id accepted.
pub async fn upsert_preferences(
    auth_user: AuthUser,
    State(pool): State<PgPool>,
    Json(payload): Json<AlertPreferenceRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = auth_user.id;

    // program 존재 확인
    let program_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM programs WHERE id = $1 AND is_active = true)",
    )
    .bind(payload.program_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("DB error: {e}") })),
        )
    })?;

    if !program_exists {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "program not found or inactive" })),
        ));
    }

    // upsert alert_subscriptions
    sqlx::query(
        r#"
        INSERT INTO alert_subscriptions (id, user_id, program_id, enabled, created_at, updated_at)
        VALUES ($1, $2, $3, $4, now(), now())
        ON CONFLICT (user_id, program_id) DO UPDATE
            SET enabled    = EXCLUDED.enabled,
                updated_at = now()
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(payload.program_id)
    .bind(payload.enabled)
    .execute(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("DB error: {e}") })),
        )
    })?;

    // 현재 구독 목록 반환 (enabled=true인 것만)
    let subscriptions = sqlx::query_as::<_, AlertSubscriptionRow>(
        r#"
        SELECT
            asub.program_id,
            asub.enabled,
            p.title AS program_title
        FROM alert_subscriptions asub
        JOIN programs p ON p.id = asub.program_id
        WHERE asub.user_id = $1
        ORDER BY asub.updated_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("DB error: {e}") })),
        )
    })?;

    Ok(Json(json!({
        "user_id": user_id,
        "updated": {
            "program_id": payload.program_id,
            "enabled": payload.enabled
        },
        "subscriptions": subscriptions
    })))
}

/// GET /api/v1/alerts/notification-preferences
/// The authenticated user's ID is taken from the JWT — no client-supplied user_id accepted.
pub async fn get_notification_preferences(
    auth_user: AuthUser,
    State(pool): State<PgPool>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = auth_user.id;

    // Ensure a default row exists (no-op if already present).
    sqlx::query(
        "INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING",
    )
    .bind(user_id)
    .execute(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("DB error: {e}") })),
        )
    })?;

    let row = sqlx::query_as::<_, NotifPrefRow>(
        r#"
        SELECT
            user_id,
            notify_deadline,
            notify_new_program,
            notify_profile_update,
            channel_in_app,
            channel_push,
            channel_kakao,
            channel_email,
            updated_at
        FROM notification_preferences
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("DB error: {e}") })),
        )
    })?;

    Ok(Json(json!({
        "user_id": row.user_id,
        "deadline": row.notify_deadline,
        "new_program": row.notify_new_program,
        "profile_update": row.notify_profile_update,
        "channels": {
            "in_app": row.channel_in_app,
            "push": row.channel_push,
            "kakao": row.channel_kakao,
            "email": row.channel_email
        },
        "updated_at": row.updated_at
    })))
}

/// PUT /api/v1/alerts/notification-preferences
/// The authenticated user's ID is taken from the JWT — no client-supplied user_id accepted.
/// Body: { deadline, new_program, profile_update, channels: { in_app, push, kakao, email } }
pub async fn update_notification_preferences(
    auth_user: AuthUser,
    State(pool): State<PgPool>,
    Json(payload): Json<UpdateNotifPrefRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = auth_user.id;

    let row = sqlx::query_as::<_, NotifPrefRow>(
        r#"
        INSERT INTO notification_preferences (
            user_id,
            notify_deadline,
            notify_new_program,
            notify_profile_update,
            channel_in_app,
            channel_push,
            channel_kakao,
            channel_email,
            updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
        ON CONFLICT (user_id) DO UPDATE
            SET notify_deadline       = EXCLUDED.notify_deadline,
                notify_new_program    = EXCLUDED.notify_new_program,
                notify_profile_update = EXCLUDED.notify_profile_update,
                channel_in_app        = EXCLUDED.channel_in_app,
                channel_push          = EXCLUDED.channel_push,
                channel_kakao         = EXCLUDED.channel_kakao,
                channel_email         = EXCLUDED.channel_email,
                updated_at            = now()
        RETURNING
            user_id,
            notify_deadline,
            notify_new_program,
            notify_profile_update,
            channel_in_app,
            channel_push,
            channel_kakao,
            channel_email,
            updated_at
        "#,
    )
    .bind(user_id)
    .bind(payload.deadline)
    .bind(payload.new_program)
    .bind(payload.profile_update)
    .bind(payload.channels.in_app)
    .bind(payload.channels.push)
    .bind(payload.channels.kakao)
    .bind(payload.channels.email)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("DB error: {e}") })),
        )
    })?;

    Ok(Json(json!({
        "user_id": row.user_id,
        "deadline": row.notify_deadline,
        "new_program": row.notify_new_program,
        "profile_update": row.notify_profile_update,
        "channels": {
            "in_app": row.channel_in_app,
            "push": row.channel_push,
            "kakao": row.channel_kakao,
            "email": row.channel_email
        },
        "updated_at": row.updated_at
    })))
}
