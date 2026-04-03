//! 정부24 공공서비스 혜택 API client
//!
//! API: https://api.odcloud.kr/api/gov24/v3/serviceList
//! Env: GOV_BENEFITS_API_KEY
//!
//! Response is JSON with flat `data` array.
//! Pagination: page (1-based), perPage

use anyhow::{Context, Result};
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;
use tracing::{info, warn};

use super::{content_hash, DataSource, RawRecord};

const BASE_URL: &str = "https://api.odcloud.kr/api/gov24/v3/serviceList";
const PAGE_SIZE: u32 = 100;

pub struct GovBenefitsSource {
    client: Client,
    api_key: String,
}

impl GovBenefitsSource {
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
        let key = std::env::var("GOV_BENEFITS_API_KEY").context("GOV_BENEFITS_API_KEY not set")?;
        Ok(Self::new(key))
    }

    async fn fetch_page(&self, page: u32) -> Result<GovApiResponse> {
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
            .context("gov_benefits: HTTP request failed")?
            .error_for_status()
            .context("gov_benefits: non-2xx response")?
            .text()
            .await
            .context("gov_benefits: failed to read response body")?;

        serde_json::from_str::<GovApiResponse>(&text).with_context(|| {
            format!(
                "gov_benefits: JSON parse failed. body={}",
                &text[..text.len().min(300)]
            )
        })
    }
}

impl DataSource for GovBenefitsSource {
    fn name(&self) -> &'static str {
        "gov_benefits"
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
                let source_id = item
                    .get("서비스ID")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| format!("gov_unknown_{}", records.len()));

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
//     "서비스ID": "000000465790",
//     "서비스명": "...",
//     "서비스목적요약": "...",
//     "서비스분야": "보육·교육",
//     "소관기관명": "교육부",
//     "지원대상": "...",
//     "지원내용": "...",
//     "선정기준": "...",
//     "신청방법": "...",
//     "신청기한": "상시신청",
//     "상세조회URL": "https://www.gov.kr/...",
//     "전화문의": "...",
//     "지원유형": "현금(감면)"
//   }],
//   "matchCount": 10921,
//   "page": 1,
//   "perPage": 100,
//   "totalCount": 10921
// }

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct GovApiResponse {
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
