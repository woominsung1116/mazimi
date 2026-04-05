//! 알림 발송 인프라.
//!
//! ## 채널
//! - **카카오 알림톡** (`kakao`): 템플릿 기반 문자 알림. `KAKAO_BIZ_API_KEY` 등 env 필요.
//! - **Expo Push** (`expo_push`): Expo Push Notifications API. API 키 불필요.
//!
//! ## 동작 원칙
//! - env 키가 없는 채널은 warn 후 skip (panic 없음)
//! - 채널별 발송 실패는 warn 후 나머지 채널 계속 시도
//! - 수신 정보(phone/expo_token)가 없는 유저는 debug 로그만 남김
//! - Expo 티켓은 DB(expo_push_tickets)에 저장하여 워커 재시작 후에도 영수증 조회 가능

use anyhow::Result;
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

pub mod expo_push;
pub mod kakao;

/// 알림 발송에 필요한 공통 페이로드.
#[derive(Debug, Clone)]
pub struct NotificationPayload {
    pub user_id: Uuid,

    /// 카카오 알림톡 수신자 전화번호 (하이픈 없는 11자리, 예: 01012345678)
    pub phone: Option<String>,

    /// Expo push 토큰 (형식: ExponentPushToken[xxx])
    pub expo_token: Option<String>,

    /// 관련 프로그램 UUID (딥링크용)
    pub program_id: Option<Uuid>,

    /// 카카오 알림톡 템플릿 코드 (비즈니스 포털에 등록된 코드)
    pub template_code: String,

    /// 알림 제목
    pub title: String,

    /// 알림 본문 (카카오는 template_vars로 치환)
    pub body: String,

    /// 카카오 템플릿 변수 치환 맵
    /// 예: `{"#{프로그램명}" => "청년 장학금", "#{마감일}" => "2026-03-27"}`
    pub template_vars: HashMap<String, String>,
}

/// pending 티켓 조회용 내부 구조체.
#[derive(sqlx::FromRow)]
struct PendingTicketRow {
    ticket_id: String,
    expo_token: String,
}

/// 카카오 알림톡 + Expo Push 두 채널에 순차 발송하는 디스패처.
///
/// `from_env(pool)`로 생성하면 가용 채널만 활성화하며,
/// 키가 없는 채널은 서버 시작 시 한 번만 warn 로그를 남긴다.
///
/// Expo 전송 시 받은 티켓 ID는 DB(`expo_push_tickets`)에 저장되며,
/// `check_pending_receipts()`로 Expo 영수증 API를 통해 전달 결과를 확인한다.
/// DB 저장 방식이므로 워커 재시작 후에도 티켓이 유실되지 않는다.
pub struct NotificationDispatcher {
    kakao: Option<kakao::KakaoClient>,
    expo: Option<expo_push::ExpoPushClient>,
    pool: PgPool,
}

impl NotificationDispatcher {
    /// 환경변수를 읽어 가용한 채널을 초기화한다.
    /// 개별 채널 초기화 실패는 panic 없이 해당 채널만 비활성화한다.
    pub fn from_env(pool: PgPool) -> Self {
        let kakao = match kakao::KakaoClient::from_env() {
            Ok(c) => {
                tracing::info!("kakao alimtalk notifier initialized");
                Some(c)
            }
            Err(e) => {
                tracing::warn!(error = %e, "kakao alimtalk disabled (env not set)");
                None
            }
        };

        let expo = match expo_push::ExpoPushClient::new() {
            Ok(c) => {
                tracing::info!("expo push notifier initialized");
                Some(c)
            }
            Err(e) => {
                tracing::warn!(error = %e, "expo push disabled (client init failed)");
                None
            }
        };

        Self { kakao, expo, pool }
    }

    /// 가용한 모든 채널에 발송을 시도한다.
    ///
    /// - 채널별 실패 → warn 로그 후 계속
    /// - 수신 정보 없음 → debug 로그만
    /// - 항상 `Ok(())` 반환 (알림 실패가 워커 전체를 멈추지 않음)
    /// - Expo 전송 성공 시 티켓 ID를 DB에 INSERT한다.
    pub async fn send(&self, payload: &NotificationPayload) -> Result<()> {
        let mut attempted = 0u32;

        // ── 카카오 알림톡 ──
        if let (Some(kakao), Some(_)) = (&self.kakao, &payload.phone) {
            attempted += 1;
            match kakao.send(payload).await {
                Ok(()) => tracing::info!(
                    user_id = %payload.user_id,
                    template_code = %payload.template_code,
                    "kakao alimtalk sent"
                ),
                Err(e) => tracing::warn!(
                    user_id = %payload.user_id,
                    error = %e,
                    "kakao alimtalk send failed, continuing"
                ),
            }
        }

        // ── Expo Push ──
        if let (Some(expo), Some(token)) = (&self.expo, &payload.expo_token) {
            attempted += 1;
            let msg = expo_push::ExpoPushMessage::deadline_alert(
                token.clone(),
                payload.title.clone(),
                payload.body.clone(),
                payload.program_id,
            );
            match expo.send(&msg).await {
                Ok(ticket) if ticket.status == "ok" => {
                    tracing::info!(
                        user_id   = %payload.user_id,
                        ticket_id = %ticket.id,
                        "expo push sent"
                    );
                    if !ticket.id.is_empty() {
                        if let Err(e) = sqlx::query(
                            r#"
                            INSERT INTO expo_push_tickets (ticket_id, user_id, expo_token)
                            VALUES ($1, $2, $3)
                            ON CONFLICT (ticket_id) DO NOTHING
                            "#,
                        )
                        .bind(&ticket.id)
                        .bind(payload.user_id)
                        .bind(token.as_str())
                        .execute(&self.pool)
                        .await
                        {
                            tracing::warn!(
                                ticket_id = %ticket.id,
                                error = %e,
                                "failed to persist expo ticket to DB"
                            );
                        }
                    }
                }
                Ok(ticket) => tracing::warn!(
                    user_id = %payload.user_id,
                    message = %ticket.message,
                    details = ?ticket.details,
                    "expo push ticket error"
                ),
                Err(e) => tracing::warn!(
                    user_id = %payload.user_id,
                    error   = %e,
                    "expo push send failed, continuing"
                ),
            }
        }

        if attempted == 0 {
            tracing::debug!(
                user_id    = %payload.user_id,
                has_phone  = payload.phone.is_some(),
                has_token  = payload.expo_token.is_some(),
                kakao_on   = self.kakao.is_some(),
                expo_on    = self.expo.is_some(),
                "no active notification channel for this user"
            );
        }

        Ok(())
    }

