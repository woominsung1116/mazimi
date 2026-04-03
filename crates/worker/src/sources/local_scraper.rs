//! Semi-automated HTML scraper for local youth portals that lack public APIs.
//!
//! Each entry in `SOURCES` targets one regional portal. CSS selectors are best-effort
//! and will need periodic manual verification — sites redesign without notice.
//! When a selector stops matching, the source logs a warning and returns zero records
//! rather than crashing the whole pipeline.
//!
//! To add a new site:
//!   1. Add a `ScraperSource` entry to `SOURCES`.
//!   2. Verify selectors in a browser dev-tools "Elements" panel.
//!   3. Confirm the region slug matches the region list used by the programs table.
//!
//! Environment:
//!   SCRAPER_ENABLED=true   — opt-in; scraping is skipped silently when absent/false.
//!   SCRAPER_TIMEOUT_SECS   — per-request timeout (default 20).

use anyhow::{anyhow, Result};
use reqwest::Client;
use scraper::{Html, Selector};
use serde_json::json;
use std::time::Duration;
use tracing::{debug, info, warn};

use super::{content_hash, DataSource, RawRecord};

// ── Source registry ────────────────────────────────────────────────────────────

/// Static description of one scrapable portal.
pub struct ScraperSource {
    /// Human-readable name; also used as `source_type` in the programs table.
    pub name: &'static str,
    /// Homepage or listing URL to fetch.
    pub url: &'static str,
    /// Region slug stored in the programs.regions column.
    pub region: &'static str,
    /// CSS selector for the container element wrapping one program/event row.
    ///
    /// TODO: verify each selector against the live site before deploying.
    /// These are initial guesses based on common CMS patterns — they will
    /// almost certainly need adjustment.
    pub item_selector: &'static str,
    /// CSS selector for the title element, relative to the item container.
    pub title_selector: &'static str,
    /// CSS selector for the description/summary, relative to the item container.
    /// Set to "" to skip — summary will be None.
    pub desc_selector: &'static str,
    /// CSS selector for the deadline text, relative to the item container.
    /// Set to "" to skip.
    pub deadline_selector: &'static str,
    /// CSS selector for the detail link `<a>` tag, relative to the item container.
    /// Set to "" to skip — link will fall back to the portal root URL.
    pub link_selector: &'static str,
}

/// All portals to scrape.
///
/// TODO: Each `item_selector` / sub-selector below is a PLACEHOLDER derived from
/// common Korean government CMS layouts (eGovFrame, JEUS). Verify them in browser
/// DevTools before using in production:
///
///   - 부산청년센터: https://www.busanyouth.or.kr/
///   - 대구청년센터: https://youth.daegu.go.kr/
///   - 인천청년포털: https://www.ichyouth.or.kr/
///   - 광주청년센터: https://gjyouth.kr/
///   - 대전청년센터: https://djyouth.or.kr/
///   - 울산청년센터: https://ulyouth.or.kr/
///   - 경기청년포털: https://youth.gg.go.kr/
///   - 충남청년: https://www.cnyouth.or.kr/
///   - 전남청년: https://jnyouth.or.kr/
///   - 경북청년: https://gbwelfare.or.kr/
const SOURCES: &[ScraperSource] = &[
    ScraperSource {
        name: "부산청년센터",
        url: "https://www.busanyouth.or.kr/board/list?boardId=program",
        region: "busan",
        // TODO: verify — eGovFrame boards typically use .board_list li or table tr
        item_selector: ".board_list li",
        title_selector: ".title a",
        desc_selector: ".summary",
        deadline_selector: ".date",
        link_selector: ".title a",
    },
    ScraperSource {
        name: "대구청년센터",
        url: "https://youth.daegu.go.kr/program/list",
        region: "daegu",
        // TODO: verify — Daegu portal uses a card-grid layout
        item_selector: ".program-list .item",
        title_selector: ".item-title",
        desc_selector: ".item-desc",
        deadline_selector: ".item-period",
        link_selector: "a",
    },
    ScraperSource {
        name: "인천청년포털",
        url: "https://www.ichyouth.or.kr/board/list?menuNo=200051",
        region: "incheon",
        // TODO: verify
        item_selector: ".bbs_list tbody tr",
        title_selector: "td.subject a",
        desc_selector: "",
        deadline_selector: "td.date",
        link_selector: "td.subject a",
    },
    ScraperSource {
        name: "광주청년센터",
        url: "https://gjyouth.kr/youth/program",
        region: "gwangju",
        // TODO: verify
        item_selector: ".program_wrap .program_item",
        title_selector: ".program_title",
        desc_selector: ".program_content",
        deadline_selector: ".program_date",
        link_selector: "a",
    },
    ScraperSource {
        name: "대전청년포털",
        url: "https://djyouth.or.kr/program",
        region: "daejeon",
        // TODO: verify
        item_selector: ".list-group .list-group-item",
        title_selector: ".title",
        desc_selector: ".desc",
        deadline_selector: ".period",
        link_selector: "a",
    },
];

