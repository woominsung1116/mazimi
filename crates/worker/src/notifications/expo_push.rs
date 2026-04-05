//! Expo Push Notifications API 클라이언트.
//!
//! ## 특징
//! - API 키 불필요 (기본 사용량 무료)
//! - Expo SDK가 설치된 앱에서 발급된 `ExponentPushToken[xxx]` 형식 토큰 사용
//! - 최대 100건씩 배치 전송 지원
//! - 영수증(receipt) 기반 오류 처리 포함
//!
//! ## 엔드포인트
//! POST https://exp.host/--/api/v2/push/send

use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const EXPO_PUSH_URL: &str = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL: &str = "https://exp.host/--/api/v2/push/getReceipts";

/// 배치당 최대 메시지 수 (Expo 제한)
const MAX_BATCH_SIZE: usize = 100;

// ── 요청 구조체 ───────────────────────────────────────────────────────────────

/// Expo push 메시지 단건.
#[derive(Debug, Serialize)]
pub struct ExpoPushMessage {
    /// 수신 토큰: `ExponentPushToken[xxx]` 형식
    pub to: String,
    /// 알림 제목
    pub title: String,
    /// 알림 본문
    pub body: String,
    /// 커스텀 데이터 (앱 내 딥링크 등)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    /// 알림음 ("default" 또는 None)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sound: Option<&'static str>,
    /// Android 알림 채널 ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channel_id: Option<&'static str>,
    /// 뱃지 카운트 (iOS)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub badge: Option<u32>,
    /// 우선순위: "default" | "normal" | "high"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<&'static str>,
    /// TTL (초): 0이면 즉시 전달 불가 시 폐기
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ttl: Option<u64>,
}

impl ExpoPushMessage {
    /// 마감 알림용 기본 메시지를 생성한다.
    pub fn deadline_alert(
        token: impl Into<String>,
        title: impl Into<String>,
        body: impl Into<String>,
        program_id: Option<uuid::Uuid>,
    ) -> Self {
        let data = program_id.map(|id| {
            serde_json::json!({
                "type": "program_deadline",
                "programId": id.to_string(),
            })
        });

        Self {
            to: token.into(),
            title: title.into(),
            body: body.into(),
            data,
            sound: Some("default"),
            channel_id: Some("wello-default"),
            badge: None,
            priority: Some("high"),
            ttl: Some(86_400), // 24시간
        }
    }
}

// ── 응답 구조체 ───────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct ExpoPushResponse {
    data: Vec<ExpoPushTicket>,
}

/// 개별 메시지 전송 결과 티켓.
#[derive(Debug, Deserialize)]
pub struct ExpoPushTicket {
    /// "ok" | "error"
    pub status: String,
    /// 성공 시 영수증 조회용 ID
    #[serde(default)]
    pub id: String,
    /// 실패 시 에러 메시지
    #[serde(default)]
    pub message: String,
    /// 실패 원인 코드 (e.g. "DeviceNotRegistered", "MessageTooBig")
    #[serde(default)]
    pub details: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
struct ReceiptRequest {
    ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct ReceiptResponse {
    data: std::collections::HashMap<String, ReceiptEntry>,
}

#[derive(Debug, Deserialize)]
struct ReceiptEntry {
    status: String,
    #[serde(default)]
    message: String,
    #[serde(default)]
    details: Option<serde_json::Value>,
}

/// 영수증 조회 결과 단건.
#[derive(Debug)]
pub struct ReceiptResult {
    /// 조회한 티켓 ID
    pub ticket_id: String,
    /// "ok" | "error"
    pub status: String,
    /// 실패 시 에러 메시지
    pub error_message: Option<String>,
    /// 실패 원인 코드 등 (e.g. `{"error": "DeviceNotRegistered"}`)
    pub details: Option<serde_json::Value>,
}

impl ReceiptResult {
    /// `DeviceNotRegistered` 오류인지 여부.
    pub fn is_device_not_registered(&self) -> bool {
        self.details
            .as_ref()
            .and_then(|d| d.get("error"))
            .and_then(|e| e.as_str())
            .map(|s| s == "DeviceNotRegistered")
            .unwrap_or(false)
    }

    /// 영수증 에러 상세를 단일 문자열로 반환한다 (DB 저장용).
    pub fn error_detail_str(&self) -> Option<String> {
        match (&self.error_message, &self.details) {
            (None, None) => None,
            (Some(msg), None) => Some(msg.clone()),
            (None, Some(d)) => Some(d.to_string()),
            (Some(msg), Some(d)) => Some(format!("{msg} — {d}")),
        }
    }
}

// ── 클라이언트 ────────────────────────────────────────────────────────────────

/// Expo Push Notifications API 클라이언트.
///
/// API 키 불필요. `new()`로 바로 생성 가능.
pub struct ExpoPushClient {
    http: Client,
}

impl ExpoPushClient {
    /// 새 클라이언트를 생성한다. 환경변수 불필요.
    pub fn new() -> Result<Self> {
        let http = Client::builder()
            .timeout(Duration::from_secs(15))
            .user_agent("wello-worker/0.1")
            .build()
            .context("failed to build HTTP client")?;
        Ok(Self { http })
    }

