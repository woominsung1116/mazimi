//! 금융감독원 금융상품 비교공시 API client
//!
//! APIs:
//!   예금: https://finlife.fss.or.kr/finlifeapi/depositProductsSearch.json
//!   적금: https://finlife.fss.or.kr/finlifeapi/savingProductsSearch.json
//!   대출: https://finlife.fss.or.kr/finlifeapi/mortgageLoanProductsSearch.json
//!
//! Env: FSS_API_KEY  (금융감독원 금융상품 비교공시 API 인증키)
//! Auth: query param `auth`
//!
//! Filters: only products with "청년" in name or description.

use anyhow::{Context, Result};
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;
use tracing::{info, warn};

use super::{content_hash, DataSource, RawRecord};

const DEPOSIT_URL: &str = "https://finlife.fss.or.kr/finlifeapi/depositProductsSearch.json";
const SAVING_URL: &str = "https://finlife.fss.or.kr/finlifeapi/savingProductsSearch.json";
const LOAN_URL: &str = "https://finlife.fss.or.kr/finlifeapi/mortgageLoanProductsSearch.json";
const PAGE_SIZE: u32 = 100;

/// Product category for tagging and normalization.
#[derive(Debug, Clone, Copy)]
pub enum FssProductKind {
    Deposit,
    Saving,
    Loan,
}

impl FssProductKind {
    fn base_url(&self) -> &'static str {
        match self {
            Self::Deposit => DEPOSIT_URL,
            Self::Saving => SAVING_URL,
            Self::Loan => LOAN_URL,
        }
    }

    fn source_prefix(&self) -> &'static str {
        match self {
            Self::Deposit => "fss_deposit",
            Self::Saving => "fss_saving",
            Self::Loan => "fss_loan",
        }
    }

    fn tag(&self) -> &'static str {
        match self {
            Self::Deposit => "예금",
            Self::Saving => "적금",
            Self::Loan => "대출",
        }
    }
}

pub struct FssFinancialSource {
    client: Client,
    api_key: String,
}

