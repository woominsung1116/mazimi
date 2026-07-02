//! Normalize pipeline: fetch → save raw → hash compare → normalize → upsert programs → log

use anyhow::Result;
use chrono::Utc;
use sqlx::PgPool;
use std::collections::{HashMap, HashSet};
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

    // Cross-source duplicate detection cache (national_welfare ↔ youth_center
    // only — see `find_youth_center_duplicate` doc comment for why
    // local_welfare is intentionally excluded). Loaded once per run, not once
    // per record: it's a handful of KB against ~1-2k youth_center rows.
    let youth_center_cache: Vec<YouthCenterCacheEntry> = if source_name == "national_welfare" {
        match load_youth_center_cache(pool).await {
            Ok(cache) => cache,
            Err(e) => {
                warn!(source = source_name, error = %e, "failed to load youth_center dedup cache, continuing without dedup");
                Vec::new()
            }
        }
    } else {
        Vec::new()
    };

    // youth_center-only: refUrlAddr1/2 values reused across 2+ distinct
    // records within this batch are untrusted as deep links (see
    // `collect_shared_youth_center_ref_urls` doc comment). Computed once per
    // run, not once per record — it's a single pass over the batch already
    // held in memory.
    let shared_youth_center_ref_urls: HashSet<String> = if source_name == "youth_center" {
        collect_shared_youth_center_ref_urls(&records)
    } else {
        HashSet::new()
    };

    let mut changed = 0usize;

    for record in &records {
        match process_record(
            pool,
            source_name,
            run_id,
            record,
            &youth_center_cache,
            &shared_youth_center_ref_urls,
        )
        .await
        {
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
    youth_center_cache: &[YouthCenterCacheEntry],
    shared_youth_center_ref_urls: &HashSet<String>,
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
    let norm = normalize(
        source_name,
        &record.source_id,
        &record.payload,
        shared_youth_center_ref_urls,
    );

    // 3b. Cross-source duplicate check (national_welfare ↔ youth_center only).
    // If this welfare record is a high-confidence duplicate of an existing
    // youth_center program, prefer 복지로's own deep link over youth_center's
    // (often weaker) URL, skip creating a second program row for the same
    // policy, and record the outcome distinctly for operator visibility.
    if !youth_center_cache.is_empty() {
        if let Some(dup) = find_youth_center_duplicate(&norm.title, youth_center_cache) {
            let should_update_url = norm.official_url.is_some()
                && dup
                    .official_url
                    .as_deref()
                    .map(|u| !u.contains("bokjiro.go.kr"))
                    .unwrap_or(true);

            if should_update_url {
                sqlx::query(
                    "UPDATE programs SET official_url = $1, updated_at = now() WHERE id = $2",
                )
                .bind(&norm.official_url)
                .bind(dup.id)
                .execute(pool)
                .await?;
                info!(
                    source = source_name,
                    source_id = %record.source_id,
                    program_id = %dup.id,
                    "duplicate of youth_center program — preferred bokjiro deep link"
                );
            }

            sqlx::query(
                "INSERT INTO ingestion_items \
                     (id, run_id, source_id, program_id, status, created_at) \
                 VALUES ($1, $2, $3, $4, 'duplicate_of_youth_center', now()) \
                 ON CONFLICT (run_id, source_id) DO UPDATE \
                     SET status = 'duplicate_of_youth_center', program_id = EXCLUDED.program_id",
            )
            .bind(Uuid::new_v4())
            .bind(run_id)
            .bind(&record.source_id)
            .bind(dup.id)
            .execute(pool)
            .await?;

            return Ok(true);
        }
    }

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
             application_method, submission_documents, screening_method, \
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
             $17, $18, $19, \
             true, now(), now(), now() \
         ) \
         ON CONFLICT (source_type, source_id) DO UPDATE SET \
             title                 = EXCLUDED.title, \
             summary               = EXCLUDED.summary, \
             provider_name         = EXCLUDED.provider_name, \
             official_url          = EXCLUDED.official_url, \
             program_status        = EXCLUDED.program_status, \
             application_start_at  = EXCLUDED.application_start_at, \
             application_end_at    = EXCLUDED.application_end_at, \
             min_age               = EXCLUDED.min_age, \
             max_age               = EXCLUDED.max_age, \
             regions               = EXCLUDED.regions, \
             raw_payload           = EXCLUDED.raw_payload, \
             normalized_payload    = EXCLUDED.normalized_payload, \
             search_tsv            = EXCLUDED.search_tsv, \
             application_method    = EXCLUDED.application_method, \
             submission_documents  = EXCLUDED.submission_documents, \
             screening_method      = EXCLUDED.screening_method, \
             last_synced_at        = now(), \
             updated_at            = now() \
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
    .bind(program_status) // $9  program_status
    .bind(norm.application_start_at) // $10 application_start_at
    .bind(norm.application_end_at) // $11 application_end_at
    .bind(norm.min_age) // $12 min_age
    .bind(norm.max_age) // $13 max_age
    .bind(&norm.regions) // $14 regions  (Vec<String> → text[])
    .bind(&record.payload) // $15 raw_payload
    .bind(serde_json::to_value(&norm).ok()) // $16 normalized_payload
    .bind(&norm.application_method) // $17 application_method
    .bind(&norm.submission_documents) // $18 submission_documents
    .bind(&norm.screening_method) // $19 screening_method
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
    /// 신청 방법 안내 텍스트 (신청 가이드 카드용)
    pub application_method: Option<String>,
    /// 제출 서류 안내 텍스트 (신청 가이드 카드용)
    pub submission_documents: Option<String>,
    /// 심사 방법 안내 텍스트 (신청 가이드 카드용)
    pub screening_method: Option<String>,
}

