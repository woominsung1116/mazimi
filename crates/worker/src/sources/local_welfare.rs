//! 한국사회보장정보원 지자체 복지서비스 API client
//!
//! API: http://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfarelist
//! Env: LOCAL_WELFARE_API_KEY
//!
//! Response is XML with `<wantedList>` root. No JSON mode available.
//! Confirmed working: 4559+ records as of 2026-04.
//! Pagination: pageNo (1-based), numOfRows, totalCount in response header.

use anyhow::{Context, Result};
use reqwest::Client;
use serde::Deserialize;
use serde_json::json;
use std::time::Duration;
use tracing::{info, warn};

use super::{content_hash, DataSource, RawRecord};

const BASE_URL: &str =
    "https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfarelist";
const PAGE_SIZE: u32 = 100;
const MAX_PAGES: u32 = 200;

pub struct LocalWelfareSource {
    client: Client,
    api_key: String,
}

impl LocalWelfareSource {
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

    /// Returns `None` when `LOCAL_WELFARE_API_KEY` is not set.
    pub fn from_env() -> Option<Self> {
        std::env::var("LOCAL_WELFARE_API_KEY").ok().map(Self::new)
    }

    async fn fetch_page(&self, page: u32) -> Result<LocalWelfareResponse> {
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
            .context("local_welfare: HTTP request failed")?
            .error_for_status()
            .context("local_welfare: non-2xx response")?
            .text()
            .await
            .context("local_welfare: failed to read response body")?;

        quick_xml::de::from_str::<LocalWelfareResponse>(&text).with_context(|| {
            format!(
                "local_welfare: XML parse failed. page={page} body={}",
                &text[..text.len().min(500)]
            )
        })
    }
}

impl DataSource for LocalWelfareSource {
    fn name(&self) -> &'static str {
        "local_welfare"
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
                    "local_welfare_{}",
                    item.serv_id.as_deref().unwrap_or("unknown")
                );

                let payload = json!({
                    "servId":         item.serv_id,
                    "servNm":         item.serv_nm,
                    "servDgst":       item.serv_dgst,
                    "bizChrDeptNm":   item.biz_chr_dept_nm,
                    "ctpvNm":         item.ctpv_nm,
                    "sggNm":          item.sgg_nm,
                    "srvPvsnNm":      item.srv_pvsn_nm,
                    "sprtCycNm":      item.sprt_cyc_nm,
                    "aplyMtdNm":      item.aply_mtd_nm,
                    "intrsThemaNmArray": item.intrs_thema_nm_array,
                    "trgterIndvdlNmArray": item.trgter_indvdl_nm_array,
                    "servDtlLink":    item.serv_dtl_link,
                    "inqNum":         item.inq_num,
                    "lastModYmd":     item.last_mod_ymd,
                    "source":         "local_welfare",
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

// ── XML response shapes ───────────────────────────────────────────────────────
//
// <wantedList>
//   <totalCount>4559</totalCount>
//   <pageNo>1</pageNo>
//   <numOfRows>100</numOfRows>
//   <resultCode>0</resultCode>
//   <resultMessage>SUCCESS</resultMessage>
//   <servList>
//     <servId>WLF00004882</servId>
//     <servNm>무주추모의집 운영</servNm>
//     <servDgst>무주추모의집을 운영함으로써...</servDgst>
//     <bizChrDeptNm>전북특별자치도 무주군 행정복지국 사회복지과</bizChrDeptNm>
//     <ctpvNm>전북특별자치도</ctpvNm>
//     <sggNm>무주군</sggNm>
//     <srvPvsnNm>기타</srvPvsnNm>
//     <sprtCycNm>1회성</sprtCycNm>
//     <aplyMtdNm>방문</aplyMtdNm>
//     <intrsThemaNmArray>안전·위기</intrsThemaNmArray>
//     <trgterIndvdlNmArray>장애인</trgterIndvdlNmArray>
//     <servDtlLink>https://www.bokjiro.go.kr/...</servDtlLink>
//     <inqNum>1241</inqNum>
//     <lastModYmd>20260405</lastModYmd>
//   </servList>
//   ...
// </wantedList>

#[derive(Debug, Deserialize)]
#[serde(rename = "wantedList")]
struct LocalWelfareResponse {
    #[serde(rename = "totalCount")]
    total_count: Option<u64>,
    #[serde(rename = "servList", default)]
    serv_list: Option<Vec<LocalWelfareItem>>,
}

#[derive(Debug, Deserialize)]
struct LocalWelfareItem {
    #[serde(rename = "servId")]
    serv_id: Option<String>,
    #[serde(rename = "servNm")]
    serv_nm: Option<String>,
    #[serde(rename = "servDgst")]
    serv_dgst: Option<String>,
    #[serde(rename = "bizChrDeptNm")]
    biz_chr_dept_nm: Option<String>,
    #[serde(rename = "ctpvNm")]
    ctpv_nm: Option<String>,
    #[serde(rename = "sggNm")]
    sgg_nm: Option<String>,
    #[serde(rename = "srvPvsnNm")]
    srv_pvsn_nm: Option<String>,
    #[serde(rename = "sprtCycNm")]
    sprt_cyc_nm: Option<String>,
    #[serde(rename = "aplyMtdNm")]
    aply_mtd_nm: Option<String>,
    #[serde(rename = "intrsThemaNmArray")]
    intrs_thema_nm_array: Option<String>,
    #[serde(rename = "trgterIndvdlNmArray")]
    trgter_indvdl_nm_array: Option<String>,
    #[serde(rename = "servDtlLink")]
    serv_dtl_link: Option<String>,
    #[serde(rename = "inqNum")]
    inq_num: Option<u64>,
    #[serde(rename = "lastModYmd")]
    last_mod_ymd: Option<String>,
}

// ── Normalization (called from pipeline.rs) ───────────────────────────────────

pub fn normalize_local_welfare(p: &serde_json::Value) -> crate::pipeline::NormalizedProgram {
    let title = p["servNm"].as_str().unwrap_or("Unknown").to_string();
    let summary = p["servDgst"].as_str().map(|s| s.to_string());
    let provider_name = p["bizChrDeptNm"].as_str().map(|s| s.to_string());
    let official_url = p["servDtlLink"].as_str().map(|s| s.to_string());

    // Build region list from 시도 + 시군구
    let mut regions = Vec::new();
    if let Some(ctpv) = p["ctpvNm"].as_str().filter(|s| !s.is_empty()) {
        regions.push(ctpv.to_string());
    }
    if let Some(sgg) = p["sggNm"].as_str().filter(|s| !s.is_empty()) {
        regions.push(sgg.to_string());
    }

    let program_type = infer_local_welfare_type(
        p["intrsThemaNmArray"].as_str(),
        p["trgterIndvdlNmArray"].as_str(),
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
        regions,
    }
}

fn infer_local_welfare_type(
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