impl FssFinancialSource {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .user_agent("Mozilla/5.0 (compatible; Mazimi-Bot/1.0; +https://mazimi.kr/bot)")
                .build()
                .unwrap_or_default(),
            api_key,
        }
    }

    /// Returns None (and logs a warning) when FSS_API_KEY is not set so the
    /// sync pipeline can skip this source gracefully.
    pub fn from_env() -> Option<Self> {
        match std::env::var("FSS_API_KEY") {
            Ok(key) if !key.is_empty() => Some(Self::new(key)),
            _ => {
                warn!("FSS_API_KEY not set — skipping 금융감독원 financial product sync");
                None
            }
        }
    }

    async fn fetch_kind_page(&self, kind: FssProductKind, page: u32) -> Result<FssApiResponse> {
        let url = kind.base_url();
        let text = self
            .client
            .get(url)
            .query(&[
                ("auth", self.api_key.as_str()),
                ("pageNo", &page.to_string()),
                ("numOfRows", &PAGE_SIZE.to_string()),
                ("financeCd", ""),         // empty = all institution types
                ("topFinGrpNo", "020000"), // 은행권 (banks)
            ])
            .send()
            .await
            .with_context(|| {
                format!(
                    "fss_financial: HTTP request failed for {:?}",
                    kind.source_prefix()
                )
            })?
            .error_for_status()
            .with_context(|| {
                format!(
                    "fss_financial: non-2xx response for {:?}",
                    kind.source_prefix()
                )
            })?
            .text()
            .await
            .with_context(|| {
                format!(
                    "fss_financial: failed to read response body for {:?}",
                    kind.source_prefix()
                )
            })?;

        serde_json::from_str::<FssApiResponse>(&text).with_context(|| {
            format!(
                "fss_financial: JSON parse failed for {}. body={}",
                kind.source_prefix(),
                &text[..text.len().min(300)]
            )
        })
    }

    /// Fetch all pages for a single product kind and return only records
    /// whose name or description contains "청년".
    async fn fetch_kind_all(&self, kind: FssProductKind) -> Result<Vec<RawRecord>> {
        let mut records = Vec::new();
        let mut page = 1u32;

        loop {
            info!(
                source = "fss_financial",
                kind = kind.source_prefix(),
                page,
                "fetching page"
            );

            let resp = self.fetch_kind_page(kind, page).await?;

            let products: Vec<FssBaseProduct> =
                resp.result.and_then(|r| r.baseList).unwrap_or_default();

            if products.is_empty() {
                warn!(
                    source = "fss_financial",
                    kind = kind.source_prefix(),
                    page,
                    "empty product list — stopping pagination"
                );
                break;
            }

            let fetched = products.len();

            for product in products {
                // Filter: only keep products with "청년" in name or description.
                let name = product.fin_prdt_nm.as_deref().unwrap_or("");
                let desc = product.etc_note.as_deref().unwrap_or("");
                if !name.contains("청년") && !desc.contains("청년") {
                    continue;
                }

                let source_id = format!(
                    "{}_{}_{}",
                    kind.source_prefix(),
                    product.fin_co_no.as_deref().unwrap_or("unknown"),
                    product.fin_prdt_cd.as_deref().unwrap_or("unknown"),
                );

                // Embed kind tag so normalization can distinguish.
                let mut payload = serde_json::to_value(&product).unwrap_or(Value::Null);
                if let Value::Object(ref mut map) = payload {
                    map.insert(
                        "_fss_kind".to_string(),
                        Value::String(kind.tag().to_string()),
                    );
                    map.insert(
                        "_source_prefix".to_string(),
                        Value::String(kind.source_prefix().to_string()),
                    );
                }

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

        Ok(records)
    }
}

impl DataSource for FssFinancialSource {
    fn name(&self) -> &'static str {
        "fss_financial"
    }

    async fn fetch_all(&self) -> Result<Vec<RawRecord>> {
        let mut all = Vec::new();

        for kind in [
            FssProductKind::Deposit,
            FssProductKind::Saving,
            FssProductKind::Loan,
        ] {
            match self.fetch_kind_all(kind).await {
                Ok(mut records) => {
                    info!(
                        source = self.name(),
                        kind = kind.source_prefix(),
                        count = records.len(),
                        "kind fetch complete"
                    );
                    all.append(&mut records);
                }
                Err(e) => {
                    warn!(
                        source = self.name(),
                        kind = kind.source_prefix(),
                        error = %e,
                        "kind fetch failed, skipping"
                    );
                }
            }
        }

        info!(source = self.name(), total = all.len(), "fetch complete");
        Ok(all)
    }
}

// ── Response shapes ───────────────────────────────────────────────────────────
//
// FSS API response shape:
// {
//   "result": {
//     "pageNo": 1,
//     "numOfRows": 100,
//     "totalCnt": 42,
//     "max_page_no": 1,
//     "err_cd": "000",
//     "err_msg": "정상",
//     "baseList": [ { ... }, ... ],
//     "optionList": [ { ... }, ... ]
//   }
// }

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct FssApiResponse {
    result: Option<FssResult>,
}

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct FssResult {
    baseList: Option<Vec<FssBaseProduct>>,
}