    /// 메시지 단건을 전송한다.
    pub async fn send(&self, message: &ExpoPushMessage) -> Result<ExpoPushTicket> {
        let tickets = self.send_batch(std::slice::from_ref(message)).await?;
        tickets
            .into_iter()
            .next()
            .context("expo returned empty ticket list")
    }

    /// 메시지 목록을 배치로 전송한다 (최대 100건씩 자동 분할).
    ///
    /// 반환되는 `Vec<ExpoPushTicket>`의 순서는 입력 메시지 순서와 일치한다.
    pub async fn send_batch(&self, messages: &[ExpoPushMessage]) -> Result<Vec<ExpoPushTicket>> {
        if messages.is_empty() {
            return Ok(vec![]);
        }

        let mut all_tickets = Vec::with_capacity(messages.len());

        for chunk in messages.chunks(MAX_BATCH_SIZE) {
            let tickets = self.send_chunk(chunk).await?;
            all_tickets.extend(tickets);
        }

        Ok(all_tickets)
    }

    /// 단일 청크(최대 100건)를 Expo API에 POST한다.
    async fn send_chunk(&self, messages: &[ExpoPushMessage]) -> Result<Vec<ExpoPushTicket>> {
        tracing::debug!(count = messages.len(), "sending expo push batch");

        let resp = self
            .http
            .post(EXPO_PUSH_URL)
            .header("Accept", "application/json")
            .header("Accept-Encoding", "gzip, deflate")
            .header("Content-Type", "application/json")
            .json(messages)
            .send()
            .await
            .context("expo push HTTP request failed")?;

        let status = resp.status();
        let raw = resp
            .text()
            .await
            .context("expo push response read failed")?;

        tracing::debug!(http_status = %status, "expo push raw response");

        if !status.is_success() {
            anyhow::bail!("expo push HTTP error: status={}, body={}", status, raw);
        }

        let parsed: ExpoPushResponse =
            serde_json::from_str(&raw).context("expo push response parse failed")?;

        // 개별 티켓 결과 로깅
        for ticket in &parsed.data {
            if ticket.status == "error" {
                tracing::warn!(
                    ticket_id = %ticket.id,
                    message   = %ticket.message,
                    details   = ?ticket.details,
                    "expo push ticket error"
                );
            } else {
                tracing::debug!(ticket_id = %ticket.id, "expo push ticket ok");
            }
        }

        Ok(parsed.data)
    }

    /// 티켓 ID 목록으로 영수증을 조회한다.
    ///
    /// 반환: `Vec<ReceiptResult>` — 각 티켓의 조회 결과.
    /// `DeviceNotRegistered` 여부는 `ReceiptResult::is_device_not_registered()`로 확인한다.
    pub async fn check_receipts(&self, ticket_ids: &[String]) -> Result<Vec<ReceiptResult>> {
        if ticket_ids.is_empty() {
            return Ok(vec![]);
        }

        let req = ReceiptRequest {
            ids: ticket_ids.to_vec(),
        };

        let resp = self
            .http
            .post(EXPO_RECEIPTS_URL)
            .header("Content-Type", "application/json")
            .json(&req)
            .send()
            .await
            .context("expo receipts HTTP request failed")?;

        let status = resp.status();
        let raw = resp
            .text()
            .await
            .context("expo receipts response read failed")?;

        if !status.is_success() {
            anyhow::bail!("expo receipts HTTP error: status={}, body={}", status, raw);
        }

        let parsed: ReceiptResponse =
            serde_json::from_str(&raw).context("expo receipts parse failed")?;

        let mut results = Vec::with_capacity(parsed.data.len());

        for (id, entry) in parsed.data {
            if entry.status != "ok" {
                tracing::warn!(
                    receipt_id = %id,
                    message    = %entry.message,
                    details    = ?entry.details,
                    "expo receipt error"
                );
            }
            results.push(ReceiptResult {
                ticket_id: id,
                status: entry.status,
                error_message: if entry.message.is_empty() {
                    None
                } else {
                    Some(entry.message)
                },
                details: entry.details,
            });
        }

        Ok(results)
    }
}

impl Default for ExpoPushClient {
    fn default() -> Self {
        Self::new().expect("failed to create ExpoPushClient")
    }
}