fn normalize(
    source_name: &str,
    _source_id: &str,
    payload: &serde_json::Value,
    shared_youth_center_ref_urls: &HashSet<String>,
) -> NormalizedProgram {
    match source_name {
        "youth_center" => normalize_youth_center(payload, shared_youth_center_ref_urls),
        "gov_benefits" => normalize_gov_benefits(payload),
        "scholarship" => normalize_scholarship(payload),
        // local_scraper payloads come from HTML-scraped portals.
        // source_name is always "local_scraper"; the per-portal name lives
        // inside payload["source_portal"]. We dispatch on that inner field.
        "local_scraper" => normalize_local_scraper(payload),
        "fss_financial" => crate::sources::financial::normalize_financial(payload),
        "national_welfare" => crate::sources::national_welfare::normalize_national_welfare(payload),
        "local_welfare" => crate::sources::local_welfare::normalize_local_welfare(payload),
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
            application_method: None,
            submission_documents: None,
            screening_method: None,
        },
    }
}

fn normalize_youth_center(
    p: &serde_json::Value,
    shared_ref_urls: &HashSet<String>,
) -> NormalizedProgram {
    let title = p["plcyNm"].as_str().unwrap_or("Unknown").to_string();

    // plcySprtCn (지원 내용) → plcyExplnCn (정책 설명) 순 fallback
    let summary = p["plcySprtCn"]
        .as_str()
        .or_else(|| p["plcyExplnCn"].as_str())
        .map(|s| s.to_string());

    let provider_name = p["sprvsnInstCdNm"].as_str().map(|s| s.to_string());

    // URL selection: prefer the most "specific" (non-homepage) candidate.
    // aplyUrlAddr is populated on only ~19% of records and is often just the
    // provider's bare homepage; refUrlAddr1/2 frequently point to the actual
    // detail/application page instead. When none of those are specific, fall
    // back to 온통청년's own detail page (built from plcyNo), which renders a
    // real detail/apply page for ~100% of records. See select_official_url
    // for the full priority rules.
    let official_url = select_official_url(
        p["aplyUrlAddr"].as_str(),
        p["refUrlAddr1"].as_str(),
        p["refUrlAddr2"].as_str(),
        p["plcyNo"].as_str(),
        shared_ref_urls,
    );

    // 신청 가이드 텍스트 필드 (모바일 가이드 카드용 원문 캡처)
    let application_method = p["plcyAplyMthdCn"].as_str().map(|s| s.to_string());
    let submission_documents = p["sbmsnDcmntCn"].as_str().map(|s| s.to_string());
    let screening_method = p["srngMthdCn"].as_str().map(|s| s.to_string());

    let min_age = p["sprtTrgtMinAge"]
        .as_str()
        .and_then(|s| s.parse::<i32>().ok());
    let max_age = p["sprtTrgtMaxAge"]
        .as_str()
        .and_then(|s| s.parse::<i32>().ok());

    // aplyYmd: "YYYYMMDD ~ YYYYMMDD" 형식
    let (start, end) = if let Some(aply) = p["aplyYmd"].as_str() {
        let parts: Vec<&str> = aply.split('~').map(|s| s.trim()).collect();
        (
            parts.first().and_then(|s| parse_yyyymmdd(Some(s))),
            parts.get(1).and_then(|s| parse_yyyymmdd(Some(s))),
        )
    } else {
        (None, None)
    };

    // lclsfNm (대분류) 기반 타입 매핑
    let lclsf = p["lclsfNm"].as_str().unwrap_or("");
    let keyword = p["plcyKywdNm"].as_str().unwrap_or("");
    let combined = format!("{} {}", lclsf, keyword);

    let program_type = if combined.contains("장학") || combined.contains("학자금") {
        "scholarship"
    } else if combined.contains("주거") || combined.contains("임대") || combined.contains("전세")
    {
        "housing"
    } else if combined.contains("일자리")
        || combined.contains("취업")
        || combined.contains("창업")
        || combined.contains("고용")
    {
        "employment"
    } else if combined.contains("교육") {
        "scholarship"
    } else {
        "benefit"
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
        regions: vec![],
        application_method,
        submission_documents,
        screening_method,
    }
}

