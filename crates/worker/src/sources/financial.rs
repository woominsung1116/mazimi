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

    // 청년 연령 파싱: join_member(가입 대상)가 1순위, 거기서 못 뽑으면
    // etc_note(기타 유의사항)를 보조로 시도한다. 둘 다 못 뽑으면 None 유지
    // (과파싱 금지 — 추측성 나이 채우기 안 함).
    let join_member_text = payload["join_member"].as_str().unwrap_or("");
    let (mut min_age, mut max_age) = parse_age_range_from_text(join_member_text);
    if min_age.is_none() && max_age.is_none() {
        let etc_note_text = payload["etc_note"].as_str().unwrap_or("");
        let (min2, max2) = parse_age_range_from_text(etc_note_text);
        min_age = min2;
        max_age = max2;
    }

    NormalizedProgram {
        program_type: "financial_product".to_string(),
        title,
        summary,
        provider_name,
        official_url,
        application_start_at,
        application_end_at,
        min_age,
        max_age,
        regions: vec![],
        application_method: None,
        submission_documents: None,
        screening_method: None,
    }
}

// ── Age-range text parsing ─────────────────────────────────────────────────
//
// finlife 가입대상(join_member)/기타유의사항(etc_note) 필드는 자유 텍스트라
// "만 19~34세", "만19세~34세", "19세이상 34세이하", "만 34세 이하" 같은
// 변형이 섞여 나온다. `crates/worker/src/sources/youth_center.rs`와
// `pipeline.rs`는 온통청년 API가 이미 구조화된 숫자 필드(sprtTrgtMinAge/
// sprtTrgtMaxAge)로 내려주기 때문에 텍스트 파싱 로직이 없다 (Search Before
// Building 확인 완료 — 재사용할 기존 정규식/파서가 없어 새로 작성).

/// 두 숫자를 잇는 나이 범위 구분자 문자 (물결표/하이픈/대시 변형 포함).
const AGE_RANGE_SEPARATORS: [char; 5] = ['~', '-', '∼', '–', '—'];