// ── Scraper source struct ──────────────────────────────────────────────────────

/// A DataSource that scrapes HTML portals listed in `SOURCES`.
///
/// All sites in `SOURCES` are scraped in a single `fetch_all` call; each
/// produces one or more `RawRecord`s with `source_type = source.name`.
///
/// The composite source name stored in `ingestion_runs.source_name` is
/// `"local_scraper"` so all regional scrapes appear under one run.
pub struct LocalScraperSource {
    client: Client,
}

impl LocalScraperSource {
    pub fn new(timeout_secs: u64) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(timeout_secs))
            // Politely identify ourselves; some portals reject the default reqwest UA.
            .user_agent("Mozilla/5.0 (compatible; Mazimi-Bot/1.0; +https://mazimi.kr/bot)")
            .build()
            .unwrap_or_default();
        Self { client }
    }

    /// Build from environment variables.
    /// Returns `None` when `SCRAPER_ENABLED` is not `"true"` — the caller
    /// should log a warning and skip rather than treating this as an error.
    pub fn from_env() -> Option<Self> {
        let enabled = std::env::var("SCRAPER_ENABLED")
            .unwrap_or_default()
            .to_lowercase();
        if enabled != "true" && enabled != "1" && enabled != "yes" {
            return None;
        }
        let timeout = std::env::var("SCRAPER_TIMEOUT_SECS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(20u64);
        Some(Self::new(timeout))
    }

    /// Fetch and parse one portal. Returns a (possibly empty) vec of records.
    /// Never propagates errors — logs warnings instead so one broken site
    /// does not abort the others.
    async fn scrape_one(&self, src: &ScraperSource) -> Vec<RawRecord> {
        info!(source = src.name, url = src.url, "local_scraper: fetching");

        // ── Fetch HTML ─────────────────────────────────────────────────────────
        let html = match self.fetch_html(src).await {
            Ok(h) => h,
            Err(e) => {
                warn!(
                    source = src.name,
                    url = src.url,
                    error = %e,
                    "local_scraper: HTTP fetch failed, skipping source"
                );
                return vec![];
            }
        };

        // ── Parse selectors ────────────────────────────────────────────────────
        let item_sel = match Selector::parse(src.item_selector) {
            Ok(s) => s,
            Err(e) => {
                warn!(
                    source = src.name,
                    selector = src.item_selector,
                    error = ?e,
                    "local_scraper: invalid item_selector CSS, skipping source"
                );
                return vec![];
            }
        };

        let document = Html::parse_document(&html);
        let items: Vec<_> = document.select(&item_sel).collect();

        if items.is_empty() {
            warn!(
                source = src.name,
                url = src.url,
                selector = src.item_selector,
                "local_scraper: item_selector matched 0 elements — \
                 site may have changed layout; manual selector update needed"
            );
            return vec![];
        }

        info!(
            source = src.name,
            count = items.len(),
            "local_scraper: found item elements"
        );

        let mut records = Vec::new();
        for (idx, item_el) in items.iter().enumerate() {
            // Capture the raw outer HTML for debugging selector drift.
            let raw_html_snippet: String = item_el.html();

            // Extract fields; failures are soft (warn + None).
            let title = extract_text(item_el, src.title_selector, src.name, "title");
            if title.is_none() {
                warn!(
                    source = src.name,
                    idx,
                    selector = src.title_selector,
                    "local_scraper: title not found, skipping item"
                );
                continue;
            }
            let title = title.unwrap();

            let description = extract_text(item_el, src.desc_selector, src.name, "desc");
            let deadline_text = extract_text(item_el, src.deadline_selector, src.name, "deadline");
            let link = extract_href(item_el, src.link_selector, src.url, src.name);

            // Build a stable source_id from name + title slug so re-runs can
            // detect unchanged items via content hash comparison.
            let source_id = format!("{}::{}", src.name, slug(&title));

            let payload = json!({
                "source_portal": src.name,
                "region":        src.region,
                "title":         title,
                "description":   description,
                "deadline_text": deadline_text,
                "link":          link,
                // Raw HTML snippet stored for debugging selector drift.
                // Truncated to 4 KB to avoid bloating the DB.
                "raw_html_snippet": truncate_str(&raw_html_snippet, 4096),
            });

            let hash = content_hash(&payload);

            debug!(
                source = src.name,
                source_id = %source_id,
                "local_scraper: item parsed"
            );

            records.push(RawRecord {
                source_id,
                payload,
                content_hash: hash,
            });
        }

        info!(
            source = src.name,
            parsed = records.len(),
            "local_scraper: scrape complete"
        );
        records
    }

    /// HTTP GET with up to 2 retries on transient errors.
    async fn fetch_html(&self, src: &ScraperSource) -> Result<String> {
        let mut last_err = anyhow!("no attempts made");
        for attempt in 1u8..=3 {
            match self
                .client
                .get(src.url)
                // Mimic a real browser Accept header so portals don't serve a
                // reduced response to bots.
                .header(
                    reqwest::header::ACCEPT,
                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                )
                .header(reqwest::header::ACCEPT_LANGUAGE, "ko-KR,ko;q=0.9,en;q=0.8")
                .send()
                .await
            {
                Ok(resp) => {
                    if !resp.status().is_success() {
                        last_err = anyhow!("HTTP {} for {}", resp.status(), src.url);
                        warn!(
                            source = src.name,
                            attempt,
                            status = %resp.status(),
                            "local_scraper: non-2xx response"
                        );
                        // Don't retry 4xx — it's a permanent error.
                        if resp.status().is_client_error() {
                            break;
                        }
                        continue;
                    }
                    return resp
                        .text()
                        .await
                        .map_err(|e| anyhow!("failed to read body: {}", e));
                }
                Err(e) => {
                    last_err = anyhow!("request error: {}", e);
                    warn!(
                        source = src.name,
                        attempt,
                        error = %e,
                        "local_scraper: request failed, will retry"
                    );
                }
            }
            // Brief back-off between retries: 1 s, 2 s.
            tokio::time::sleep(Duration::from_secs(attempt as u64)).await;
        }
        Err(last_err)
    }
}