/// Pick the most "specific" URL from the 온통청년 candidate fields
/// (aplyUrlAddr, refUrlAddr1, refUrlAddr2), falling back to the platform's
/// own detail page (keyed by plcyNo) before giving up entirely.
///
/// "특정" (specific) means the URL is http/https AND has a path beyond the
/// bare domain (e.g. `/notice/view.do`) or a query string (e.g. `?id=42`).
/// A bare homepage like `https://example.go.kr` or `https://example.go.kr/`
/// is NOT specific.
///
/// `shared_ref_urls` is the batch-wide set of refUrlAddr1/2 values that were
/// observed on 2+ distinct records (see
/// `collect_shared_youth_center_ref_urls`). 온통청년 occasionally copy-pastes
/// the same refUrl into unrelated policy records — e.g. two different
/// plcyNo both pointing at the same 경남 detail page (policy_no=1816). A
/// refUrl in this set is untrusted as a deep link and is skipped as if it
/// weren't specific, even though its shape passes `is_specific_url`.
/// aplyUrlAddr is never subject to this guard — it's the provider's own
/// authoritative apply link, not a copy-pasted reference. Pass an empty set
/// to disable the guard entirely (existing callers/behavior unaffected).
///
/// Priority order:
///   1. specific aplyUrlAddr
///   2. specific refUrlAddr1, unless it's in `shared_ref_urls`
///   3. specific refUrlAddr2, unless it's in `shared_ref_urls`
///   4. (no specific/trusted candidate) 온통청년 detail page built from
///      plcyNo —
///      `https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail/{plcyNo}`.
///      Verified via curl to return 200 for records with a plcyNo, and always
///      renders a real detail/apply page (never a bare homepage).
///   5. (no plcyNo either) non-empty aplyUrlAddr
///   6. (no plcyNo, no aplyUrlAddr) refUrlAddr1
///
/// Any URL candidate that isn't http/https (e.g. plain text like "전화문의")
/// is discarded entirely.
fn select_official_url(
    aply_url: Option<&str>,
    ref_url1: Option<&str>,
    ref_url2: Option<&str>,
    plcy_no: Option<&str>,
    shared_ref_urls: &HashSet<String>,
) -> Option<String> {
    fn clean(s: Option<&str>) -> Option<&str> {
        s.map(|s| s.trim())
            .filter(|s| !s.is_empty() && is_http_url(s))
    }

    let aply = clean(aply_url);
    let ref1 = clean(ref_url1);
    let ref2 = clean(ref_url2);

    if let Some(u) = aply.filter(|u| is_specific_url(u)) {
        return Some(u.to_string());
    }
    if let Some(u) = ref1.filter(|u| is_specific_url(u) && !is_shared_ref_url(u, shared_ref_urls)) {
        return Some(u.to_string());
    }
    if let Some(u) = ref2.filter(|u| is_specific_url(u) && !is_shared_ref_url(u, shared_ref_urls)) {
        return Some(u.to_string());
    }

    // No specific candidate among aply/ref1/ref2 — fall back to 온통청년's
    // own detail page, which is guaranteed to be a real detail/apply page
    // (not a bare homepage) for any valid plcyNo.
    if let Some(no) = plcy_no.map(|s| s.trim()).filter(|s| !s.is_empty()) {
        return Some(youth_center_detail_url(no));
    }

    // No plcyNo either — fall back to whatever non-empty http(s) URL exists,
    // preferring aplyUrlAddr over refUrlAddr1.
    // (refUrlAddr2 is intentionally excluded from this bare fallback.)
    aply.or(ref1).map(|u| u.to_string())
}

/// Build the 온통청년 platform's own detail page URL for a given plcyNo.
/// This always renders a real detail page with an apply button, unlike the
/// provider-supplied aplyUrlAddr/refUrlAddr fields which are frequently a
/// bare homepage or empty.
fn youth_center_detail_url(plcy_no: &str) -> String {
    format!("https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail/{plcy_no}")
}

/// Aggregate refUrlAddr1/2 values that appear as a *specific* URL (see
/// `is_specific_url`) on 2+ distinct records (identified by `source_id`,
/// i.e. plcyNo — see `youth_center::fetch_all`) within a single youth_center
/// ingestion batch.
///
/// This exists because the upstream API occasionally copy-pastes the same
/// refUrl into unrelated policy records — observed in production: two
/// different plcyNo values both carrying the same 경남 detail page as their
/// refUrl (policy_no=1816). Trusting that refUrl as a deep link sends the
/// user to the wrong policy's detail page. `select_official_url` consults
/// the returned set (via `is_shared_ref_url`) and refuses to use a refUrl
/// found here as a deep link, falling back to 온통청년's own plcyNo detail
/// page instead.
///
/// Only meaningful for the youth_center source — see the call site in
/// `process_source`, which only computes a non-empty set when
/// `source_name == "youth_center"`. No effect on national_welfare,
/// local_welfare, gov_benefits, etc.
///
/// Normalization for the dedup comparison is deliberately minimal (trim +
/// strip trailing slash, via `normalize_ref_url_for_dedup`) so we don't mask
/// genuinely different URLs as duplicates. Only "specific" candidates are
/// tracked — a bare homepage shared across many unrelated policies is
/// common and legitimate (it was never going to win the "specific" priority
/// tier anyway), so including it here would just be noise.
fn collect_shared_youth_center_ref_urls(records: &[RawRecord]) -> HashSet<String> {
    let mut owners: HashMap<String, HashSet<&str>> = HashMap::new();

    for record in records {
        for field in ["refUrlAddr1", "refUrlAddr2"] {
            let Some(raw) = record.payload[field].as_str() else {
                continue;
            };
            let trimmed = raw.trim();
            if trimmed.is_empty() || !is_http_url(trimmed) || !is_specific_url(trimmed) {
                continue;
            }
            owners
                .entry(normalize_ref_url_for_dedup(trimmed))
                .or_default()
                .insert(record.source_id.as_str());
        }
    }

    owners
        .into_iter()
        .filter(|(_, source_ids)| source_ids.len() >= 2)
        .map(|(url, _)| url)
        .collect()
}

