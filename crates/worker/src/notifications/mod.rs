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

use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
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

/// 카카오 알림톡 + Expo Push 두 채널에 순차 발송하는 디스패처.
///
/// `from_env()`로 생성하면 가용 채널만 활성화하며,
/// 키가 없는 채널은 서버 시작 시 한 번만 warn 로그를 남긴다.
///
/// Expo 전송 시 받은 티켓 ID는 `pending_tickets`에 누적되며,
/// `check_pending_receipts()`로 Expo 영수증 API를 통해 전달 결과를 확인한다.
pub struct NotificationDispatcher {
    kakao: Option<kakao::KakaoClient>,
    expo: Option<expo_push::ExpoPushClient>,
    /// Expo 전송 후 영수증 조회 대기 중인 티켓 ID 목록.
    pending_tickets: Arc<Mutex<Vec<String>>>,
}

impl NotificationDispatcher {
    /// 환경변수를 읽어 가용한 채널을 초기화한다.
    /// 개별 채널 초기화 실패는 panic 없이 해당 채널만 비활성화한다.
    pub fn from_env() -> Self {
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

        Self {
            kakao,
            expo,
            pending_tickets: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// 가용한 모든 채널에 발송을 시도한다.
    ///
    /// - 채널별 실패 → warn 로그 후 계속
    /// - 수신 정보 없음 → debug 로그만
    /// - 항상 `Ok(())` 반환 (알림 실패가 워커 전체를 멈추지 않음)
    /// - Expo 전송 성공 시 티켓 ID를 `pending_tickets`에 추가한다.
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
                    // 영수증 확인을 위해 티켓 ID 저장
                    if !ticket.id.is_empty() {
                        self.pending_tickets.lock().await.push(ticket.id);
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

    /// 누적된 Expo 티켓 ID를 모두 꺼내 Expo 영수증 API로 전달 상태를 확인한다.
    ///
    /// 영수증에서 오류가 확인된 티켓 ID를 warn 로그로 남긴다.
    /// `DeviceNotRegistered` 오류 토큰 정리 같은 후속 처리는 향후 여기에 추가한다.
    pub async fn check_pending_receipts(&self) {
        let ids: Vec<String> = {
            let mut lock = self.pending_tickets.lock().await;
            std::mem::take(&mut *lock)
        };

        if ids.is_empty() {
            tracing::debug!("expo receipt check: no pending tickets");
            return;
        }

        let Some(expo) = &self.expo else {
            tracing::debug!("expo receipt check: expo client not active, skipping");
            return;
        };

        tracing::info!(count = ids.len(), "expo receipt check: checking tickets");

        match expo.check_receipts(&ids).await {
            Ok((ok_count, error_ids)) => {
                tracing::info!(
                    ok_count,
                    error_count = error_ids.len(),
                    "expo receipt check complete"
                );
                for id in &error_ids {
                    tracing::warn!(ticket_id = %id, "expo receipt reported error for ticket");
                }
            }
            Err(e) => {
                tracing::warn!(error = %e, "expo receipt check failed; tickets lost");
            }
        }
    }

    /// 활성화된 채널이 하나라도 있으면 true.
    #[allow(dead_code)]
    pub fn has_any_channel(&self) -> bool {
        self.kakao.is_some() || self.expo.is_some()
    }
}
