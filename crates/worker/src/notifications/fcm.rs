//! FCM HTTP v1 API 클라이언트.
//!
//! ## 환경변수
//! | 변수명 | 필수 | 설명 |
//! |--------|------|------|
//! | `FCM_PROJECT_ID`    | ✅ | Firebase 프로젝트 ID |
//! | `FCM_ACCESS_TOKEN`  | ✅ | Google OAuth2 액세스 토큰 (단기 유효, 외부 갱신) |
//!
//! ## 토큰 갱신
//! FCM HTTP v1은 Google 서비스 계정 OAuth2 토큰이 필요하다.
//! MVP 단계에서는 외부에서 갱신된 토큰을 `FCM_ACCESS_TOKEN` env로 주입한다.
//! (Cloud Run metadata endpoint / Secret Manager 활용 권장)
//!
//! ## 메시지 우선순위
//! `deadline` 알림은 `HIGH` priority로 발송하여 Doze 모드에서도 전달한다.

use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

use super::NotificationPayload;

const FCM_ENDPOINT: &str = "https://fcm.googleapis.com/v1/projects";

/// FCM HTTP v1 클라이언트.
pub struct FcmClient {
    http: Client,
    project_id: String,
    access_token: String,
}

// ── FCM HTTP v1 요청 구조체 ──────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct FcmRequest {
    message: FcmMessage,
}

#[derive(Debug, Serialize)]
struct FcmMessage {
    /// 대상 디바이스 토큰
    token: String,
    /// 알림 페이로드 (표시용)
    notification: FcmNotification,
    /// Android 전용 설정
    android: FcmAndroidConfig,
    /// APNS (iOS) 전용 설정
    apns: FcmApnsConfig,
    /// 커스텀 데이터 (앱 내 딥링크 등)
    data: std::collections::HashMap<String, String>,
}

#[derive(Debug, Serialize)]
struct FcmNotification {
    title: String,
    body: String,
}

#[derive(Debug, Serialize)]
struct FcmAndroidConfig {
    /// "HIGH" = Doze 모드에서도 즉시 전달
    priority: &'static str,
    notification: FcmAndroidNotification,
}

#[derive(Debug, Serialize)]
struct FcmAndroidNotification {
    /// 알림 채널 ID (앱에서 동일하게 등록 필요)
    channel_id: &'static str,
    /// 알림음
    sound: &'static str,
}

#[derive(Debug, Serialize)]
struct FcmApnsConfig {
    payload: FcmApnsPayload,
}

#[derive(Debug, Serialize)]
struct FcmApnsPayload {
    aps: FcmAps,
}

#[derive(Debug, Serialize)]
struct FcmAps {
    /// iOS alert sound
    sound: &'static str,
    /// 배지 카운트 (optional, -1이면 변경 없음)
    #[serde(skip_serializing_if = "Option::is_none")]
    badge: Option<i32>,
}

// ── FCM 응답 구조체 ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct FcmResponse {
    /// 성공 시 `projects/{project}/messages/{message_id}` 형식
    #[serde(default)]
    name: String,
}

#[derive(Debug, Deserialize)]
struct FcmErrorResponse {
    error: FcmError,
}

#[derive(Debug, Deserialize)]
struct FcmError {
    code: i32,
    message: String,
    status: String,
}

// ── 구현 ────────────────────────────────────────────────────────────────────

impl FcmClient {
    /// 환경변수에서 클라이언트를 초기화한다.
    /// `FCM_PROJECT_ID` 또는 `FCM_ACCESS_TOKEN`이 없으면 `Err` 반환.
    pub fn from_env() -> Result<Self> {
        let project_id = std::env::var("FCM_PROJECT_ID")
            .context("FCM_PROJECT_ID not set")?;
        let access_token = std::env::var("FCM_ACCESS_TOKEN")
            .context("FCM_ACCESS_TOKEN not set")?;

        let http = Client::builder()
            .timeout(Duration::from_secs(15))
            .user_agent("wello-worker/0.1")
            .build()
            .context("failed to build HTTP client")?;

        Ok(Self {
            http,
            project_id,
            access_token,
        })
    }

    /// FCM 푸시 발송. `payload.fcm_token`이 None이면 즉시 에러.
    pub async fn send(&self, payload: &NotificationPayload) -> Result<()> {
        let token = payload
            .fcm_token
            .as_deref()
            .context("fcm_token required for FCM push")?;

        // 커스텀 데이터: 알림 탭 시 앱 내 이동 경로 등
        let mut data = std::collections::HashMap::new();
        data.insert("template_code".to_string(), payload.template_code.clone());
        data.insert("user_id".to_string(), payload.user_id.to_string());

        let message = FcmMessage {
            token: token.to_string(),
            notification: FcmNotification {
                title: payload.title.clone(),
                body: payload.body.clone(),
            },
            android: FcmAndroidConfig {
                priority: "HIGH",
                notification: FcmAndroidNotification {
                    channel_id: "deadline_alerts",
                    sound: "default",
                },
            },
            apns: FcmApnsConfig {
                payload: FcmApnsPayload {
                    aps: FcmAps {
                        sound: "default",
                        badge: None,
                    },
                },
            },
            data,
        };

        let req = FcmRequest { message };

        let url = format!(
            "{}/{}/messages:send",
            FCM_ENDPOINT, self.project_id
        );

        tracing::debug!(
            user_id = %payload.user_id,
            project = %self.project_id,
            url     = %url,
            "sending fcm push"
        );

        let resp = self
            .http
            .post(&url)
            .bearer_auth(&self.access_token)
            .header("Content-Type", "application/json; UTF-8")
            .json(&req)
            .send()
            .await
            .context("fcm HTTP request failed")?;

        let status = resp.status();
        let raw = resp
            .text()
            .await
            .context("fcm response read failed")?;

        tracing::debug!(status = %status, body = %raw, "fcm raw response");

        if !status.is_success() {
            // FCM 에러 응답 파싱 시도
            let msg = serde_json::from_str::<FcmErrorResponse>(&raw)
                .map(|e| format!("code={}, status={}, msg={}", e.error.code, e.error.status, e.error.message))
                .unwrap_or_else(|_| raw.clone());

            anyhow::bail!("fcm HTTP error: status={}, error={}", status, msg);
        }

        let parsed: FcmResponse =
            serde_json::from_str(&raw).context("fcm response parse failed")?;

        tracing::debug!(message_id = %parsed.name, "fcm message accepted");

        Ok(())
    }
}