/// Returns true if `url` (after minimal normalization) is in the batch-wide
/// shared/untrusted refUrl set produced by
/// `collect_shared_youth_center_ref_urls`.
fn is_shared_ref_url(url: &str, shared_ref_urls: &HashSet<String>) -> bool {
    shared_ref_urls.contains(&normalize_ref_url_for_dedup(url))
}

/// Minimal normalization for refUrl dedup comparison: trim whitespace and
/// strip trailing slash(es). Deliberately does NOT lowercase, strip query
/// strings, or otherwise touch the URL — over-normalizing risks treating
/// genuinely different pages as the same shared/untrusted URL.
fn normalize_ref_url_for_dedup(url: &str) -> String {
    url.trim().trim_end_matches('/').to_string()
}

/// Returns true if `s` starts with an http/https scheme.
fn is_http_url(s: &str) -> bool {
    s.starts_with("http://") || s.starts_with("https://")
}

/// Returns true if the URL has a path beyond the bare domain or a query
/// string. Caller must already ensure `url` is http/https.
fn is_specific_url(url: &str) -> bool {
    let rest = url.split_once("://").map_or(url, |(_, rest)| rest);
    match rest.find('/') {
        // No slash after the domain at all — only specific if there's a
        // query string glued directly onto the domain (rare, but handle it).
        None => rest.contains('?'),
        Some(idx) => {
            let after_domain = &rest[idx..]; // starts with '/'
            !after_domain.trim_start_matches('/').is_empty()
        }
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
        application_method: None,
        submission_documents: None,
        screening_method: None,
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
        application_method: None,
        submission_documents: None,
        screening_method: None,
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
        application_method: None,
        submission_documents: None,
        screening_method: None,
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

// ── Cross-source duplicate detection (national_welfare ↔ youth_center) ──────
//
// Both 온통청년(youth_center) and 한국사회보장정보원 중앙부처 복지서비스
// (national_welfare) list overlapping "청년" programs — e.g. 청년내일저축계좌,
// 국민취업지원제도, 청년월세 지원사업. When the same policy exists in both,
// 복지로's own deep link (servDtlLink, already flowing into
// `official_url` via `normalize_national_welfare`) is a stronger URL than
// youth_center's frequently bare/homepage aplyUrlAddr/refUrlAddr fields, and
// showing the user two cards for one policy hurts recommendation quality.
//
// Measured 2026-07 (164 청년-tagged national_welfare records × ~1,900
// youth_center records, Dice-coefficient over character bigrams of
// normalized titles): a clean gap separates real duplicates from distinct
// programs — 10/164 (6.1%) score exactly 1.0 (all manually confirmed as the
// same policy, e.g. "청년내일저축계좌" ↔ "청년내일저축계좌",
// "청년월세 지원사업" ↔ "2026년 청년월세 지원사업"), and the very next
// closest pair scores only 0.889 and is a genuinely different program
// ("평생교육이용권 지원" ↔ "평생교육이용권 지원사업" is fine at 0.889, but
// e.g. 국토교통부's nationwide "대중교통비 환급 지원(모두의카드)" only scores
// 0.857 against Incheon-only "인천형 대중교통비 환급 지원(인천 i-패스)" — same
// theme, different program, correctly rejected). THRESHOLD sits in that gap.
//
// local_welfare is intentionally EXCLUDED from this check. The same
// measurement against local_welfare's 1,202 청년-tagged records showed the
// opposite pattern: dozens of *generically named* city/county programs
// (공공근로사업, 결혼축하금 지원사업, 청년 이사비 지원사업, 청년 자격증 응시료
// 지원사업 …) are independently registered by many different jurisdictions
// and all collapse onto the same single youth_center row under title-only
// matching — e.g. 9+ distinct cities' own "공공근로사업" all best-match the
// one generic youth_center "공공근로사업" record. Region cross-checking isn't
// available to disambiguate because `normalize_youth_center` always sets
// `regions: vec![]` (see pipeline.rs normalize_youth_center). Auto-updating
// official_url in that scenario risks attaching one city's bokjiro link to a
// completely different city's program — a correctness bug worse than the
// duplicate cards it would "fix". Do not enable this path for local_welfare
// without first adding a region-aware corroboration signal (e.g. capturing
// region on youth_center programs, or cross-checking bizChrDeptNm against
// youth_center's sprvsnInstCdNm/operInstCdNm).
const YOUTH_CENTER_DUP_THRESHOLD: f64 = 0.97;

struct YouthCenterCacheEntry {
    id: Uuid,
    title: String,
    official_url: Option<String>,
}

/// Load all currently-active youth_center programs (id, title, official_url)
/// for in-memory duplicate matching. Cheap at current scale (~1-2k rows);
/// run once per national_welfare ingestion run, not once per record.
async fn load_youth_center_cache(pool: &PgPool) -> Result<Vec<YouthCenterCacheEntry>> {
    let rows: Vec<(Uuid, String, Option<String>)> = sqlx::query_as(
        "SELECT id, title, official_url FROM programs \
         WHERE source_type = 'youth_center' AND is_active = true",
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(id, title, official_url)| YouthCenterCacheEntry {
            id,
            title,
            official_url,
        })
        .collect())
}

/// Find the best-matching youth_center cache entry for `title`, if its
/// similarity clears `YOUTH_CENTER_DUP_THRESHOLD`.
fn find_youth_center_duplicate<'a>(
    title: &str,
    cache: &'a [YouthCenterCacheEntry],
) -> Option<&'a YouthCenterCacheEntry> {
    let norm_title = normalize_title_for_dedup(title);
    if norm_title.chars().count() < 2 {
        return None;
    }

    let mut best_ratio = 0.0f64;
    let mut best: Option<&YouthCenterCacheEntry> = None;
    for entry in cache {
        let ratio = dice_bigram_similarity(&norm_title, &normalize_title_for_dedup(&entry.title));
        if ratio > best_ratio {
            best_ratio = ratio;
            best = Some(entry);
        }
    }

    if best_ratio >= YOUTH_CENTER_DUP_THRESHOLD {
        best
    } else {
        None
    }
}