/// 자유 텍스트에서 한국어 나이 표현을 파싱해 (min_age, max_age)를 뽑아낸다.
///
/// 인식하는 표현 (공백 유무 무관):
///   - "만 19~34세", "19-34세"        → (Some(19), Some(34))
///   - "만19세~34세"                  → (Some(19), Some(34))
///   - "19세이상 34세이하"            → (Some(19), Some(34))
///   - "만 34세 이하"                 → (None, Some(34))
///   - "만 19세 이상"                 → (Some(19), None)
///   - "19세부터 34세까지"            → (Some(19), Some(34))
///
/// 앵커링 규칙: 숫자는 (공백 제거 후) 바로 뒤에 한국어 나이 단위 "세"가
/// 붙어 있을 때만 나이 후보로 인정한다. 단, "<숫자><구분자><숫자>세"
/// 범위 표현에서는 앞쪽 숫자는 "세"가 없어도 뒤쪽 숫자가 "세"로 앵커링되면
/// 함께 인정한다. 이 규칙 덕분에 같은 문자열에 섞여 있는 무관한 숫자
/// (대출한도, 예치금액, 개월수, 전화번호 등)를 나이로 오인하지 않는다.
/// 확신할 수 있는 표현을 찾지 못하면 항상 (None, None)을 반환한다 —
/// 추측성 파싱 금지.
pub(crate) fn parse_age_range_from_text(text: &str) -> (Option<i32>, Option<i32>) {
    let compact: String = text.chars().filter(|c| !c.is_whitespace()).collect();

    // 최소 전제조건: 위에서 인식하는 모든 표현은 "세"를 포함한다.
    // 없으면 파싱을 시도할 필요조차 없다 (예: "1인당 최대 3천만원 이하").
    if !compact.contains('세') {
        return (None, None);
    }

    let chars: Vec<char> = compact.chars().collect();
    let len = chars.len();

    // 나이 후보 숫자 런: (시작, 끝(제외), 값). 사람 나이로 말이 안 되는
    // 값(연도 "2024" 등)은 애초에 후보 목록에서 제외한다.
    let mut numbers: Vec<(usize, usize, i32)> = Vec::new();
    let mut i = 0;
    while i < len {
        if chars[i].is_ascii_digit() {
            let start = i;
            let mut j = i;
            while j < len && chars[j].is_ascii_digit() {
                j += 1;
            }
            let value: String = chars[start..j].iter().collect();
            if let Ok(v) = value.parse::<i32>() {
                if (0..=120).contains(&v) {
                    numbers.push((start, j, v));
                }
            }
            i = j;
        } else {
            i += 1;
        }
    }

    if numbers.is_empty() {
        return (None, None);
    }

    let is_anchored = |end: usize| -> bool { chars.get(end) == Some(&'세') };

    let starts_with_at = |pos: usize, needle: &str| -> bool {
        let needle_chars: Vec<char> = needle.chars().collect();
        if pos + needle_chars.len() > len {
            return false;
        }
        chars[pos..pos + needle_chars.len()] == needle_chars[..]
    };

    let mut min_age: Option<i32> = None;
    let mut max_age: Option<i32> = None;
    let mut consumed = vec![false; numbers.len()];

    for idx in 0..numbers.len() {
        if consumed[idx] {
            continue;
        }
        let (_, end, val) = numbers[idx];
        let anchored = is_anchored(end);
        // "세"가 바로 붙어 있으면 그 다음 글자부터, 아니면 숫자 바로 다음
        // 글자부터 구분자/표지를 찾는다. "만19세~34세"처럼 범위 앞쪽
        // 숫자에도 "세"가 중복으로 붙는 변형을 지원하려면, 앵커링됐다고
        // 해서 무조건 이상/이하 표지로 확정 짓지 않고 실패 시 구분자
        // 확인으로 계속 진행해야 한다.
        let cursor = if anchored { end + 1 } else { end };

        if anchored {
            if starts_with_at(cursor, "이상") || starts_with_at(cursor, "부터") {
                min_age = Some(val);
                continue;
            } else if starts_with_at(cursor, "이하") || starts_with_at(cursor, "까지") {
                max_age = Some(val);
                continue;
            }
        }

        // "<숫자><구분자><숫자>세" 범위 표현 확인 (앞쪽 숫자가 "세"로
        // 앵커링됐든 안 됐든 동일하게 검사).
        if let Some(sep) = chars.get(cursor) {
            if AGE_RANGE_SEPARATORS.contains(sep) {
                let next_start = cursor + 1;
                if let Some(&(n_start, n_end, n_val)) = numbers.get(idx + 1) {
                    if n_start == next_start && is_anchored(n_end) {
                        min_age = Some(val);
                        max_age = Some(n_val);
                        consumed[idx + 1] = true;
                    }
                }
            }
        }
    }

    (min_age, max_age)
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

#[cfg(test)]
mod age_range_tests {
    use super::*;

    // ── 정상 케이스 ──────────────────────────────────────────────────────

    #[test]
    fn tilde_range_with_man_prefix() {
        assert_eq!(
            parse_age_range_from_text("만 19~34세"),
            (Some(19), Some(34))
        );
    }

    #[test]
    fn ideal_and_iha_range_with_spacing() {
        assert_eq!(
            parse_age_range_from_text("19세이상 34세이하"),
            (Some(19), Some(34))
        );
    }

    #[test]
    fn max_only_with_man_prefix() {
        assert_eq!(parse_age_range_from_text("만 34세 이하"), (None, Some(34)));
    }

    #[test]
    fn min_only() {
        assert_eq!(parse_age_range_from_text("만 19세 이상"), (Some(19), None));
    }

    // ── 변형 케이스 ──────────────────────────────────────────────────────

    #[test]
    fn se_suffix_on_both_sides_of_tilde() {
        assert_eq!(
            parse_age_range_from_text("만19세~34세"),
            (Some(19), Some(34))
        );
    }

    #[test]
    fn hyphen_separator_no_spaces() {
        assert_eq!(parse_age_range_from_text("19-34세"), (Some(19), Some(34)));
    }

    #[test]
    fn no_spaces_iha_ideal_combined() {
        assert_eq!(
            parse_age_range_from_text("만19세이상34세이하실명의개인"),
            (Some(19), Some(34))
        );
    }

    #[test]
    fn buteo_kkaji_range() {
        assert_eq!(
            parse_age_range_from_text("19세부터 34세까지"),
            (Some(19), Some(34))
        );
    }

    #[test]
    fn embedded_in_longer_eligibility_sentence() {
        assert_eq!(
            parse_age_range_from_text("만 19세 이상 34세 이하의 실명 개인 (1인 1계좌)"),
            (Some(19), Some(34))
        );
    }

    // ── 파싱 불가 케이스 (과파싱 금지 확인) ────────────────────────────────

    #[test]
    fn no_digits_returns_none() {
        assert_eq!(parse_age_range_from_text("실명의 개인"), (None, None));
    }

    #[test]
    fn explicit_no_restriction_returns_none() {
        assert_eq!(parse_age_range_from_text("제한없음"), (None, None));
    }

    #[test]
    fn bare_number_without_qualifier_returns_none() {
        // "세"로 앵커링은 되지만 이상/이하/부터/까지 표지가 전혀 없으면
        // 추측하지 않고 None을 유지해야 한다.
        assert_eq!(parse_age_range_from_text("만 20세 회원"), (None, None));
    }

    #[test]
    fn unrelated_amount_with_iha_but_no_se_returns_none() {
        // "이하"라는 단어가 있어도 나이 단위 "세"가 전혀 없으면 (대출한도
        // 등 무관한 숫자이므로) 파싱하지 않는다.
        assert_eq!(
            parse_age_range_from_text("1인당 최대 3천만원 이하"),
            (None, None)
        );
    }

    #[test]
    fn household_count_without_qualifier_not_misread_as_age() {
        // "100세대"처럼 "세"로 끝나는 무관한 단어가 있어도 이상/이하 표지가
        // 없으면 나이로 오인하지 않는다 (앵커링만으로는 값 확정 안 함).
        assert_eq!(
            parse_age_range_from_text("선착순 100세대 모집"),
            (None, None)
        );
    }

    #[test]
    fn unrelated_iha_on_non_age_unit_ignored_but_true_age_still_found() {
        // "12개월 이상"은 나이가 아니라 가입기간이므로 무시하고, 뒤에 나오는
        // "만 29세 이하"만 정확히 뽑아야 한다.
        assert_eq!(
            parse_age_range_from_text("가입기간 12개월 이상, 만 29세 이하 가입 가능"),
            (None, Some(29))
        );
    }

    #[test]
    fn empty_string_returns_none() {
        assert_eq!(parse_age_range_from_text(""), (None, None));
    }
}
