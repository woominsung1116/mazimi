//! 온통청년(청년정책) Open API client
//!
//! API: https://www.youthcenter.go.kr/go/ythip/getPlcy
//! Env: YOUTH_CENTER_API_KEY  (온통청년 Open API 인증키)
//!
//! Response format: JSON (2026년 신규 엔드포인트)
//! Pagination params: pageNum (1-based), pageSize

use anyhow::{Context, Result};
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;
use tracing::{info, warn};

use super::{content_hash, DataSource, RawRecord};

const BASE_URL: &str = "https://www.youthcenter.go.kr/go/ythip/getPlcy";
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
                .user_agent("Mozilla/5.0 (compatible; Mazimi-Bot/1.0; +https://mazimi.kr/bot)")
                .build()
                .unwrap_or_default(),
            api_key,
        }
    }

    pub fn from_env() -> Result<Self> {
        let key = std::env::var("YOUTH_CENTER_API_KEY").context("YOUTH_CENTER_API_KEY not set")?;
        Ok(Self::new(key))
    }

    async fn fetch_page(&self, page: u32) -> Result<YouthCenterResponse> {
        let text = self
            .client
            .get(BASE_URL)
            .query(&[
                ("apiKeyNm", self.api_key.as_str()),
                ("pageNum", &page.to_string()),
                ("pageSize", &PAGE_SIZE.to_string()),
            ])
            .send()
            .await
            .context("youth_center: HTTP request failed")?
            .error_for_status()
            .context("youth_center: non-2xx response")?
            .text()
            .await
            .context("youth_center: failed to read response body")?;

        serde_json::from_str::<YouthCenterResponse>(&text).with_context(|| {
            format!(
                "youth_center: JSON parse failed. body={}",
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

            let resp = self.fetch_page(page).await?;

            if resp.result_code != 200 {
                warn!(
                    source = self.name(),
                    code = resp.result_code,
                    msg = %resp.result_message.as_deref().unwrap_or(""),
                    "API returned error"
                );
                break;
            }

            let items = resp
                .result
                .as_ref()
                .map(|r| &r.youth_policy_list)
                .cloned()
                .unwrap_or_default();

            if items.is_empty() {
                info!(
                    source = self.name(),
                    page, "empty youthPolicyList — stopping pagination"
                );
                break;
            }

            let fetched = items.len();
            for item in items {
                let source_id = item
                    .plcy_no
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

            let total = resp
                .result
                .as_ref()
                .and_then(|r| r.pagging.as_ref())
                .map(|p| p.tot_count)
                .unwrap_or(0);
            let pages_needed = if total > 0 {
                total.div_ceil(PAGE_SIZE as u64) as u32
            } else {
                u32::MAX
            };

            if fetched < PAGE_SIZE as usize || page >= pages_needed {
                break;
            }
            page += 1;

            tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        }

        info!(
            source = self.name(),
            total = records.len(),
            "fetch complete"
        );
        Ok(records)
    }
}

// ── JSON response shapes (2026 new endpoint) ────────────────────────────────
//
// {
//   "resultCode": 200,
//   "resultMessage": "성공적으로 데이터를 가지고 왔습니다.",
//   "result": {
//     "pagging": { "totCount": 1828, "pageNum": 1, "pageSize": 100 },
//     "youthPolicyList": [ { ... }, ... ]
//   }
// }

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct YouthCenterResponse {
    result_code: u32,
    result_message: Option<String>,
    result: Option<YouthCenterResult>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct YouthCenterResult {
    pagging: Option<Pagging>,
    #[serde(default)]
    youth_policy_list: Vec<YouthPolicyItem>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Pagging {
    tot_count: u64,
}

#[allow(non_snake_case)]
#[derive(Debug, Clone, Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YouthPolicyItem {
    /// 정책 번호 (고유키)
    pub plcy_no: Option<String>,
    /// 정책명
    pub plcy_nm: Option<String>,
    /// 정책 설명
    pub plcy_expln_cn: Option<String>,
    /// 정책 지원 내용
    pub plcy_sprt_cn: Option<String>,
    /// 정책 키워드
    pub plcy_kywd_nm: Option<String>,
    /// 대분류명
    pub lclsf_nm: Option<String>,
    /// 중분류명
    pub mclsf_nm: Option<String>,
    /// 주관기관 코드명
    pub sprvsn_inst_cd_nm: Option<String>,
    /// 운영기관 코드명
    pub oper_inst_cd_nm: Option<String>,
    /// 신청 URL
    pub aply_url_addr: Option<String>,
    /// 사업기간 시작일 (YYYYMMDD)
    pub biz_prd_bgng_ymd: Option<String>,
    /// 사업기간 종료일 (YYYYMMDD)
    pub biz_prd_end_ymd: Option<String>,
    /// 신청기간 (텍스트, "YYYYMMDD ~ YYYYMMDD")
    pub aply_ymd: Option<String>,
    /// 지원대상 최소나이
    pub sprt_trgt_min_age: Option<String>,
    /// 지원대상 최대나이
    pub sprt_trgt_max_age: Option<String>,
    /// 나이제한 여부 (Y/N)
    pub sprt_trgt_age_lmt_yn: Option<String>,
    /// 지역 우편코드 (콤마 구분)
    pub zip_cd: Option<String>,
    /// 참고 URL 1
    pub ref_url_addr1: Option<String>,
    /// 참고 URL 2
    pub ref_url_addr2: Option<String>,
    /// 정책 대분류 코드
    pub plcy_major_cd: Option<String>,
    /// 소규모 사업 코드
    pub sbiz_cd: Option<String>,
    /// 조회수 (API returns string)
    pub inq_cnt: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 실제 API 호출 통합 테스트 (YOUTH_CENTER_API_KEY 환경변수 필요)
    #[tokio::test]
    #[ignore] // cargo test -- --ignored 로 실행
    async fn live_fetch_first_page() {
        let src = YouthCenterSource::from_env().expect("YOUTH_CENTER_API_KEY required");
        let resp = src.fetch_page(1).await.expect("fetch_page failed");
        assert_eq!(
            resp.result_code, 200,
            "API returned error: {:?}",
            resp.result_message
        );
        let result = resp.result.expect("result is None");
        let total = result.pagging.as_ref().map(|p| p.tot_count).unwrap_or(0);
        assert!(total > 0, "totCount should be > 0, got {total}");
        assert!(
            !result.youth_policy_list.is_empty(),
            "youthPolicyList is empty"
        );
        let first = &result.youth_policy_list[0];
        assert!(first.plcy_no.is_some(), "plcyNo missing");
        assert!(first.plcy_nm.is_some(), "plcyNm missing");
        println!(
            "OK: total={total}, first={}",
            first.plcy_nm.as_deref().unwrap_or("?")
        );
    }
}