/// Normalize a program title for duplicate detection: strip parenthetical
/// notes, bare 4-digit years (optionally followed by "년"), stray
/// digits/punctuation, and all whitespace. Mirrors the offline measurement
/// script used to calibrate `YOUTH_CENTER_DUP_THRESHOLD`.
fn normalize_title_for_dedup(title: &str) -> String {
    let no_parens = strip_parenthetical(title);
    let chars: Vec<char> = no_parens.chars().collect();
    let mut out = String::with_capacity(chars.len());
    let mut i = 0;
    while i < chars.len() {
        // Skip a run of 4 digits (a year mention), optionally followed by '년'.
        if i + 4 <= chars.len() && chars[i..i + 4].iter().all(|c| c.is_ascii_digit()) {
            i += 4;
            if i < chars.len() && chars[i] == '년' {
                i += 1;
            }
            continue;
        }
        let c = chars[i];
        if c.is_whitespace() || c.is_ascii_digit() || matches!(c, '.' | '-' | '/' | ':' | '~' | ',')
        {
            i += 1;
            continue;
        }
        out.push(c);
        i += 1;
    }
    out
}

/// Strip `(...)` parenthetical notes (non-nested-aware but tolerant of stray
/// unmatched parens, since these are free-text government titles).
fn strip_parenthetical(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut depth = 0i32;
    for c in s.chars() {
        match c {
            '(' => depth += 1,
            ')' => {
                if depth > 0 {
                    depth -= 1;
                }
            }
            _ if depth == 0 => out.push(c),
            _ => {}
        }
    }
    out
}

/// Sørensen-Dice coefficient over character bigrams (multiset intersection).
/// Unicode-safe: operates on `char`, not bytes, so multi-byte Korean
/// characters are never split mid-codepoint.
fn dice_bigram_similarity(a: &str, b: &str) -> f64 {
    fn bigrams(s: &str) -> Vec<(char, char)> {
        let chars: Vec<char> = s.chars().collect();
        if chars.len() < 2 {
            return Vec::new();
        }
        chars.windows(2).map(|w| (w[0], w[1])).collect()
    }

    let ba = bigrams(a);
    let bb = bigrams(b);
    if ba.is_empty() || bb.is_empty() {
        return 0.0;
    }

    let mut counts: HashMap<(char, char), i32> = HashMap::new();
    for bg in &ba {
        *counts.entry(*bg).or_insert(0) += 1;
    }
    let mut intersection = 0i32;
    for bg in &bb {
        if let Some(c) = counts.get_mut(bg) {
            if *c > 0 {
                *c -= 1;
                intersection += 1;
            }
        }
    }

    2.0 * intersection as f64 / (ba.len() + bb.len()) as f64
}

#[cfg(test)]
mod dedup_tests {
    use super::*;

    fn entry(id: Uuid, title: &str, official_url: Option<&str>) -> YouthCenterCacheEntry {
        YouthCenterCacheEntry {
            id,
            title: title.to_string(),
            official_url: official_url.map(String::from),
        }
    }

    // ── normalize_title_for_dedup ────────────────────────────────────────

    #[test]
    fn strips_year_prefix_and_parens_and_whitespace() {
        assert_eq!(
            normalize_title_for_dedup("2026년 청년월세 지원사업"),
            normalize_title_for_dedup("청년월세 지원사업")
        );
        assert_eq!(
            normalize_title_for_dedup("(동구) 2026년 동구 청년 컬처페이 지원사업 (접수마감)"),
            "동구청년컬처페이지원사업"
        );
    }

    // ── dice_bigram_similarity ────────────────────────────────────────────

