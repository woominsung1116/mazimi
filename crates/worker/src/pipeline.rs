//! Normalize pipeline: fetch → save raw → hash compare → normalize → upsert programs → log

use anyhow::Result;
use chrono::Utc;
use sqlx::PgPool;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::sources::{DataSource, RawRecord};

/// Run the full ingestion pipeline for a single source.
pub async fn run_ingestion<S: DataSource>(pool: &PgPool, source: &S) -> Result<()> {
    let source_name = source.name();
    let run_id = Uuid::new_v4();
    let started_at = Utc::now();

    info!(source = source_name, run_id = %run_id, "ingestion run started");

    // Insert ingestion_run row (status = running)
    sqlx::query(
        "INSERT INTO ingestion_runs (id, source_name, status, started_at) \
         VALUES ($1, $2, 'running', $3)",
    )
    .bind(run_id)
    .bind(source_name)
    .bind(started_at)
    .execute(pool)
    .await?;

    let result = process_source(pool, source, run_id).await;

    let finished_at = Utc::now();
    match &result {
        Ok((total, changed)) => {
            sqlx::query(
                "UPDATE ingestion_runs \
                 SET status = 'success', finished_at = $2, total_fetched = $3, total_changed = $4 \
                 WHERE id = $1",
            )
            .bind(run_id)
            .bind(finished_at)
            .bind(*total as i32)
            .bind(*changed as i32)
            .execute(pool)
            .await?;
            info!(
                source = source_name,
                run_id = %run_id,
                total,
                changed,
                "ingestion run success"
            );
        }
        Err(e) => {
            sqlx::query(
                "UPDATE ingestion_runs \
                 SET status = 'failed', finished_at = $2, error_message = $3 \
                 WHERE id = $1",
            )
            .bind(run_id)
            .bind(finished_at)
            .bind(e.to_string())
            .execute(pool)
            .await?;
            error!(source = source_name, run_id = %run_id, error = %e, "ingestion run failed");
        }
    }

    result.map(|_| ())
}

/// Core processing: fetch records, compare hashes, normalize, upsert.
/// Returns (total_fetched, total_changed).
async fn process_source<S: DataSource>(
    pool: &PgPool,
    source: &S,
    run_id: Uuid,
) -> Result<(usize, usize)> {
    let source_name = source.name();

    // 1. Fetch all raw records from the API
    let records = source.fetch_all().await?;
    let total = records.len();

    let mut changed = 0usize;

    for record in &records {
        match process_record(pool, source_name, run_id, record).await {
            Ok(was_changed) => {
                if was_changed {
                    changed += 1;
                }
            }
            Err(e) => {
                warn!(
                    source = source_name,
                    source_id = %record.source_id,
                    error = %e,
                    "record processing failed, continuing"
                );
                let _ = sqlx::query(
                    "INSERT INTO ingestion_items \
                         (id, run_id, source_id, status, error_message, created_at) \
                     VALUES ($1, $2, $3, 'failed', $4, now()) \
                     ON CONFLICT (run_id, source_id) DO UPDATE \
                         SET status = 'failed', error_message = EXCLUDED.error_message",
                )
                .bind(Uuid::new_v4())
                .bind(run_id)
                .bind(&record.source_id)
                .bind(e.to_string())
                .execute(pool)
                .await;
            }
        }
    }

    Ok((total, changed))
}