    /// DB에서 pending 상태 티켓을 조회하여 Expo 영수증 API로 전달 상태를 확인한다.
    ///
    /// - 성공(ok): status → 'ok', checked_at 기록
    /// - 오류: status → 'error' 또는 'device_not_registered', error_detail 기록
    /// - `DeviceNotRegistered`: push_tokens 테이블에서 해당 토큰 삭제
    /// - API 호출 실패: 행을 그대로 두어 다음 폴링 주기에 재시도
    pub async fn check_pending_receipts(&self) {
        let Some(expo) = &self.expo else {
            tracing::debug!("expo receipt check: expo client not active, skipping");
            return;
        };

        // pending 티켓 조회
        let rows: Vec<PendingTicketRow> = match sqlx::query_as(
            "SELECT ticket_id, expo_token FROM expo_push_tickets WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1000",
        )
        .fetch_all(&self.pool)
        .await
        {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!(error = %e, "expo receipt check: failed to fetch pending tickets");
                return;
            }
        };

        if rows.is_empty() {
            tracing::debug!("expo receipt check: no pending tickets");
            return;
        }

        // ticket_id → expo_token 맵 구성
        let token_map: HashMap<String, String> = rows
            .into_iter()
            .map(|r| (r.ticket_id, r.expo_token))
            .collect();

        let ids: Vec<String> = token_map.keys().cloned().collect();
        tracing::info!(count = ids.len(), "expo receipt check: checking tickets");

        let results = match expo.check_receipts(&ids).await {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!(
                    error = %e,
                    "expo receipt check failed; leaving tickets pending for retry"
                );
                return;
            }
        };

        let mut ok_count = 0usize;
        let mut error_count = 0usize;
        let mut dnr_count = 0usize;

        for result in &results {
            if result.status == "ok" {
                ok_count += 1;
                if let Err(e) = sqlx::query(
                    "UPDATE expo_push_tickets SET status = 'ok', checked_at = NOW() WHERE ticket_id = $1",
                )
                .bind(&result.ticket_id)
                .execute(&self.pool)
                .await
                {
                    tracing::warn!(
                        ticket_id = %result.ticket_id,
                        error = %e,
                        "failed to update ticket status to ok"
                    );
                }
            } else if result.is_device_not_registered() {
                dnr_count += 1;
                let expo_token = token_map
                    .get(&result.ticket_id)
                    .cloned()
                    .unwrap_or_default();
                let error_detail = result.error_detail_str();

                if let Err(e) = sqlx::query(
                    "UPDATE expo_push_tickets SET status = 'device_not_registered', checked_at = NOW(), error_detail = $2 WHERE ticket_id = $1",
                )
                .bind(&result.ticket_id)
                .bind(&error_detail)
                .execute(&self.pool)
                .await
                {
                    tracing::warn!(
                        ticket_id = %result.ticket_id,
                        error = %e,
                        "failed to update ticket status to device_not_registered"
                    );
                }

                // 유효하지 않은 토큰 삭제
                if !expo_token.is_empty() {
                    if let Err(e) = sqlx::query("DELETE FROM push_tokens WHERE token = $1")
                        .bind(&expo_token)
                        .execute(&self.pool)
                        .await
                    {
                        tracing::warn!(
                            token = %expo_token,
                            error = %e,
                            "failed to delete stale push token"
                        );
                    }
                }
            } else {
                error_count += 1;
                let error_detail = result.error_detail_str();

                if let Err(e) = sqlx::query(
                    "UPDATE expo_push_tickets SET status = 'error', checked_at = NOW(), error_detail = $2 WHERE ticket_id = $1",
                )
                .bind(&result.ticket_id)
                .bind(&error_detail)
                .execute(&self.pool)
                .await
                {
                    tracing::warn!(
                        ticket_id = %result.ticket_id,
                        error = %e,
                        "failed to update ticket status to error"
                    );
                }
            }
        }

        tracing::info!(
            ok_count,
            error_count,
            device_not_registered_count = dnr_count,
            "expo receipt check complete"
        );
    }

    /// 활성화된 채널이 하나라도 있으면 true.
    #[allow(dead_code)]
    pub fn has_any_channel(&self) -> bool {
        self.kakao.is_some() || self.expo.is_some()
    }
}