    #[test]
    fn identical_strings_score_one() {
        assert_eq!(
            dice_bigram_similarity("청년내일저축계좌", "청년내일저축계좌"),
            1.0
        );
    }

    #[test]
    fn completely_different_strings_score_zero() {
        assert_eq!(dice_bigram_similarity("가나다라", "마바사아"), 0.0);
    }

    #[test]
    fn real_duplicate_pair_clears_threshold() {
        // 국민취업지원제도: identical in both sources after normalization.
        let a = normalize_title_for_dedup("국민취업지원제도");
        let b = normalize_title_for_dedup("국민취업지원제도");
        assert!(dice_bigram_similarity(&a, &b) >= YOUTH_CENTER_DUP_THRESHOLD);
    }

    #[test]
    fn distinct_regional_variant_does_not_clear_threshold() {
        // Measured false-positive guard: 국토교통부의 전국 단위 "대중교통비 환급
        // 지원(모두의카드)" vs 인천시 전용 "인천형 대중교통비 환급 지원(인천
        // i-패스)" — same theme, different program. Must stay below threshold.
        let a = normalize_title_for_dedup("대중교통비 환급 지원(모두의카드)");
        let b = normalize_title_for_dedup("인천형 대중교통비 환급 지원(인천 i-패스)");
        assert!(dice_bigram_similarity(&a, &b) < YOUTH_CENTER_DUP_THRESHOLD);
    }

    // ── find_youth_center_duplicate ──────────────────────────────────────

    #[test]
    fn finds_high_confidence_duplicate() {
        let id = Uuid::new_v4();
        let cache = vec![
            entry(id, "청년내일저축계좌", Some("https://example.go.kr")),
            entry(
                Uuid::new_v4(),
                "청년 부동산 중개보수 및 이사비 지원사업",
                None,
            ),
        ];
        let dup = find_youth_center_duplicate("청년내일저축계좌", &cache);
        assert!(dup.is_some());
        assert_eq!(dup.unwrap().id, id);
    }

    #[test]
    fn does_not_match_below_threshold() {
        let cache = vec![entry(
            Uuid::new_v4(),
            "인천형 대중교통비 환급 지원(인천 i-패스)",
            None,
        )];
        let dup = find_youth_center_duplicate("대중교통비 환급 지원(모두의카드)", &cache);
        assert!(dup.is_none());
    }

    #[test]
    fn empty_cache_never_matches() {
        assert!(find_youth_center_duplicate("청년내일저축계좌", &[]).is_none());
    }
}

#[cfg(test)]
mod official_url_tests {
    use super::*;

    /// Shorthand for "guard disabled" — matches pre-guard call sites/behavior.
    fn no_shared() -> HashSet<String> {
        HashSet::new()
    }

    // ── is_specific_url ──────────────────────────────────────────────────

    #[test]
    fn bare_homepage_is_not_specific() {
        assert!(!is_specific_url("https://example.go.kr"));
        assert!(!is_specific_url("https://example.go.kr/"));
    }

    #[test]
    fn path_makes_it_specific() {
        assert!(is_specific_url("https://example.go.kr/notice/view.do"));
        assert!(is_specific_url("http://example.go.kr/apply/123"));
    }

    #[test]
    fn query_string_makes_it_specific() {
        assert!(is_specific_url("https://example.go.kr/board/detail?no=7"));
        // Query glued directly onto the bare domain (no slash at all).
        assert!(is_specific_url("https://example.go.kr?no=7"));
    }

    // ── select_official_url ──────────────────────────────────────────────

    #[test]
    fn prefers_specific_aply_url_over_everything() {
        let result = select_official_url(
            Some("https://apply.example.go.kr/apply/123"),
            Some("https://example.go.kr/notice/view.do?id=42"),
            Some("https://example.go.kr/board/detail?no=7"),
            Some("12345"),
            &no_shared(),
        );
        assert_eq!(
            result,
            Some("https://apply.example.go.kr/apply/123".to_string())
        );
    }

    #[test]
    fn falls_back_to_specific_ref_url1_when_aply_is_bare_homepage() {
        let result = select_official_url(
            Some("https://example.go.kr"),
            Some("https://example.go.kr/notice/view.do?id=42"),
            None,
            Some("12345"),
            &no_shared(),
        );
        assert_eq!(
            result,
            Some("https://example.go.kr/notice/view.do?id=42".to_string())
        );
    }

    #[test]
    fn falls_back_to_specific_ref_url2_when_aply_and_ref1_are_bare() {
        let result = select_official_url(
            Some("https://example.go.kr"),
            Some("https://example.go.kr/"),
            Some("https://example.go.kr/board/detail?no=7"),
            Some("12345"),
            &no_shared(),
        );
        assert_eq!(
            result,
            Some("https://example.go.kr/board/detail?no=7".to_string())
        );
    }