/// Process a single record. Returns true if it was new or changed.
async fn process_record(
    pool: &PgPool,
    source_name: &str,
    run_id: Uuid,
    record: &RawRecord,
) -> Result<bool> {
    // 2. Compare content hash against last snapshot
    let existing_hash: Option<String> = sqlx::query_scalar(
        "SELECT content_hash FROM source_snapshots \
         WHERE source_name = $1 AND source_id = $2",
    )
    .bind(source_name)
    .bind(&record.source_id)
    .fetch_optional(pool)
    .await?;

    let changed = existing_hash.as_deref() != Some(&record.content_hash);

    // Always upsert the snapshot
    sqlx::query(
        "INSERT INTO source_snapshots \
             (id, source_name, source_id, content_hash, raw_payload, fetched_at) \
         VALUES ($1, $2, $3, $4, $5, now()) \
         ON CONFLICT (source_name, source_id) DO UPDATE \
             SET content_hash = EXCLUDED.content_hash, \
                 raw_payload   = EXCLUDED.raw_payload, \
                 fetched_at    = EXCLUDED.fetched_at",
    )
    .bind(Uuid::new_v4())
    .bind(source_name)
    .bind(&record.source_id)
    .bind(&record.content_hash)
    .bind(&record.payload)
    .execute(pool)
    .await?;

    if !changed {
        sqlx::query(
            "INSERT INTO ingestion_items \
                 (id, run_id, source_id, status, created_at) \
             VALUES ($1, $2, $3, 'unchanged', now()) \
             ON CONFLICT (run_id, source_id) DO NOTHING",
        )
        .bind(Uuid::new_v4())
        .bind(run_id)
        .bind(&record.source_id)
        .execute(pool)
        .await?;
        return Ok(false);
    }

    // 3. Normalize the raw payload
    let norm = normalize(source_name, &record.source_id, &record.payload);

    // 4. Compute program_status from application dates
    let program_status = compute_program_status(norm.application_start_at, norm.application_end_at);

    // 5. Upsert into programs table.
    //    search_tsv is built from title + summary + provider_name using the
    //    'simple' text-search config (safe on all PG installs; no Korean
    //    custom dictionary required).
    //    regions is cast to TEXT[] explicitly so SQLx knows the target type.
    let program_id: Uuid = sqlx::query_scalar(
        "INSERT INTO programs ( \
             id, program_type, source_type, source_id, \
             title, summary, provider_name, official_url, \
             program_status, application_start_at, application_end_at, \
             min_age, max_age, regions, \
             raw_payload, normalized_payload, \
             search_tsv, \
             is_active, last_synced_at, created_at, updated_at \
         ) VALUES ( \
             $1,  $2,  $3,  $4, \
             $5,  $6,  $7,  $8, \
             $9,  $10, $11, \
             $12, $13, $14::text[], \
             $15, $16, \
             to_tsvector('simple', \
                 coalesce($5, '') || ' ' || \
                 coalesce($6, '') || ' ' || \
                 coalesce($7, '') \
             ), \
             true, now(), now(), now() \
         ) \
         ON CONFLICT (source_type, source_id) DO UPDATE SET \
             title                = EXCLUDED.title, \
             summary              = EXCLUDED.summary, \
             provider_name        = EXCLUDED.provider_name, \
             official_url         = EXCLUDED.official_url, \
             program_status       = EXCLUDED.program_status, \
             application_start_at = EXCLUDED.application_start_at, \
             application_end_at   = EXCLUDED.application_end_at, \
             min_age              = EXCLUDED.min_age, \
             max_age              = EXCLUDED.max_age, \
             regions              = EXCLUDED.regions, \
             raw_payload          = EXCLUDED.raw_payload, \
             normalized_payload   = EXCLUDED.normalized_payload, \
             search_tsv           = EXCLUDED.search_tsv, \
             last_synced_at       = now(), \
             updated_at           = now() \
         RETURNING id",
    )
    .bind(Uuid::new_v4()) // $1  id
    .bind(&norm.program_type) // $2  program_type
    .bind(source_name) // $3  source_type
    .bind(&record.source_id) // $4  source_id
    .bind(&norm.title) // $5  title
    .bind(&norm.summary) // $6  summary
    .bind(&norm.provider_name) // $7  provider_name
    .bind(&norm.official_url) // $8  official_url
    .bind(&program_status) // $9  program_status
    .bind(norm.application_start_at) // $10 application_start_at
    .bind(norm.application_end_at) // $11 application_end_at
    .bind(norm.min_age) // $12 min_age
    .bind(norm.max_age) // $13 max_age
    .bind(&norm.regions) // $14 regions  (Vec<String> → text[])
    .bind(&record.payload) // $15 raw_payload
    .bind(serde_json::to_value(&norm).ok()) // $16 normalized_payload
    .fetch_one(pool)
    .await?;

    // 6. Record success in ingestion_items
    sqlx::query(
        "INSERT INTO ingestion_items \
             (id, run_id, source_id, program_id, status, created_at) \
         VALUES ($1, $2, $3, $4, 'upserted', now()) \
         ON CONFLICT (run_id, source_id) DO UPDATE \
             SET status = 'upserted', program_id = EXCLUDED.program_id",
    )
    .bind(Uuid::new_v4())
    .bind(run_id)
    .bind(&record.source_id)
    .bind(program_id)
    .execute(pool)
    .await?;

    Ok(true)
}