/// Common base product fields shared across deposit, saving, and loan APIs.
/// Fields not present in a given product type will deserialize as None.
#[allow(non_snake_case)]
#[derive(Debug, Deserialize, serde::Serialize)]
pub struct FssBaseProduct {
    /// 금융회사 코드
    pub fin_co_no: Option<String>,
    /// 금융회사명
    pub kor_co_nm: Option<String>,
    /// 금융상품 코드
    pub fin_prdt_cd: Option<String>,
    /// 금융상품명
    pub fin_prdt_nm: Option<String>,
    /// 가입 방법
    pub join_way: Option<String>,
    /// 만기 후 이자율 방식
    pub mtrt_int: Option<String>,
    /// 기타 유의사항 / 상품 설명
    pub etc_note: Option<String>,
    /// 최고 한도 (대출 상품)
    pub loan_lmt: Option<String>,
    /// 대출 종류명 (대출 상품)
    pub loan_type_nm: Option<String>,
    /// 공시 시작일
    pub dcls_strt_day: Option<String>,
    /// 공시 종료일
    pub dcls_end_day: Option<String>,
    /// 금융회사 제출일
    pub fin_co_subm_day: Option<String>,
    /// 가입 대상
    pub join_member: Option<String>,
    /// 최저 납입 금액 (적금)
    pub rsrv_type_nm: Option<String>,
}

// ── Normalization helper (called from pipeline.rs) ────────────────────────────

use crate::pipeline::NormalizedProgram;

/// Normalize a raw FSS financial product payload into a NormalizedProgram.
pub fn normalize_financial(payload: &Value) -> NormalizedProgram {
    let kind_tag = payload["_fss_kind"].as_str().unwrap_or("금융상품");

    let institution = payload["kor_co_nm"].as_str().unwrap_or("").to_string();
    let product_name = payload["fin_prdt_nm"]
        .as_str()
        .unwrap_or("Unknown")
        .to_string();

    // Title: "은행명 - 상품명 (종류)"
    let title = if institution.is_empty() {
        format!("{} ({})", product_name, kind_tag)
    } else {
        format!("{} - {} ({})", institution, product_name, kind_tag)
    };

    // Summary: join_member (가입 대상) first, fall back to etc_note.
    let summary = payload["join_member"]
        .as_str()
        .filter(|s| !s.is_empty())
        .or_else(|| payload["etc_note"].as_str().filter(|s| !s.is_empty()))
        .map(|s| s.to_string());

    let provider_name = if institution.is_empty() {
        None
    } else {
        Some(institution)
    };

    // FSS product page URL is not returned by the API; use the portal URL.
    let official_url: Option<String> = Some("https://finlife.fss.or.kr/main/main.do".to_string());

    // dcls_strt_day / dcls_end_day are "YYYYMMDD" strings.
    let application_start_at = parse_fss_date(payload["dcls_strt_day"].as_str());
    let application_end_at = parse_fss_date(payload["dcls_end_day"].as_str());

    NormalizedProgram {
        program_type: "financial_product".to_string(),
        title,
        summary,
        provider_name,
        official_url,
        application_start_at,
        application_end_at,
        min_age: None,
        max_age: None,
        regions: vec![],
    }
}

/// Parse FSS date strings. Accepts "YYYYMMDD" (8 digits) or "YYYY.MM.DD".
fn parse_fss_date(s: Option<&str>) -> Option<chrono::DateTime<chrono::Utc>> {
    let s = s?.trim();
    if s.is_empty() {
        return None;
    }

    // "YYYYMMDD"
    if s.len() == 8 && s.chars().all(|c| c.is_ascii_digit()) {
        let year: i32 = s[0..4].parse().ok()?;
        let month: u32 = s[4..6].parse().ok()?;
        let day: u32 = s[6..8].parse().ok()?;
        return chrono::NaiveDate::from_ymd_opt(year, month, day)
            .and_then(|d| d.and_hms_opt(0, 0, 0))
            .map(|dt| dt.and_utc());
    }

    // "YYYY.MM.DD" or "YYYY-MM-DD"
    let parts: Vec<u32> = s
        .split(|c: char| !c.is_ascii_digit())
        .filter(|t| !t.is_empty())
        .filter_map(|t| t.parse().ok())
        .collect();

    match parts.as_slice() {
        [y, m, d] if *y >= 2000 && *y <= 2100 => chrono::NaiveDate::from_ymd_opt(*y as i32, *m, *d)
            .and_then(|nd| nd.and_hms_opt(0, 0, 0))
            .map(|dt| dt.and_utc()),
        _ => None,
    }
}