    #[test]
    fn falls_back_to_youth_center_detail_page_when_nothing_is_specific() {
        // aply/ref1 are bare homepages and ref2 is absent, but plcyNo is
        // present — the 온통청년 detail page template must win over the bare
        // homepage fallback (this is the ~37% case that used to dead-end on
        // a bare homepage before the plcyNo fallback was added).
        let result = select_official_url(
            Some("https://example.go.kr"),
            Some("https://example.go.kr/"),
            None,
            Some("12345"),
            &no_shared(),
        );
        assert_eq!(
            result,
            Some(
                "https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail/12345"
                    .to_string()
            )
        );
    }

    #[test]
    fn youth_center_detail_page_wins_over_bare_fallback_even_with_no_ref_urls() {
        // No ref URLs at all, only a bare aply homepage + plcyNo. The detail
        // page template still takes priority over falling back to the bare
        // aply URL.
        let result = select_official_url(
            Some("https://example.go.kr/"),
            None,
            None,
            Some("999"),
            &no_shared(),
        );
        assert_eq!(
            result,
            Some(
                "https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail/999"
                    .to_string()
            )
        );
    }

    #[test]
    fn falls_back_to_bare_aply_url_when_nothing_specific_and_no_plcy_no() {
        let result = select_official_url(
            Some("https://example.go.kr"),
            Some("https://example.go.kr/"),
            None,
            None,
            &no_shared(),
        );
        assert_eq!(result, Some("https://example.go.kr".to_string()));
    }

    #[test]
    fn falls_back_to_ref_url1_when_aply_is_empty_and_no_plcy_no() {
        let result = select_official_url(
            Some(""),
            Some("https://example.go.kr"),
            None,
            None,
            &no_shared(),
        );
        assert_eq!(result, Some("https://example.go.kr".to_string()));
    }

    #[test]
    fn blank_plcy_no_is_treated_as_absent() {
        // Whitespace-only plcyNo must not produce a bogus detail URL; it
        // should fall through to the bare-URL fallback tier.
        let result = select_official_url(
            Some("https://example.go.kr"),
            None,
            None,
            Some("   "),
            &no_shared(),
        );
        assert_eq!(result, Some("https://example.go.kr".to_string()));
    }

    #[test]
    fn returns_none_when_everything_is_empty_or_missing() {
        assert_eq!(
            select_official_url(None, None, None, None, &no_shared()),
            None
        );
        assert_eq!(
            select_official_url(Some(""), Some(""), Some(""), Some(""), &no_shared()),
            None
        );
    }

    #[test]
    fn rejects_non_http_schemes_and_plain_text() {
        // Non-http scheme and plain Korean text (e.g. "전화문의") must be
        // discarded entirely, even though they're non-empty. With no plcyNo
        // either, the result is None.
        let result = select_official_url(
            Some("ftp://example.com/file"),
            Some("전화문의"),
            None,
            None,
            &no_shared(),
        );
        assert_eq!(result, None);
    }

    #[test]
    fn bare_fallback_ignores_ref_url2() {
        // When only ref_url2 is a non-empty candidate (bare or otherwise),
        // aply/ref1 are absent, and there's no plcyNo, the spec says the
        // bare fallback should NOT reach into ref_url2 — but a *specific*
        // ref_url2 still wins earlier in the priority chain. This test
        // covers the case where ref_url2 is itself just a bare homepage: no
        // candidate should be returned.
        let result = select_official_url(
            None,
            None,
            Some("https://example.go.kr"),
            None,
            &no_shared(),
        );
        assert_eq!(result, None);
    }

    // ── shared/untrusted refUrl guard ─────────────────────────────────────

    #[test]
    fn shared_specific_ref_url1_is_skipped_in_favor_of_plcy_no_fallback() {
        // The real-world bug this guards against: two different plcyNo
        // records both carry the same (specific) refUrlAddr1, e.g. a
        // copy-pasted 경남 detail page. That refUrl must not be trusted as
        // this record's deep link — the plcyNo detail-page fallback wins
        // instead, even though ref1 passes is_specific_url.
        let shared: HashSet<String> = ["https://example.go.kr/policy?no=1816".to_string()].into();
        let result = select_official_url(
            None,
            Some("https://example.go.kr/policy?no=1816"),
            None,
            Some("12345"),
            &shared,
        );
        assert_eq!(
            result,
            Some(
                "https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail/12345"
                    .to_string()
            )
        );
    }

    #[test]
    fn shared_specific_ref_url1_falls_through_to_specific_ref_url2_when_ref2_is_untainted() {
        // ref1 is shared/untrusted but ref2 is a distinct, non-shared,
        // specific URL — ref2 should still win over jumping straight to the
        // plcyNo fallback.
        let shared: HashSet<String> = ["https://example.go.kr/policy?no=1816".to_string()].into();
        let result = select_official_url(
            None,
            Some("https://example.go.kr/policy?no=1816"),
            Some("https://example.go.kr/board/detail?no=7"),
            Some("12345"),
            &shared,
        );
        assert_eq!(
            result,
            Some("https://example.go.kr/board/detail?no=7".to_string())
        );
    }

    #[test]
    fn shared_ref_url_guard_ignores_unrelated_urls() {
        // Regression safety: a shared set containing some other URL must not
        // affect selection of an unrelated, non-shared ref1.
        let shared: HashSet<String> = ["https://other.go.kr/detail?no=1".to_string()].into();
        let result = select_official_url(
            None,
            Some("https://example.go.kr/notice/view.do?id=42"),
            None,
            Some("12345"),
            &shared,
        );
        assert_eq!(
            result,
            Some("https://example.go.kr/notice/view.do?id=42".to_string())
        );
    }

