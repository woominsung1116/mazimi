//! 한국장학재단(KOSAF) 장학금 Open API client
//!
//! API: https://api.odcloud.kr/api/15028252/v1/uddi:d0fb69e9-e143-412d-9fe0-b0d87a16f3ff
//! Env: KOSAF_API_KEY
//!
//! Response format: JSON (flat data array)
//! Pagination: page (1-based), perPage

use anyhow::{Context, Result};
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;
use tracing::{info, warn};

use super::{content_hash, DataSource, RawRecord};

const BASE_URL: &str =
    "https://api.odcloud.kr/api/15028252/v1/uddi:d0fb69e9-e143-412d-9fe0-b0d87a16f3ff";
const PAGE_SIZE: u32 = 100;

pub struct ScholarshipSource {
    client: Client,
    api_key: String,
}

impl ScholarshipSource {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .unwrap_or_default(),
            api_key,
        }
    }

    /// Reads KOSAF_API_KEY, falling back to GOV_API_KEY.
    pub fn from_env() -> Result<Self> {
        let key = std::env::var("KOSAF_API_KEY")
            .or_else(|_| std::env::var("GOV_API_KEY"))
            .context("KOSAF_API_KEY (or GOV_API_KEY) not set")?;
        Ok(Self::new(key))
    }

    async fn fetch_page(&self, page: u32) -> Result<ScholarshipApiResponse> {
        let text = self
            .client
            .get(BASE_URL)
            .query(&[
                ("serviceKey", self.api_key.as_str()),
                ("page", &page.to_string()),
                ("perPage", &PAGE_SIZE.to_string()),
            ])
            .send()
            .await
            .context("scholarship: HTTP request failed")?
            .error_for_status()
            .context("scholarship: non-2xx response")?
            .text()
            .await
            .context("scholarship: failed to read response body")?;

        serde_json::from_str::<ScholarshipApiResponse>(&text).with_context(|| {
            format!(
                "scholarship: JSON parse failed. page={page} body={}",
                &text[..text.len().min(500)]
            )
        })
    }
}

impl DataSource for ScholarshipSource {
    fn name(&self) -> &'static str {
        "scholarship"
    }

    async fn fetch_all(&self) -> Result<Vec<RawRecord>> {
        let mut records = Vec::new();
        let mut page = 1u32;

        loop {
            info!(source = self.name(), page, "fetching page");

            let resp = self.fetch_page(page).await?;
            let items = resp.data.unwrap_or_default();

            if items.is_empty() {
                warn!(
                    source = self.name(),
                    page, "empty item list — stopping pagination"
                );
                break;
            }

            let fetched = items.len();
            for item in items {
                // Use 상품명 + 운영기관명 combo as a stable source ID since
                // the API does not expose a numeric code.
                let name = item.get("상품명").and_then(|v| v.as_str()).unwrap_or("");
                let org = item
                    .get("운영기관명")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let source_id = if name.is_empty() && org.is_empty() {
                    format!("ks_unknown_{}", records.len())
                } else {
                    format!("{}_{}", org, name)
                };

                let hash = content_hash(&item);

                records.push(RawRecord {
                    source_id,
                    payload: item,
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

// ── Response shapes ───────────────────────────────────────────────────────────
//
// {
//   "currentCount": 100,
//   "data": [{
//     "상품명": "행복나눔 장학생",
//     "상품구분": "장학금",
//     "운영기관명": "광주남구장학회",
//     "대학구분": "4년제",
//     "학과구분": "제한없음",
//     "학년구분": "대학2학기,...",
//     "모집시작일": "2024-09-23",
//     "모집종료일": "2024-10-11",
//     "선발인원 상세내용": "12명",
//     "성적기준 상세내용": "...",
//     "소득기준 상세내용": "...",
//     "지원내역 상세내용": "1인당 100만원",
//     "학자금유형구분": "지역연고",
//     "홈페이지 주소": "https://...",
//     "제출서류 상세내용": "...",
//     "지역거주여부 상세내용": "..."
//   }],
//   "matchCount": 1646,
//   "page": 1,
//   "perPage": 100,
//   "totalCount": 1646
// }

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct ScholarshipApiResponse {
    data: Option<Vec<Value>>,
    #[allow(dead_code)]
    totalCount: Option<u64>,
    #[allow(dead_code)]
    currentCount: Option<u64>,
    #[allow(dead_code)]
    page: Option<u64>,
    #[allow(dead_code)]
    perPage: Option<u64>,
}
