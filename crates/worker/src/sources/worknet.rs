//! 고용24(워크넷) 청년 인턴십/채용 API client
//!
//! API: https://apis.data.go.kr/B552583/Job/getJobList
//! Env: WORKNET_API_KEY  (data.go.kr Decoding Key; defaults to GOV_API_KEY)
//!
//! Response format: XML
//! Regions filtered: 부산(26xxx), 대구(27xxx)
//! Pagination params: pageNo (1-based), numOfRows

use anyhow::{Context, Result};
use quick_xml::de::from_str as xml_from_str;
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;
use tracing::{info, warn};

use super::{content_hash, DataSource, RawRecord};

const BASE_URL: &str = "https://apis.data.go.kr/B552583/Job/getJobList";
const PAGE_SIZE: u32 = 100;

/// Region codes to filter: 부산(26xxx) and 대구(27xxx).
/// The API accepts a single region code per request, so we iterate over both.
const REGION_CODES: &[&str] = &["26000", "27000"];

pub struct WorknetSource {
    client: Client,
    api_key: String,
}

impl WorknetSource {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .unwrap_or_default(),
            api_key,
        }
    }

    /// Reads WORKNET_API_KEY, falling back to GOV_API_KEY.
    pub fn from_env() -> Result<Self> {
        let key = std::env::var("WORKNET_API_KEY")
            .or_else(|_| std::env::var("GOV_API_KEY"))
            .context("WORKNET_API_KEY (or GOV_API_KEY) not set")?;
        Ok(Self::new(key))
    }

    async fn fetch_page(&self, region: &str, page: u32) -> Result<WorknetRoot> {
        let text = self
            .client
            .get(BASE_URL)
            .query(&[
                ("serviceKey", self.api_key.as_str()),
                ("pageNo", &page.to_string()),
                ("numOfRows", &PAGE_SIZE.to_string()),
                ("region", region),
            ])
            .send()
            .await
            .context("worknet: HTTP request failed")?
            .error_for_status()
            .context("worknet: non-2xx response")?
            .text()
            .await
            .context("worknet: failed to read response body")?;

        xml_from_str::<WorknetRoot>(&text).with_context(|| {
            format!(
                "worknet: XML parse failed. region={region} page={page} body={}",
                &text[..text.len().min(500)]
            )
        })
    }
}

impl DataSource for WorknetSource {
    fn name(&self) -> &'static str {
        "worknet"
    }

    async fn fetch_all(&self) -> Result<Vec<RawRecord>> {
        let mut records: Vec<RawRecord> = Vec::new();

        for &region in REGION_CODES {
            let mut page = 1u32;
            loop {
                info!(source = self.name(), region, page, "fetching page");

                let root = self.fetch_page(region, page).await?;

                let items: Vec<WorknetJobItem> = root
                    .body
                    .and_then(|b| b.items)
                    .and_then(|i| i.item)
                    .unwrap_or_default();

                if items.is_empty() {
                    warn!(
                        source = self.name(),
                        region, page, "empty item list — stopping pagination"
                    );
                    break;
                }

                let fetched = items.len();
                for item in items {
                    // Use wantedAuthNo as the stable source ID
                    let source_id = item
                        .wantedAuthNo
                        .clone()
                        .filter(|s| !s.is_empty())
                        .unwrap_or_else(|| format!("wn_unknown_{}", records.len()));

                    let payload = serde_json::to_value(&item).unwrap_or(Value::Null);
                    let hash = content_hash(&payload);

                    records.push(RawRecord {
                        source_id,
                        payload,
                        content_hash: hash,
                    });
                }

                if fetched < PAGE_SIZE as usize {
                    break; // last page for this region
                }
                page += 1;
            }
        }

        info!(source = self.name(), total = records.len(), "fetch complete");
        Ok(records)
    }
}

// ── XML response shapes ───────────────────────────────────────────────────────
//
// Expected XML structure (data.go.kr standard envelope):
// <response>
//   <header>
//     <resultCode>00</resultCode>
//     <resultMsg>NORMAL SERVICE.</resultMsg>
//   </header>
//   <body>
//     <items>
//       <item>
//         <wantedAuthNo>...</wantedAuthNo>
//         <company>...</company>
//         <title>...</title>
//         <salTxt>...</salTxt>
//         <region>...</region>
//         <empType>...</empType>
//         <closeDt>...</closeDt>
//       </item>
//     </items>
//     <numOfRows>100</numOfRows>
//     <pageNo>1</pageNo>
//     <totalCount>...</totalCount>
//   </body>
// </response>

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct WorknetRoot {
    body: Option<WorknetBody>,
}

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct WorknetBody {
    items: Option<WorknetItems>,
    #[allow(dead_code)]
    numOfRows: Option<u32>,
    #[allow(dead_code)]
    pageNo: Option<u32>,
    #[allow(dead_code)]
    totalCount: Option<u32>,
}

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct WorknetItems {
    #[serde(default)]
    item: Option<Vec<WorknetJobItem>>,
}

#[allow(non_snake_case)]
#[derive(Debug, Deserialize, serde::Serialize)]
pub struct WorknetJobItem {
    /// 구인 인증 번호 (고유키)
    pub wantedAuthNo: Option<String>,
    /// 회사명
    pub company: Option<String>,
    /// 직종명 / 채용 제목
    pub title: Option<String>,
    /// 급여 텍스트 (예: "월 200만원")
    pub salTxt: Option<String>,
    /// 지역명 (예: "부산 해운대구")
    pub region: Option<String>,
    /// 고용 형태 (예: "정규직", "인턴")
    pub empType: Option<String>,
    /// 마감일 (YYYYMMDD 또는 "수시채용")
    pub closeDt: Option<String>,
    /// 직종 코드
    pub occupation: Option<String>,
    /// 지원 URL
    pub wantedInfoUrl: Option<String>,
}
