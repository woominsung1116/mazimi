//! 온통청년(청년정책) Open API client
//!
//! API: https://www.youthcenter.go.kr/opi/youthPlcyList.do
//! Env: YOUTH_CENTER_API_KEY  (온통청년 Open API 인증키)
//!
//! Response format: XML
//! Pagination params: pageIndex (1-based), display (page size)

use anyhow::{Context, Result};
use quick_xml::de::from_str as xml_from_str;
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;
use tracing::{info, warn};

use super::{content_hash, DataSource, RawRecord};

const BASE_URL: &str = "https://www.youthcenter.go.kr/opi/youthPlcyList.do";
const PAGE_SIZE: u32 = 100;

pub struct YouthCenterSource {
    client: Client,
    api_key: String,
}

impl YouthCenterSource {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .unwrap_or_default(),
            api_key,
        }
    }

    pub fn from_env() -> Result<Self> {
        let key = std::env::var("YOUTH_CENTER_API_KEY").context("YOUTH_CENTER_API_KEY not set")?;
        Ok(Self::new(key))
    }

    async fn fetch_page(&self, page: u32) -> Result<YouthCenterRoot> {
        let text = self
            .client
            .get(BASE_URL)
            .query(&[
                ("openApiVlak", self.api_key.as_str()),
                ("pageIndex", &page.to_string()),
                ("display", &PAGE_SIZE.to_string()),
            ])
            .send()
            .await
            .context("youth_center: HTTP request failed")?
            .error_for_status()
            .context("youth_center: non-2xx response")?
            .text()
            .await
            .context("youth_center: failed to read response body")?;

        xml_from_str::<YouthCenterRoot>(&text).with_context(|| {
            format!(
                "youth_center: XML parse failed. body={}",
                &text[..text.len().min(500)]
            )
        })
    }
}

impl DataSource for YouthCenterSource {
    fn name(&self) -> &'static str {
        "youth_center"
    }

    async fn fetch_all(&self) -> Result<Vec<RawRecord>> {
        let mut records = Vec::new();
        let mut page = 1u32;

        loop {
            info!(source = self.name(), page, "fetching page");

            let root = self.fetch_page(page).await?;

            // The API wraps items under <youthPolicyList><youthPolicy>
            let items: Vec<YouthPolicyItem> = root
                .youthPolicyList
                .map(|l| l.youthPolicy)
                .unwrap_or_default();

            if items.is_empty() {
                warn!(
                    source = self.name(),
                    page, "empty youthPolicyList — stopping pagination"
                );
                break;
            }

            let fetched = items.len();
            for item in items {
                let source_id = item
                    .bizId
                    .clone()
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| format!("yc_unknown_{}", records.len()));

                let payload = serde_json::to_value(&item).unwrap_or(Value::Null);
                let hash = content_hash(&payload);

                records.push(RawRecord {
                    source_id,
                    payload,
                    content_hash: hash,
                });
            }

            if fetched < PAGE_SIZE as usize {
                break; // last page
            }
            page += 1;
        }

        info!(
            source = self.name(),
            total = records.len(),
            "fetch complete"
        );
        Ok(records)
    }
}

// ── XML response shapes ───────────────────────────────────────────────────────
//
// Actual XML structure:
// <result>
//   <youthPolicyList>
//     <youthPolicy>
//       <bizId>...</bizId>
//       <polyBizSjnm>...</polyBizSjnm>
//       ...
//     </youthPolicy>
//     ...
//   </youthPolicyList>
//   <pageIndex>1</pageIndex>
//   <display>100</display>
//   <totalCnt>1234</totalCnt>
// </result>

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct YouthCenterRoot {
    youthPolicyList: Option<YouthPolicyList>,
    #[allow(dead_code)]
    pageIndex: Option<u32>,
    #[allow(dead_code)]
    display: Option<u32>,
    #[allow(dead_code)]
    totalCnt: Option<u32>,
}

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct YouthPolicyList {
    #[serde(default)]
    youthPolicy: Vec<YouthPolicyItem>,
}

#[allow(non_snake_case)]
#[derive(Debug, Deserialize, serde::Serialize)]
pub struct YouthPolicyItem {
    /// 사업 ID (고유키)
    pub bizId: Option<String>,
    /// 사업명
    pub polyBizSjnm: Option<String>,
    /// 정책 소개
    pub polyItcnCn: Option<String>,
    /// 지원 내용
    pub sporCn: Option<String>,
    /// 신청 기간 (텍스트)
    pub rqutPrdCn: Option<String>,
    /// 신청 URL
    pub rqutUrla: Option<String>,
    /// 주관 기관
    pub mngtMson: Option<String>,
    /// 운영 기관
    pub cnsgNmor: Option<String>,
    /// 분야 코드 (023=장학금, 024=주거, 025=취업 등)
    pub polyRlmCd: Option<String>,
    /// 신청 시작일 (YYYYMMDD)
    pub aplyYmd: Option<String>,
    /// 신청 종료일 (YYYYMMDD)
    pub endYmd: Option<String>,
    /// 나이 조건 (예: "만 19세 ~ 34세")
    pub ageInfo: Option<String>,
    /// 고용 상태 코드
    pub empmSttsCd: Option<String>,
    /// 학력 코드
    pub accrRqisCd: Option<String>,
    /// 서비스 구분 코드
    pub srvcClCd: Option<String>,
    /// 지원 대상 코드
    pub sprtTrgtCd: Option<String>,
    /// 사업 기간
    pub bizPrdCn: Option<String>,
    /// 지역명 (콤마 구분)
    pub rgnNm: Option<String>,
}
