//! 드림스폰(DreamSpon) 장학금 API client
//!
//! API: POST https://www.dreamspon.com/process/scholarAjax.html
//! Params: mode=main_scholarship, page=N
//! Response: JSON with scholarship listings (including corporate/private)
//!
//! No API key required. The endpoint returns JSON with a `total_page` field
//! for pagination control.
//!
//! Environment:
//!   DREAMSPON_ENABLED  — opt-in; defaults to "true" (no key needed)
//!   DREAMSPON_KEYWORD  — optional keyword filter (e.g. "기업장학금")

use anyhow::{Context, Result};
use reqwest::Client;
use serde::Deserialize;
use serde_json::json;
use std::time::Duration;
use tracing::{info, warn};

use super::{content_hash, DataSource, RawRecord};

const BASE_URL: &str = "https://www.dreamspon.com/process/scholarAjax.html";
const MAX_PAGES: u32 = 50; // safety cap

pub struct DreamsponSource {
    client: Client,
    keyword: Option<String>,
}

impl DreamsponSource {
    pub fn new(keyword: Option<String>) -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .user_agent("Mozilla/5.0 (compatible; Mazimi-Bot/1.0; +https://mazimi.kr/bot)")
                .build()
                .unwrap_or_default(),
            keyword,
        }
    }

    /// Build from environment variables.
    /// Returns `None` when `DREAMSPON_ENABLED` is explicitly set to "false".
    pub fn from_env() -> Option<Self> {
        let enabled = std::env::var("DREAMSPON_ENABLED")
            .unwrap_or_else(|_| "true".to_string())
            .to_lowercase();
        if enabled == "false" || enabled == "0" || enabled == "no" {
            return None;
        }
        let keyword = std::env::var("DREAMSPON_KEYWORD").ok();
        Some(Self::new(keyword))
    }

    async fn fetch_page(&self, page: u32) -> Result<DreamsponResponse> {
        let mut form = vec![
            ("mode", "main_scholarship".to_string()),
            ("page", page.to_string()),
        ];
        if let Some(kw) = &self.keyword {
            form.push(("keyword", kw.clone()));
        }

        let resp = self
            .client
            .post(BASE_URL)
            .form(&form)
            .send()
            .await
            .context("dreamspon: HTTP request failed")?
            .error_for_status()
            .context("dreamspon: non-2xx response")?;

        let text = resp
            .text()
            .await
            .context("dreamspon: failed to read response body")?;

        serde_json::from_str::<DreamsponResponse>(&text).with_context(|| {
            format!(
                "dreamspon: JSON parse failed. page={page} body={}",
                &text[..text.len().min(500)]
            )
        })
    }
}

impl DataSource for DreamsponSource {
    fn name(&self) -> &'static str {
        "dreamspon"
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

            let items = response.list.unwrap_or_default();
            if items.is_empty() {
                info!(source = self.name(), page, "empty list — stopping pagination");
                break;
            }

            for item in &items {
                let source_id = format!("dreamspon_{}", item.idx.as_deref().unwrap_or("unknown"));

                let payload = json!({
                    "idx": item.idx,
                    "title": item.stitle,
                    "organization": item.cname,
                    "keywords": item.keywords,
                    "dday": item.dday,
                    "status_class": item._class,
                    "status_text": item._text,
                    "view_count": item.shit,
                    "source": "dreamspon",
                });

                let hash = content_hash(&payload);

                records.push(RawRecord {
                    source_id,
                    payload,
                    content_hash: hash,
                });
            }

            let total_pages = response.total_page.unwrap_or(1);
            if page >= total_pages || page >= MAX_PAGES {
                break;
            }
            page += 1;

            // Be polite — 500ms delay between pages
            tokio::time::sleep(Duration::from_millis(500)).await;
        }

        info!(source = self.name(), total = records.len(), "fetch complete");
        Ok(records)
    }
}

// ── JSON response shapes ─────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct DreamsponResponse {
    #[serde(default)]
    list: Option<Vec<DreamsponItem>>,
    total_page: Option<u32>,
}

#[allow(non_snake_case)]
#[derive(Debug, Deserialize)]
struct DreamsponItem {
    /// Unique ID
    idx: Option<String>,
    /// Scholarship title
    stitle: Option<String>,
    /// Organization/company name
    cname: Option<String>,
    /// Hashtag keywords (e.g. "#기업장학금 #이공계")
    keywords: Option<String>,
    /// D-day string (e.g. "D-15")
    dday: Option<String>,
    /// CSS class for status badge
    _class: Option<String>,
    /// Status text (모집중/마감임박/모집완료)
    _text: Option<String>,
    /// View count
    shit: Option<u64>,
}