impl DataSource for LocalScraperSource {
    fn name(&self) -> &'static str {
        "local_scraper"
    }

    async fn fetch_all(&self) -> Result<Vec<RawRecord>> {
        let mut all_records = Vec::new();

        for src in SOURCES {
            let records = self.scrape_one(src).await;
            all_records.extend(records);
        }

        info!(
            source = self.name(),
            total = all_records.len(),
            "local_scraper: all portals scraped"
        );
        Ok(all_records)
    }
}

// ── Selector helpers ───────────────────────────────────────────────────────────

/// Select the first matching element within `scope` and return its trimmed
/// inner text. Returns `None` when the selector is empty, invalid, or matches
/// nothing — all treated as soft failures.
fn extract_text(
    scope: &scraper::ElementRef,
    selector: &str,
    source_name: &str,
    field: &str,
) -> Option<String> {
    if selector.is_empty() {
        return None;
    }
    let sel = match Selector::parse(selector) {
        Ok(s) => s,
        Err(e) => {
            warn!(
                source = source_name,
                field,
                selector,
                error = ?e,
                "local_scraper: invalid CSS selector"
            );
            return None;
        }
    };
    scope.select(&sel).next().map(|el| {
        el.text()
            .collect::<Vec<_>>()
            .join(" ")
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
    })
}

