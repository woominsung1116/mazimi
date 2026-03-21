//! 카카오 알림톡 비즈메시지 API 클라이언트.
//!
//! ## 환경변수
//! | 변수명 | 필수 | 설명 |
//! |--------|------|------|
//! | `KAKAO_BIZ_API_KEY`    | ✅ | 비즈메시지 API 인증키 |
//! | `KAKAO_BIZ_SENDER_KEY` | ✅ | 알림톡 발신프로필 키 |
//! | `KAKAO_BIZ_API_URL`    | ❌ | ISP 엔드포인트 (기본값: 카카오 직발송 URL) |
//!
//! ## 템플릿 기반 발송
//! 자유 문구 생성 없이 카카오 비즈니스 포털에 등록된 템플릿 코드를 사용한다.
//! 변수 치환은 `template_vars` 맵으로 전달한다.
//!
//! 예) `"#{프로그램명}" → "청년 장학금"`, `"#{마감일}" → "3월 27일"`

use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

use super::NotificationPayload;

/// 카카오 비즈메시지 기본 엔드포인트.
/// ISP 계약에 따라 다를 수 있으므로 `KAKAO_BIZ_API_URL`로 오버라이드 가능.
const DEFAULT_API_URL: &str = "https://alimtalk-api.kakao.com";

/// 카카오 알림톡 클라이언트.
pub struct KakaoClient {
    http: Client,
    api_key: String,
    sender_key: String,
    api_url: String,
}

/// POST /v2/sender/{senderKey}/message 요청 바디.
#[derive(Debug, Serialize)]
struct AlimtalkRequest<'a> {
    /// 카카오 비즈니스 포털에 등록된 템플릿 코드
    template_code: &'a str,
    /// 수신자 전화번호 (하이픈 없는 숫자, 예: 01012345678)
    receiver_num: &'a str,
    /// 템플릿 변수 치환 맵 (키: `#{변수명}`, 값: 치환할 문자열)
    #[serde(skip_serializing_if = "std::collections::HashMap::is_empty")]
    template_params: &'a std::collections::HashMap<String, String>,
}

/// 카카오 알림톡 API 응답.
#[derive(Debug, Deserialize)]
struct AlimtalkResponse {
    /// "0" = 성공, 그 외 = 실패 코드
    #[serde(default)]
    result_code: String,
    #[serde(default)]
    result_message: String,
}

impl KakaoClient {
    /// 환경변수에서 클라이언트를 초기화한다.
    /// `KAKAO_BIZ_API_KEY` 또는 `KAKAO_BIZ_SENDER_KEY`가 없으면 `Err` 반환.
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("KAKAO_BIZ_API_KEY")
            .context("KAKAO_BIZ_API_KEY not set")?;
        let sender_key = std::env::var("KAKAO_BIZ_SENDER_KEY")
            .context("KAKAO_BIZ_SENDER_KEY not set")?;
        let api_url = std::env::var("KAKAO_BIZ_API_URL")
            .unwrap_or_else(|_| DEFAULT_API_URL.to_string());

        let http = Client::builder()
            .timeout(Duration::from_secs(10))
            .user_agent("wello-worker/0.1")
            .build()
            .context("failed to build HTTP client")?;

        Ok(Self {
            http,
            api_key,
            sender_key,
            api_url,
        })
    }

    /// 알림톡 발송. `payload.phone`이 None이면 즉시 에러.
    pub async fn send(&self, payload: &NotificationPayload) -> Result<()> {
        let phone = payload
            .phone
            .as_deref()
            .context("phone number required for kakao alimtalk")?;

        let url = format!(
            "{}/v2/sender/{}/message",
            self.api_url, self.sender_key
        );

        let body = AlimtalkRequest {
            template_code: &payload.template_code,
            receiver_num: phone,
            template_params: &payload.template_vars,
        };

        tracing::debug!(
            user_id  = %payload.user_id,
            template = %payload.template_code,
            url      = %url,
            "sending kakao alimtalk"
        );

        let resp = self
            .http
            .post(&url)
            .header("Authorization", format!("KakaoAK {}", self.api_key))
            .header("Content-Type", "application/json;charset=UTF-8")
            .json(&body)
            .send()
            .await
            .context("kakao alimtalk HTTP request failed")?;

        let status = resp.status();

        // 응답 바디를 먼저 text로 받아 파싱 실패 시 원문을 로그에 남긴다
        let raw = resp
            .text()
            .await
            .context("kakao alimtalk response read failed")?;

        tracing::debug!(status = %status, body = %raw, "kakao alimtalk raw response");

        if !status.is_success() {
            anyhow::bail!(
                "kakao alimtalk HTTP error: status={}, body={}",
                status,
                raw
            );
        }

        let parsed: AlimtalkResponse =
            serde_json::from_str(&raw).context("kakao alimtalk response parse failed")?;

        if parsed.result_code != "0" {
            anyhow::bail!(
                "kakao alimtalk business error: code={}, msg={}",
                parsed.result_code,
                parsed.result_message
            );
        }

        Ok(())
    }
}
