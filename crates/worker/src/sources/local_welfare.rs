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

use super::{content_hash, life_stage_includes_youth, DataSource, RawRecord};

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
        let mut total_filtered_out = 0usize;

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
            let mut filtered_out = 0usize;
            for item in &items {
                // 청년(youth) 대상 필터: lifeNmArray 기준. 지자체 복지는 노인
                // 대상 복지 비중이 매우 높아(4,600건 중 lifeNmArray에 "청년"
                // 포함 건 1,202건 = 26.1%) 필터 없이는 추천 풀 대부분이
                // 비청년 복지로 채워진다. See `is_youth_local_welfare`.
                if !is_youth_local_welfare(item) {
                    filtered_out += 1;
                    continue;
                }

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
                    "lifeNmArray":    item.life_nm_array,
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
            total_filtered_out += filtered_out;

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
            filtered_out_non_youth = total_filtered_out,
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
//     <lifeNmArray>노년</lifeNmArray>
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
    /// 생애주기 (영유아, 아동, 청소년, 청년, 중장년, 노년, 임신 · 출산 등).
    /// Present on ~70% of records (2026-07 표본 4,600건 중 3,205건).
    #[serde(rename = "lifeNmArray")]
    life_nm_array: Option<String>,
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
        application_method: None,
        submission_documents: None,
        screening_method: None,
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

// ── Youth (청년) filter ───────────────────────────────────────────────────────
//
// 지자체 복지서비스는 노인 대상 복지 비중이 매우 높다 (2026-07 표본 4,600건
// 중 lifeNmArray가 "청년"을 포함한 건 1,202건 = 26.1%). 필터 없이는 추천 풀
// 대부분이 비청년(특히 노년) 복지로 채워진다.
//
// Primary signal: `lifeNmArray` (생애주기). Present on 3,205/4,600 표본
// records (~70%).
//
// Fallback: 1,395/4,600 표본 records have no `lifeNmArray` tag at all.
// Manually checked 2026-07 — 10/1,395 of those DO mention "청년" in
// servNm/trgterIndvdlNmArray/intrsThemaNmArray/servDgst (e.g. "청년 시험응시료
// 지원사업", "으뜸관악 청년통장") despite lacking the life-stage tag, so
// (unlike national_welfare where the equivalent fallback measured 0/153) this
// keyword fallback is an active, evidence-backed path here — dropping it
// would silently discard real youth programs that the API forgot to tag.
fn is_youth_local_welfare(item: &LocalWelfareItem) -> bool {
    if life_stage_includes_youth(item.life_nm_array.as_deref()) {
        return true;
    }

    // Only fall back to keyword matching when lifeNmArray is entirely absent
    // (not merely present-but-not-containing-청년).
    if item.life_nm_array.is_none() {
        let combined = format!(
            "{} {} {} {}",
            item.serv_nm.as_deref().unwrap_or(""),
            item.trgter_indvdl_nm_array.as_deref().unwrap_or(""),
            item.intrs_thema_nm_array.as_deref().unwrap_or(""),
            item.serv_dgst.as_deref().unwrap_or(""),
        );
        return combined.contains("청년");
    }

    false
}

#[cfg(test)]
mod youth_filter_tests {
    use super::*;

    fn item(
        life_nm_array: Option<&str>,
        serv_nm: Option<&str>,
        trgter: Option<&str>,
        thema: Option<&str>,
        dgst: Option<&str>,
    ) -> LocalWelfareItem {
        LocalWelfareItem {
            serv_id: Some("WLF00000001".into()),
            serv_nm: serv_nm.map(String::from),
            serv_dgst: dgst.map(String::from),
            biz_chr_dept_nm: None,
            ctpv_nm: None,
            sgg_nm: None,
            srv_pvsn_nm: None,
            sprt_cyc_nm: None,
            aply_mtd_nm: None,
            intrs_thema_nm_array: thema.map(String::from),
            trgter_indvdl_nm_array: trgter.map(String::from),
            life_nm_array: life_nm_array.map(String::from),
            serv_dtl_link: None,
            inq_num: None,
            last_mod_ymd: None,
        }
    }

    #[test]
    fn life_nm_array_with_youth_passes() {
        let it = item(Some("청년"), None, None, None, None);
        assert!(is_youth_local_welfare(&it));
    }

    #[test]
    fn life_nm_array_with_youth_among_others_passes() {
        let it = item(Some("중장년, 노년, 청년"), None, None, None, None);
        assert!(is_youth_local_welfare(&it));
    }

    #[test]
    fn life_nm_array_elderly_only_is_excluded() {
        let it = item(
            Some("노년"),
            Some("무주추모의집 운영"),
            Some("장애인"),
            Some("안전·위기"),
            None,
        );
        assert!(!is_youth_local_welfare(&it));
    }

    #[test]
    fn missing_life_nm_array_falls_back_to_keyword_and_passes() {
        // Mirrors the real 2026-07 sample: "청년 시험응시료 지원사업" has no
        // lifeNmArray tag but clearly targets youth.
        let it = item(None, Some("청년 시험응시료 지원사업"), None, None, None);
        assert!(is_youth_local_welfare(&it));
    }

    #[test]
    fn missing_life_nm_array_falls_back_to_keyword_and_excludes() {
        let it = item(
            None,
            Some("무주군 결식아동 지원사업"),
            Some("아동"),
            None,
            None,
        );
        assert!(!is_youth_local_welfare(&it));
    }

    #[test]
    fn present_but_non_youth_life_nm_array_does_not_use_keyword_fallback() {
        let it = item(
            Some("노년"),
            Some("노인 돌봄 서비스"),
            None,
            None,
            Some("청년 자녀가 신청을 대행할 수 있습니다"),
        );
        assert!(!is_youth_local_welfare(&it));
    }
}
