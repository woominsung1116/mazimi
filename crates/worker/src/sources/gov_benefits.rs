//! 행정안전부 지자체 서비스(공공서비스 혜택) API client
//!
//! API: https://apis.data.go.kr/B554287/LocalGovernmentService/getLocalGovernmentList
//! Env: GOV_BENEFITS_API_KEY  (data.go.kr Decoding Key)
//!
//! Response is JSON when `_type=json` is passed.
//! Field docs: https://www.data.go.kr/data/15058746/openapi.do

use anyhow::{Context, Result};
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;
use tracing::{info, warn};

use super::{content_hash, DataSource, RawRecord};

const BASE_URL: &str =
    "https://apis.data.go.kr/B554287/LocalGovernmentService/getLocalGovernmentList";
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
        let key = std::env::var("GOV_BENEFITS_API_KEY")
            .context("GOV_BENEFITS_API_KEY not set")?;
        Ok(Self::new(key))
    }

    async fn fetch_page(&self, page: u32) -> Result<GovApiResponse> {
        let text = self
            .client
            .get(BASE_URL)
            // reqwest percent-encodes query values automatically, which is
            // what data.go.kr expects for the service key.
            .query(&[
                ("serviceKey", self.api_key.as_str()),
                ("pageNo", &page.to_string()),
                ("numOfRows", &PAGE_SIZE.to_string()),
                ("_type", "json"),
            ])
            .send()
            .await
            .context("gov_benefits: HTTP request failed")?
            .error_for_status()
            .context("gov_benefits: non-2xx response")?
            .text()
            .await
            .context("gov_benefits: failed to read response body")?;

        // data.go.kr sometimes returns an XML error envelope even when JSON is
        // requested (e.g. invalid key). Detect and surface it clearly.
        if text.trim_start().starts_with('<') {
            anyhow::bail!(
                "gov_benefits: API returned XML instead of JSON (likely auth error): {}",
                &text[..text.len().min(300)]
            );
        }

        serde_json::from_str::<GovApiResponse>(&text)
            .with_context(|| format!("gov_benefits: JSON parse failed. body={}", &text[..text.len().min(300)]))
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

            // Unwrap nested response.body.items.item
            let items: Vec<GovBenefitItem> = resp
                .response
                .and_then(|r| r.body)
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
                let source_id = item
                    .servId
                    .clone()
                    .unwrap_or_else(|| format!("gov_unknown_{}", records.len()));

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

// ── Response shapes ───────────────────────────────────────────────────────────
//
// Actual JSON structure from data.go.kr:
// {
//   "response": {
//     "header": { "resultCode": "00", "resultMsg": "NORMAL SERVICE." },
//     "body": {
//       "items": { "item": [ {...}, ... ] },
//       "numOfRows": 100,
//       "pageNo": 1,
//       "totalCount": 1234
//     }
//   }
// }

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct GovApiResponse {
    response: Option<GovResponse>,
}

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct GovResponse {
    body: Option<GovBody>,
}

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct GovBody {
    items: Option<GovItems>,
}

/// The `item` field can be a single object or an array depending on count.
/// Use `#[serde(default)]` + `Option<Vec>` to handle both.
#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct GovItems {
    #[serde(deserialize_with = "deserialize_item_list")]
    item: Option<Vec<GovBenefitItem>>,
}

/// data.go.kr returns `"item": {}` (object) when there is one result and
/// `"item": [{}, ...]` (array) for multiple. This deserializer handles both.
fn deserialize_item_list<'de, D>(
    deserializer: D,
) -> Result<Option<Vec<GovBenefitItem>>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let v = Option::<Value>::deserialize(deserializer)?;
    Ok(match v {
        None => None,
        Some(Value::Array(arr)) => {
            let items: Vec<GovBenefitItem> = arr
                .into_iter()
                .filter_map(|x| serde_json::from_value(x).ok())
                .collect();
            Some(items)
        }
        Some(obj @ Value::Object(_)) => {
            serde_json::from_value::<GovBenefitItem>(obj)
                .ok()
                .map(|item| vec![item])
        }
        _ => None,
    })
}

#[allow(non_snake_case)]
#[derive(Debug, Deserialize, serde::Serialize)]
pub struct GovBenefitItem {
    /// 서비스 ID (고유키)
    pub servId: Option<String>,
    /// 서비스명
    pub servNm: Option<String>,
    /// 서비스 요약
    pub servDgst: Option<String>,
    /// 서비스 상세 설명
    pub servDtl: Option<String>,
    /// 주관 부처명
    pub jurMnofNm: Option<String>,
    /// 운영 기관명
    pub jurOrgNm: Option<String>,
    /// 서비스 URL
    pub srvUrl: Option<String>,
    /// 상시 서비스 여부 (Y/N)
    pub alwServYn: Option<String>,
    /// 신청 기간 (텍스트)
    pub applPd: Option<String>,
    /// 대상 구분 코드
    pub tgtrDvsCd: Option<String>,
    /// 대상 구분명
    pub tgtrDvsNm: Option<String>,
    /// 생애주기 배열 (동적 타입)
    pub lifeNmArray: Option<Value>,
    /// 관심 주제 배열 (동적 타입)
    pub intrsThemaArray: Option<Value>,
    /// 지원 주기명
    pub sprtCycNm: Option<String>,
    /// 지원 방법명
    pub sprtMthNm: Option<String>,
    /// 문의처
    pub inqNum: Option<String>,
    /// 생성일자
    pub creatDt: Option<String>,
    /// 최종 수정일자
    pub lastModDt: Option<String>,
}