    #[test]
    fn shared_ref_url_guard_normalizes_trailing_slash_before_matching() {
        // collect_shared_youth_center_ref_urls normalizes with a trailing
        // slash stripped; select_official_url must compare using the same
        // normalization so a trailing-slash mismatch doesn't let a shared
        // URL slip through.
        let shared: HashSet<String> = ["https://example.go.kr/policy/1816".to_string()].into();
        let result = select_official_url(
            None,
            Some("https://example.go.kr/policy/1816/"),
            None,
            Some("12345"),
            &shared,
        );
        assert_eq!(
            result,
            Some(
                "https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch/ythPlcyDetail/12345"
                    .to_string()
            )
        );
    }

    #[test]
    fn aply_url_is_never_guarded_even_if_present_in_shared_set() {
        // aplyUrlAddr is the provider's own authoritative apply link, never a
        // copy-pasted reference — the shared-refUrl guard must not apply to
        // it even if (hypothetically) the exact same string shows up in the
        // shared set.
        let shared: HashSet<String> = ["https://apply.example.go.kr/apply/123".to_string()].into();
        let result = select_official_url(
            Some("https://apply.example.go.kr/apply/123"),
            None,
            None,
            Some("12345"),
            &shared,
        );
        assert_eq!(
            result,
            Some("https://apply.example.go.kr/apply/123".to_string())
        );
    }

    // ── collect_shared_youth_center_ref_urls ──────────────────────────────

    fn raw_record(source_id: &str, ref1: Option<&str>, ref2: Option<&str>) -> RawRecord {
        RawRecord {
            source_id: source_id.to_string(),
            payload: serde_json::json!({
                "refUrlAddr1": ref1,
                "refUrlAddr2": ref2,
            }),
            content_hash: "irrelevant".to_string(),
        }
    }

    #[test]
    fn flags_ref_url_shared_across_two_distinct_plcy_no() {
        let records = vec![
            raw_record("111", Some("https://example.go.kr/policy?no=1816"), None),
            raw_record("222", Some("https://example.go.kr/policy?no=1816"), None),
        ];
        let shared = collect_shared_youth_center_ref_urls(&records);
        assert!(shared.contains("https://example.go.kr/policy?no=1816"));
    }

    #[test]
    fn flags_ref_url_shared_across_ref1_and_ref2_slots() {
        // The bug isn't tied to a specific field — the same URL value can
        // land in refUrlAddr1 on one record and refUrlAddr2 on another.
        let records = vec![
            raw_record("111", Some("https://example.go.kr/policy?no=1816"), None),
            raw_record("222", None, Some("https://example.go.kr/policy?no=1816")),
        ];
        let shared = collect_shared_youth_center_ref_urls(&records);
        assert!(shared.contains("https://example.go.kr/policy?no=1816"));
    }

    #[test]
    fn does_not_flag_ref_url_appearing_once_per_record_even_in_both_slots() {
        // Same plcyNo (single distinct owner) using the identical URL in
        // both ref1 and ref2 is not the bug pattern — only 2+ *distinct*
        // records sharing a URL should be flagged.
        let records = vec![raw_record(
            "111",
            Some("https://example.go.kr/policy?no=1816"),
            Some("https://example.go.kr/policy?no=1816"),
        )];
        let shared = collect_shared_youth_center_ref_urls(&records);
        assert!(shared.is_empty());
    }

    #[test]
    fn does_not_flag_distinct_ref_urls() {
        let records = vec![
            raw_record("111", Some("https://example.go.kr/policy?no=1816"), None),
            raw_record("222", Some("https://example.go.kr/policy?no=2000"), None),
        ];
        let shared = collect_shared_youth_center_ref_urls(&records);
        assert!(shared.is_empty());
    }

    #[test]
    fn does_not_flag_shared_bare_homepage() {
        // Many unrelated policies legitimately share the same provider
        // homepage as refUrlAddr1 — that's not the copy-paste bug and must
        // not be flagged (it wouldn't win the "specific" priority tier
        // anyway, but keeping it out of the set keeps the guard's intent
        // clear).
        let records = vec![
            raw_record("111", Some("https://example.go.kr"), None),
            raw_record("222", Some("https://example.go.kr"), None),
        ];
        let shared = collect_shared_youth_center_ref_urls(&records);
        assert!(shared.is_empty());
    }

    #[test]
    fn matches_shared_url_regardless_of_trailing_slash_variance() {
        let records = vec![
            raw_record("111", Some("https://example.go.kr/policy/1816"), None),
            raw_record("222", Some("https://example.go.kr/policy/1816/"), None),
        ];
        let shared = collect_shared_youth_center_ref_urls(&records);
        assert!(shared.contains("https://example.go.kr/policy/1816"));
    }

    #[test]
    fn empty_batch_yields_empty_set() {
        assert!(collect_shared_youth_center_ref_urls(&[]).is_empty());
    }
}
