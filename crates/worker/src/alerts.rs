//! 마감 D-7/D-3/D-1 알림 생성 + 발송 워커.
//!
//! 동작 원칙:
//! - alert_subscriptions(enabled=true)가 있는 유저 × 해당 마감 프로그램 조합만 처리
//! - (user_id, program_id, alert_type, alert_date) UNIQUE → 중복 발송 자동 방지
//! - 하루 2회 제한: 오늘 이미 2건 이상 발송된 유저는 skip
//! - 알림 채널(카카오/FCM) 실패는 워크플로를 중단하지 않음

use anyhow::Result;
use chrono::{DateTime, Duration, Utc};
use sqlx::{FromRow, PgPool};
use std::collections::HashMap;
use uuid::Uuid;

use crate::notifications::{NotificationDispatcher, NotificationPayload};

/// 하루 최대 알림 발송 횟수
const DAILY_ALERT_LIMIT: i64 = 2;

/// deadline_at / application_end_at 기준으로 D-7, D-3, D-1 알림을 생성·발송한다.
/// 매시간 호출되지만 UNIQUE 제약으로 같은 날 중복 실행 시 안전하다.
pub async fn generate_deadline_alerts(
    pool: &PgPool,
    notifier: &NotificationDispatcher,
) -> Result<()> {
    let today = Utc::now().date_naive();

    for days_left in [7i64, 3, 1] {
        let target_date = today + Duration::days(days_left);
        let alert_type = format!("d{}", days_left);

        run_for_type(pool, notifier, today, target_date, &alert_type, days_left).await?;
    }

    Ok(())
}

/// alert_subscriptions 조회 결과 행.
#[derive(Debug, FromRow)]
struct AlertCandidate {
    user_id: Uuid,
    program_id: Uuid,
    /// users.phone (없으면 None)
    phone: Option<String>,
    /// programs.title
    title: String,
    /// programs.benefit_amount_monthly (만원 단위 정수)
    benefit_amount_monthly: Option<i32>,
    /// programs.deadline_at (우선) 또는 application_end_at
    effective_deadline: Option<DateTime<Utc>>,
}

/// 단일 alert_type(d7/d3/d1)에 대한 알림 생성·발송 처리.
async fn run_for_type(
    pool: &PgPool,
    notifier: &NotificationDispatcher,
    today: chrono::NaiveDate,
    target_date: chrono::NaiveDate,
    alert_type: &str,
    days_left: i64,
) -> Result<()> {
    // alert_subscriptions(enabled=true) × 마감일이 target_date인 프로그램 × 유저 정보
    let candidates: Vec<AlertCandidate> = sqlx::query_as(
        r#"
        SELECT
            asub.user_id,
            asub.program_id,
            u.phone,
            p.title,
            p.benefit_amount_monthly,
            COALESCE(p.deadline_at, p.application_end_at) AS effective_deadline
        FROM alert_subscriptions asub
        JOIN programs p ON p.id = asub.program_id
        JOIN users    u ON u.id = asub.user_id
        WHERE asub.enabled = true
          AND p.is_active  = true
          AND DATE(
                COALESCE(p.deadline_at, p.application_end_at) AT TIME ZONE 'UTC'
              ) = $1
        "#,
    )
    .bind(target_date)
    .fetch_all(pool)
    .await?;

    if candidates.is_empty() {
        tracing::debug!(alert_type, "no candidates for deadline alert");
        return Ok(());
    }

    tracing::info!(
        alert_type,
        candidate_count = candidates.len(),
        "processing deadline alert candidates"
    );

    let mut queued = 0u32;
    let mut skipped_limit = 0u32;
    let mut skipped_dup = 0u32;

    for candidate in candidates {
        // ── 하루 2회 제한 체크 ──
        let today_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM alert_deliveries WHERE user_id = $1 AND alert_date = $2",
        )
        .bind(candidate.user_id)
        .bind(today)
        .fetch_one(pool)
        .await
        .map_err(|e| {
            tracing::warn!(
                user_id = %candidate.user_id,
                error = %e,
                "Failed to check daily alert count"
            );
            e
        })?;

        if today_count >= DAILY_ALERT_LIMIT {
            skipped_limit += 1;
            tracing::debug!(
                user_id     = %candidate.user_id,
                today_count,
                "daily alert limit reached, skipping"
            );
            continue;
        }

        // ── INSERT … ON CONFLICT DO NOTHING → 중복 발송 방지 ──
        let result = sqlx::query(
            "INSERT INTO alert_deliveries \
                 (id, user_id, program_id, alert_type, alert_date) \
             VALUES ($1, $2, $3, $4, $5) \
             ON CONFLICT (user_id, program_id, alert_type, alert_date) DO NOTHING",
        )
        .bind(Uuid::new_v4())
        .bind(candidate.user_id)
        .bind(candidate.program_id)
        .bind(alert_type)
        .bind(today)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            skipped_dup += 1;
            continue;
        }

        queued += 1;
        tracing::info!(
            user_id    = %candidate.user_id,
            program_id = %candidate.program_id,
            alert_type,
            "deadline alert queued"
        );

        // ── 알림 발송 ──
        let payload = build_payload(&candidate, days_left);
        if let Err(e) = notifier.send(&payload).await {
            // 발송 실패는 warn만 남기고 계속 (DB 기록은 이미 완료)
            tracing::warn!(
                user_id    = %candidate.user_id,
                program_id = %candidate.program_id,
                alert_type,
                error = %e,
                "notification dispatch failed (alert already recorded in DB)"
            );
        }
    }

    tracing::info!(
        alert_type,
        queued,
        skipped_limit,
        skipped_dup,
        "deadline alert run complete"
    );

    Ok(())
}