// ── Normalization ─────────────────────────────────────────────────────────────

#[derive(Debug, serde::Serialize)]
pub struct NormalizedProgram {
    pub program_type: String,
    pub title: String,
    pub summary: Option<String>,
    pub provider_name: Option<String>,
    pub official_url: Option<String>,
    pub application_start_at: Option<chrono::DateTime<Utc>>,
    pub application_end_at: Option<chrono::DateTime<Utc>>,
    pub min_age: Option<i32>,
    pub max_age: Option<i32>,
    pub regions: Vec<String>,
}

fn normalize(
    source_name: &str,
    _source_id: &str,
    payload: &serde_json::Value,
) -> NormalizedProgram {
    match source_name {
        "youth_center" => normalize_youth_center(payload),
        "gov_benefits" => normalize_gov_benefits(payload),
        "scholarship" => normalize_scholarship(payload),
        // local_scraper payloads come from HTML-scraped portals.
        // source_name is always "local_scraper"; the per-portal name lives
        // inside payload["source_portal"]. We dispatch on that inner field.
        "local_scraper" => normalize_local_scraper(payload),
        "fss_financial" => crate::sources::financial::normalize_financial(payload),
        _ => NormalizedProgram {
            program_type: "benefit".into(),
            title: payload["title"].as_str().unwrap_or("Unknown").to_string(),
            summary: None,
            provider_name: None,
            official_url: None,
            application_start_at: None,
            application_end_at: None,
            min_age: None,
            max_age: None,
            regions: vec![],
        },
    }
}

