//! 한국장학재단(KOSAF) 장학금 Open API client
//!
//! API: https://apis.data.go.kr/B490007/sjservice1/getScholarshipList
//! Env: KOSAF_API_KEY  (data.go.kr Decoding Key; defaults to GOV_API_KEY)
//!
//! Response format: XML
//! Pagination params: pageNo (1-based), numOfRows

use anyhow::{Context, Result};
use quick_xml::de::from_str as xml_from_str;
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;
use tracing::{info, warn};

use super::{content_hash, DataSource, RawRecord};

const BASE_URL: &str = "https://apis.data.go.kr/B490007/sjservice1/getScholarshipList";
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

    async fn fetch_page(&self, page: u32) -> Result<ScholarshipRoot> {
        let text = self
            .client
            .get(BASE_URL)
            .query(&[
                ("serviceKey", self.api_key.as_str()),
                ("pageNo", &page.to_string()),
                ("numOfRows", &PAGE_SIZE.to_string()),
            ])
            .send()
            .await
            .context("scholarship: HTTP request failed")?
            .error_for_status()
            .context("scholarship: non-2xx response")?
            .text()
            .await
            .context("scholarship: failed to read response body")?;

        xml_from_str::<ScholarshipRoot>(&text).with_context(|| {
            format!(
                "scholarship: XML parse failed. page={page} body={}",
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

            let root = self.fetch_page(page).await?;

            let items: Vec<ScholarshipItem> = root
                .body
                .and_then(|b| b.items)
                .and_then(|i| i.item)
                .unwrap_or_default();

            if items.is_empty() {
                warn!(
                    source = self.name(),
                    page, "empty item list — stopping pagination"
                );
                break;
            }

            let fetched = items.len();
            for item in items {
                // Use schlCode (장학금 코드) as the stable source ID
                let source_id = item
                    .schlCode
                    .clone()
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| format!("ks_unknown_{}", records.len()));

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
//         <schlCode>...</schlCode>
//         <schlNm>...</schlNm>
//         <organName>...</organName>
//         <supAmt>...</supAmt>
//         <trgtCn>...</trgtCn>
//         <rcptEndDt>...</rcptEndDt>
//         <rcptStDt>...</rcptStDt>
//       </item>
//     </items>
//     <numOfRows>100</numOfRows>
//     <pageNo>1</pageNo>
//     <totalCount>...</totalCount>
//   </body>
// </response>

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct ScholarshipRoot {
    body: Option<ScholarshipBody>,
}

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct ScholarshipBody {
    items: Option<ScholarshipItems>,
    #[allow(dead_code)]
    numOfRows: Option<u32>,
    #[allow(dead_code)]
    pageNo: Option<u32>,
    #[allow(dead_code)]
    totalCount: Option<u32>,
}

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct ScholarshipItems {
    #[serde(default)]
    item: Option<Vec<ScholarshipItem>>,
}

#[allow(non_snake_case)]
#[derive(Debug, Deserialize, serde::Serialize)]
pub struct ScholarshipItem {
    /// 장학금 코드 (고유키)
    pub schlCode: Option<String>,
    /// 장학금명
    pub schlNm: Option<String>,
    /// 운영 기관명
    pub organName: Option<String>,
    /// 지원 금액 (텍스트, 예: "등록금 전액")
    pub supAmt: Option<String>,
    /// 지원 대상 조건 (텍스트)
    pub trgtCn: Option<String>,
    /// 접수 시작일 (YYYYMMDD)
    pub rcptStDt: Option<String>,
    /// 접수 마감일 (YYYYMMDD)
    pub rcptEndDt: Option<String>,
    /// 학교 구분 (예: "대학교", "대학원")
    pub schlDivNm: Option<String>,
    /// 장학금 유형 (예: "교내", "교외")
    pub schlTypeNm: Option<String>,
    /// 공식 URL
    pub url: Option<String>,
}