/// Extract the `href` attribute of the first `<a>` matching `selector`
/// within `scope`. Resolves relative URLs against `base_url`.
/// Falls back to `base_url` when selector is empty or nothing matches.
fn extract_href(
    scope: &scraper::ElementRef,
    selector: &str,
    base_url: &str,
    source_name: &str,
) -> Option<String> {
    if selector.is_empty() {
        return Some(base_url.to_string());
    }
    let sel = match Selector::parse(selector) {
        Ok(s) => s,
        Err(e) => {
            warn!(
                source = source_name,
                selector,
                error = ?e,
                "local_scraper: invalid link selector"
            );
            return Some(base_url.to_string());
        }
    };
    let href = scope
        .select(&sel)
        .next()
        .and_then(|el| el.value().attr("href"))
        .map(|h| h.to_string());

    match href {
        None => Some(base_url.to_string()),
        Some(h) if h.starts_with("http://") || h.starts_with("https://") => Some(h),
        Some(h) if h.starts_with('/') => {
            // Absolute path — prepend origin from base_url.
            if let Some(origin) = extract_origin(base_url) {
                Some(format!("{}{}", origin, h))
            } else {
                Some(h)
            }
        }
        Some(h) => Some(h),
    }
}

/// Extract scheme + host from a URL string (e.g. "https://example.com").
fn extract_origin(url: &str) -> Option<String> {
    // Naive split — avoids pulling in url crate as a dependency.
    let after_scheme = url.splitn(2, "://").nth(1)?;
    let host_and_rest = after_scheme.splitn(2, '/').next()?;
    let scheme = url.splitn(2, "://").next()?;
    Some(format!("{}://{}", scheme, host_and_rest))
}

/// Convert a title into a short ASCII-ish slug for use in source_id.
fn slug(s: &str) -> String {
    s.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' {
                c
            } else {
                '_'
            }
        })
        .take(80)
        .collect::<String>()
        .trim_matches('_')
        .to_string()
}

/// Truncate a string to at most `max_bytes` bytes (UTF-8 safe).
fn truncate_str(s: &str, max_bytes: usize) -> &str {
    if s.len() <= max_bytes {
        return s;
    }
    let mut end = max_bytes;
    while !s.is_char_boundary(end) {
        end -= 1;
    }
    &s[..end]
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slug_handles_korean() {
        let s = slug("부산 청년 창업지원");
        // Korean chars are alphanumeric in Rust's Unicode sense; this just
        // verifies the function doesn't panic.
        assert!(!s.is_empty());
    }

    #[test]
    fn truncate_str_respects_char_boundaries() {
        let s = "안녕하세요 반갑습니다"; // each char is 3 bytes in UTF-8
        let t = truncate_str(s, 6); // 6 bytes = 2 Korean chars exactly
        assert!(s.is_char_boundary(t.len()));
    }

    #[test]
    fn extract_origin_parses_url() {
        assert_eq!(
            extract_origin("https://www.busanyouth.or.kr/board/list"),
            Some("https://www.busanyouth.or.kr".to_string())
        );
        assert_eq!(
            extract_origin("http://example.com/foo/bar?q=1"),
            Some("http://example.com".to_string())
        );
    }
}