fn normalize_youth_center(p: &serde_json::Value) -> NormalizedProgram {
    let title = p["polyBizSjnm"].as_str().unwrap_or("Unknown").to_string();

    // Prefer sporCn (지원 내용) over polyItcnCn for the summary since it is
    // more concise; fall back to polyItcnCn if sporCn is absent.
    let summary = p["sporCn"]
        .as_str()
        .or_else(|| p["polyItcnCn"].as_str())
        .map(|s| s.to_string());

    let provider_name = p["mngtMson"].as_str().map(|s| s.to_string());
    let official_url = p["rqutUrla"].as_str().map(|s| s.to_string());

    let (min_age, max_age) = parse_age_range(p["ageInfo"].as_str());
    let start = parse_yyyymmdd(p["aplyYmd"].as_str());
    let end = parse_yyyymmdd(p["endYmd"].as_str());

    let regions = p["rgnNm"]
        .as_str()
        .map(|r| {
            r.split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default();

    // polyRlmCd 분야 코드 매핑
    // 023 = 교육(장학금), 024 = 주거·금융, 025 = 취업·창업, 026 = 복지·문화, 027 = 참여·권리
    let program_type = match p["polyRlmCd"].as_str() {
        Some("023") => "scholarship",
        Some("024") => "housing",
        Some("025") => "employment",
        Some("026") => "benefit",
        Some("027") => "benefit",
        _ => "benefit",
    }
    .to_string();

    NormalizedProgram {
        program_type,
        title,
        summary,
        provider_name,
        official_url,
        application_start_at: start,
        application_end_at: end,
        min_age,
        max_age,
        regions,
    }
}

fn normalize_gov_benefits(p: &serde_json::Value) -> NormalizedProgram {
    let title = p["서비스명"].as_str().unwrap_or("Unknown").to_string();
    let summary = p["서비스목적요약"].as_str().map(|s| s.to_string());
    let provider_name = p["소관기관명"].as_str().map(|s| s.to_string());
    let official_url = p["상세조회URL"].as_str().map(|s| s.to_string());

    // 지원대상 and 서비스분야 used to infer program_type
    let program_type = infer_gov_program_type(p["지원대상"].as_str(), p["서비스분야"].as_str());

    NormalizedProgram {
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

fn normalize_scholarship(p: &serde_json::Value) -> NormalizedProgram {
    let title = p["상품명"].as_str().unwrap_or("Unknown").to_string();

    // 지원내역 상세내용 is the most useful summary; fall back to 소득기준 상세내용
    let summary = p["지원내역 상세내용"]
        .as_str()
        .or_else(|| p["소득기준 상세내용"].as_str())
        .map(|s| s.to_string());

    let provider_name = p["운영기관명"].as_str().map(|s| s.to_string());
    let official_url = p["홈페이지 주소"].as_str().map(|s| s.to_string());

    // 모집시작일 / 모집종료일 format is "2024-09-23" (YYYY-MM-DD)
    let start = parse_yyyy_mm_dd(p["모집시작일"].as_str());
    let end = parse_yyyy_mm_dd(p["모집종료일"].as_str());

    NormalizedProgram {
        program_type: "scholarship".into(),
        title,
        summary,
        provider_name,
        official_url,
        application_start_at: start,
        application_end_at: end,
        min_age: None,
        max_age: None,
        regions: vec![],
    }
}

/// Normalise a payload produced by `LocalScraperSource`.
///
/// The payload shape is:
/// ```json
/// {
///   "source_portal": "부산청년센터",
///   "region":        "busan",
///   "title":         "...",
///   "description":   "...",
///   "deadline_text": "...",
///   "link":          "https://...",
///   "raw_html_snippet": "..."
/// }
/// ```
///
/// Deadline text is free-form (e.g. "~2026.04.30", "2026년 4월 30일까지").
/// We do a best-effort parse; unrecognised strings become `None`.
fn normalize_local_scraper(p: &serde_json::Value) -> NormalizedProgram {
    let title = p["title"].as_str().unwrap_or("Unknown").to_string();
    let summary = p["description"].as_str().map(|s| s.to_string());
    let official_url = p["link"].as_str().map(|s| s.to_string());

    // Provider name is the portal name stored in source_portal.
    let provider_name = p["source_portal"].as_str().map(|s| s.to_string());

    // Region comes from the static ScraperSource definition.
    let region = p["region"]
        .as_str()
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
    let regions = region.map(|r| vec![r]).unwrap_or_default();

    // Best-effort deadline parsing from free-form Korean/mixed text.
    let end = p["deadline_text"].as_str().and_then(parse_scraper_deadline);

    // Heuristic program_type from title keywords.
    let program_type = infer_scraper_program_type(title.as_str());

    NormalizedProgram {
        program_type,
        title,
        summary,
        provider_name,
        official_url,
        application_start_at: None,
        application_end_at: end,
        min_age: None,
        max_age: None,
        regions,
    }
}

/// Parse a free-form deadline string into a UTC DateTime.
///
/// Handles common patterns found on Korean government portals:
///   "~2026.04.30"  "2026년 4월 30일" "2026-04-30" "2026/04/30"
/// Returns None for anything that doesn't match.
fn parse_scraper_deadline(s: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    // Strip leading "~" or "까지" and whitespace/punctuation.
    let cleaned = s
        .trim_start_matches('~')
        .trim()
        .trim_end_matches("까지")
        .trim();

    // Try YYYYMMDD (no separator).
    if cleaned.len() == 8 && cleaned.chars().all(|c| c.is_ascii_digit()) {
        return parse_yyyymmdd(Some(cleaned));
    }

    // Extract up to 3 digit runs of length 1-4; interpret as year, month, day.
    let parts: Vec<u32> = cleaned
        .split(|c: char| !c.is_ascii_digit())
        .filter(|t| !t.is_empty() && t.len() <= 4)
        .filter_map(|t| t.parse().ok())
        .collect();

    match parts.as_slice() {
        [y, m, d] if *y >= 2000 && *y <= 2100 => chrono::NaiveDate::from_ymd_opt(*y as i32, *m, *d)
            .and_then(|nd| nd.and_hms_opt(23, 59, 59))
            .map(|dt| dt.and_utc()),
        _ => None,
    }
}

/// Infer program_type from scraped title keywords.
fn infer_scraper_program_type(title: &str) -> String {
    let t = title.to_lowercase();
    if t.contains("장학") || t.contains("학자금") || t.contains("scholarship") {
        "scholarship".into()
    } else if t.contains("주거")
        || t.contains("임대")
        || t.contains("전세")
        || t.contains("청년주택")
    {
        "housing".into()
    } else if t.contains("취업") || t.contains("창업") || t.contains("인턴") || t.contains("고용")
    {
        "employment".into()
    } else {
        "benefit".into()
    }
}

/// Crude heuristic: inspect target/theme text to assign program_type.
fn infer_gov_program_type(target: Option<&str>, theme: Option<&str>) -> String {
    let combined = format!("{} {}", target.unwrap_or(""), theme.unwrap_or("")).to_lowercase();

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

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Determine program_status from application window relative to now (UTC).
///
/// - No dates at all  → "active" (assume always-open)
/// - Before start     → "upcoming"
/// - Within window    → "active"
/// - After end        → "closed"
fn compute_program_status(
    start: Option<chrono::DateTime<Utc>>,
    end: Option<chrono::DateTime<Utc>>,
) -> &'static str {
    let now = Utc::now();
    match (start, end) {
        (None, None) => "active",
        (Some(s), None) => {
            if now < s {
                "upcoming"
            } else {
                "active"
            }
        }
        (None, Some(e)) => {
            if now > e {
                "closed"
            } else {
                "active"
            }
        }
        (Some(s), Some(e)) => {
            if now < s {
                "upcoming"
            } else if now > e {
                "closed"
            } else {
                "active"
            }
        }
    }
}

/// Parse "만 19세 ~ 34세" or "19~34세" → (Some(19), Some(34))
fn parse_age_range(s: Option<&str>) -> (Option<i32>, Option<i32>) {
    let s = match s {
        Some(v) if !v.is_empty() => v,
        _ => return (None, None),
    };
    let digits: Vec<i32> = s
        .split(|c: char| !c.is_ascii_digit())
        .filter(|t| !t.is_empty())
        .filter_map(|t| t.parse().ok())
        // Ignore years like 2024 that are implausible as ages
        .filter(|&n| n <= 100)
        .collect();
    match digits.as_slice() {
        [a] => (Some(*a), Some(*a)),
        [a, b, ..] => (Some(*a), Some(*b)),
        _ => (None, None),
    }
}

/// Parse "YYYYMMDD" → DateTime<Utc>
fn parse_yyyymmdd(s: Option<&str>) -> Option<chrono::DateTime<Utc>> {
    let s = s?;
    if s.len() < 8 {
        return None;
    }
    let year: i32 = s[0..4].parse().ok()?;
    let month: u32 = s[4..6].parse().ok()?;
    let day: u32 = s[6..8].parse().ok()?;
    chrono::NaiveDate::from_ymd_opt(year, month, day)
        .and_then(|d| d.and_hms_opt(0, 0, 0))
        .map(|dt| dt.and_utc())
}

/// Parse "YYYY-MM-DD" → DateTime<Utc>
fn parse_yyyy_mm_dd(s: Option<&str>) -> Option<chrono::DateTime<Utc>> {
    let s = s?;
    if s.len() < 10 {
        return None;
    }
    let year: i32 = s[0..4].parse().ok()?;
    let month: u32 = s[5..7].parse().ok()?;
    let day: u32 = s[8..10].parse().ok()?;
    chrono::NaiveDate::from_ymd_opt(year, month, day)
        .and_then(|d| d.and_hms_opt(0, 0, 0))
        .map(|dt| dt.and_utc())
}