/// `AlertCandidate`로부터 `NotificationPayload`를 조립한다.
/// 카카오 템플릿 변수와 FCM 본문을 동시에 구성한다.
fn build_payload(c: &AlertCandidate, days_left: i64) -> NotificationPayload {
    // 카카오 템플릿 코드: DEADLINE_D7 / DEADLINE_D3 / DEADLINE_D1
    let template_code = format!("DEADLINE_D{}", days_left);

    // 마감 표현 문자열 (예: "7일 후", "내일")
    let deadline_label = match days_left {
        1 => "내일".to_string(),
        n => format!("{}일 후", n),
    };

    // 혜택 금액 문자열 (없으면 빈 문자열)
    let benefit_str = c
        .benefit_amount_monthly
        .map(|amt| format!("월 {}만원", amt / 10_000))
        .unwrap_or_default();

    // 알림 본문: 행동경제학 손실 프레이밍 적용
    let body = if benefit_str.is_empty() {
        format!(
            "{} 마감! '{}'에 지원하지 않으면 혜택을 놓칠 수 있어요.",
            deadline_label, c.title
        )
    } else {
        format!(
            "{} 마감! '{}' {} 혜택이 {} 사라질 수 있어요.",
            deadline_label, c.title, benefit_str, deadline_label
        )
    };

    // 카카오 템플릿 변수 치환 맵
    let mut template_vars = HashMap::new();
    template_vars.insert("#{프로그램명}".to_string(), c.title.clone());
    template_vars.insert("#{마감시점}".to_string(), deadline_label.clone());
    if !benefit_str.is_empty() {
        template_vars.insert("#{혜택금액}".to_string(), benefit_str);
    }
    if let Some(deadline) = c.effective_deadline {
        template_vars.insert(
            "#{마감일}".to_string(),
            deadline.format("%m월 %d일").to_string(),
        );
    }

    NotificationPayload {
        user_id: c.user_id,
        phone: c.phone.clone(),
        expo_token: None, // push_tokens 테이블에서 조회 예정
        program_id: None,
        template_code,
        title: format!("마지미 마감 알림 ({})", deadline_label),
        body,
        template_vars,
    }
}
