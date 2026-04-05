//! 한국사회보장정보원 중앙부처 복지서비스 V001 API client
//!
//! API: http://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001
//! Env: NATIONAL_WELFARE_API_KEY
//! Required params: serviceKey, callTp=L, pageNo, numOfRows, srchKeyCode=001
//!
//! 2025-04-24 공공데이터포털 변경 공지 기준 V001 엔드포인트 사용.
//! Response is XML with `<wantedList>` root.
//! Pagination: pageNo (1-based), numOfRows, totalCount in response header.

use anyhow::{Context, Result};
use reqwest::Client;
use serde::Deserialize;
use serde_json::json;
use std::time::Duration;
use tracing::{info, warn};

use super::{content_hash, DataSource, RawRecord};

const BASE_URL: &str =
    "https://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001";
const PAGE_SIZE: u32 = 100;
const MAX_PAGES: u32 = 200;

pub struct NationalWelfareSource {
    client: Client,
    api_key: String,
}

impl NationalWelfareSource {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .user_agent("Mozilla/5.0 (compatible; Mazimi-Bot/1.0; +https://mazimi.kr/bot)")
                .build()
                .unwrap_or_default(),
            api_key,
        }
    }

    /// Returns `None` when `NATIONAL_WELFARE_API_KEY` is not set.
    pub fn from_env() -> Option<Self> {
        std::env::var("NATIONAL_WELFARE_API_KEY")
            .ok()
            .map(Self::new)
    }

    async fn fetch_page(&self, page: u32) -> Result<NationalWelfareResponse> {
        let text = self
            .client
            .get(BASE_URL)
            .query(&[
                ("serviceKey", self.api_key.as_str()),
                ("callTp", "L"),
                ("pageNo", &page.to_string()),
                ("numOfRows", &PAGE_SIZE.to_string()),
                ("srchKeyCode", "001"),
            ])
            .send()
            .await
            .context("national_welfare: HTTP request failed")?
            .error_for_status()
            .context("national_welfare: non-2xx response")?
            .text()
            .await
            .context("national_welfare: failed to read response body")?;

        quick_xml::de::from_str::<NationalWelfareResponse>(&text).with_context(|| {
            format!(
                "national_welfare: XML parse failed. page={page} body={}",
                &text[..text.len().min(500)]
            )
        })
    }
}

impl DataSource for NationalWelfareSource {
    fn name(&self) -> &'static str {
        "national_welfare"
    }

    async fn fetch_all(&self) -> Result<Vec<RawRecord>> {
        let mut records = Vec::new();
        let mut page = 1u32;

        loop {
            info!(source = self.name(), page, "fetching page");

            let response = match self.fetch_page(page).await {
                Ok(r) => r,
                Err(e) => {
                    warn!(source = self.name(), page, error = %e, "fetch failed, stopping");
                    break;
                }
            };

            let items = response.serv_list.unwrap_or_default();
            if items.is_empty() {
                info!(
                    source = self.name(),
                    page, "empty list — stopping pagination"
                );
                break;
            }

            let fetched = items.len();
            for item in &items {
                let source_id = format!(
                    "national_welfare_{}",
                    item.serv_id.as_deref().unwrap_or("unknown")
                );

                let payload = json!({
                    "servId":             item.serv_id,
                    "servNm":             item.serv_nm,
                    "servDgst":           item.serv_dgst,
                    "jurMnofNm":          item.jur_mnof_nm,
                    "jurOrgNm":           item.jur_org_nm,
                    "srvPvsnNm":          item.srv_pvsn_nm,
                    "sprtCycNm":          item.sprt_cyc_nm,
                    "intrsThemaArray":    item.intrs_thema_array,
                    "trgterIndvdlArray":  item.trgter_indvdl_array,
                    "lifeArray":          item.life_array,
                    "onapPsbltYn":        item.onap_psblt_yn,
                    "rprsCtadr":          item.rprs_ctadr,
                    "servDtlLink":        item.serv_dtl_link,
                    "inqNum":             item.inq_num,
                    "svcfrstRegTs":       item.svc_frst_reg_ts,
                    "source":             "national_welfare",
                });

                let hash = content_hash(&payload);

                records.push(RawRecord {
                    source_id,
                    payload,
                    content_hash: hash,
                });
            }

            let total_count = response.total_count.unwrap_or(0);
            let pages_needed = total_count.div_ceil(PAGE_SIZE as u64) as u32;
            if fetched < PAGE_SIZE as usize || page >= pages_needed || page >= MAX_PAGES {
                break;
            }
            page += 1;

            tokio::time::sleep(Duration::from_millis(300)).await;
        }

        info!(
            source = self.name(),
            total = records.len(),
            "fetch complete"
        );
        Ok(records)
    }
}

// ── XML response shapes (V001) ───────────────────────────────────────────────
//
// <wantedList>
//   <totalCount>370</totalCount>
//   <pageNo>1</pageNo>
//   <numOfRows>100</numOfRows>
//   <resultCode>0</resultCode>
//   <resultMessage>SUCCESS</resultMessage>
//   <servList>
//     <servId>WLF00000022</servId>
//     <servNm>서비스명</servNm>
//     <servDgst>서비스 요약</servDgst>
//     <jurMnofNm>주관부처</jurMnofNm>
//     <jurOrgNm>주관기관</jurOrgNm>
//     <srvPvsnNm>제공유형</srvPvsnNm>
//     <sprtCycNm>지원주기</sprtCycNm>
//     <intrsThemaArray>관심테마</intrsThemaArray>
//     <trgterIndvdlArray>지원대상</trgterIndvdlArray>
//     <lifeArray>생애주기</lifeArray>
//     <onapPsbltYn>온라인신청가능여부</onapPsbltYn>
//     <rprsCtadr>대표연락처</rprsCtadr>
//     <servDtlLink>https://www.bokjiro.go.kr/...</servDtlLink>
//     <inqNum>12345</inqNum>
//     <svcfrstRegTs>20210903</svcfrstRegTs>
//   </servList>
//   ...
// </wantedList>

#[derive(Debug, Deserialize)]
#[serde(rename = "wantedList")]
struct NationalWelfareResponse {
    #[serde(rename = "totalCount")]
    total_count: Option<u64>,
    #[serde(rename = "servList", default)]
    serv_list: Option<Vec<NationalWelfareItem>>,
}

#[derive(Debug, Deserialize)]
struct NationalWelfareItem {
    #[serde(rename = "servId")]
    serv_id: Option<String>,
    #[serde(rename = "servNm")]
    serv_nm: Option<String>,
    #[serde(rename = "servDgst")]
    serv_dgst: Option<String>,
    /// V001: jurMnofNm (주관부처, 구 bizChrDeptNm 대체)
    #[serde(rename = "jurMnofNm")]
    jur_mnof_nm: Option<String>,
    /// V001: jurOrgNm (주관기관)
    #[serde(rename = "jurOrgNm")]
    jur_org_nm: Option<String>,
    #[serde(rename = "srvPvsnNm")]
    srv_pvsn_nm: Option<String>,
    #[serde(rename = "sprtCycNm")]
    sprt_cyc_nm: Option<String>,
    /// V001: intrsThemaArray (구 intrsThemaNmArray)
    #[serde(rename = "intrsThemaArray")]
    intrs_thema_array: Option<String>,
    /// V001: trgterIndvdlArray (구 trgterIndvdlNmArray)
    #[serde(rename = "trgterIndvdlArray")]
    trgter_indvdl_array: Option<String>,
    /// V001: 생애주기 (영유아, 아동, 청소년 등)
    #[serde(rename = "lifeArray")]
    life_array: Option<String>,
    /// V001: 온라인 신청 가능 여부 (Y/N)
    #[serde(rename = "onapPsbltYn")]
    onap_psblt_yn: Option<String>,
    /// V001: 대표 연락처
    #[serde(rename = "rprsCtadr")]
    rprs_ctadr: Option<String>,
    #[serde(rename = "servDtlLink")]
    serv_dtl_link: Option<String>,
    #[serde(rename = "inqNum")]
    inq_num: Option<u64>,
    /// V001: 최초 등록일 (구 lastModYmd 대체)
    #[serde(rename = "svcfrstRegTs")]
    svc_frst_reg_ts: Option<String>,
}

// ── Normalization (called from pipeline.rs) ───────────────────────────────────

pub fn normalize_national_welfare(p: &serde_json::Value) -> crate::pipeline::NormalizedProgram {
    let title = p["servNm"].as_str().unwrap_or("Unknown").to_string();
    let summary = p["servDgst"].as_str().map(|s| s.to_string());
    let provider_name = p["jurMnofNm"].as_str().map(|s| s.to_string());
    let official_url = p["servDtlLink"].as_str().map(|s| s.to_string());

    let program_type = infer_national_welfare_type(
        p["intrsThemaArray"].as_str(),
        p["trgterIndvdlArray"].as_str(),
        p["srvPvsnNm"].as_str(),
    );

    crate::pipeline::NormalizedProgram {
        program_type,
        title,
        summary,
        provider_name,
        official_url,
        application_start_at: None,
        application_end_at: None,
        min_age: None,
        max_age: None,
        regions: vec![],
    }
}

fn infer_national_welfare_type(
    themes: Option<&str>,
    targets: Option<&str>,
    provision: Option<&str>,
) -> String {
    let combined = format!(
        "{} {} {}",
        themes.unwrap_or(""),
        targets.unwrap_or(""),
        provision.unwrap_or("")
    )
    .to_lowercase();

    if combined.contains("장학") || combined.contains("학자금") {
        "scholarship".into()
    } else if combined.contains("주거") || combined.contains("임대") || combined.contains("전세")
    {
        "housing".into()
    } else if combined.contains("취업") || combined.contains("창업") || combined.contains("고용")
    {
        "employment".into()
    } else {
        "benefit".into()
    }
}
