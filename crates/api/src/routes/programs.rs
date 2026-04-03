use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use mazimi_core::models::Program;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

// ── Query parameters ────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ProgramQuery {
    /// Full-text search query (searches against search_tsv)
    pub q: Option<String>,
    /// Filter by program_type: policy | welfare | scholarship
    pub category: Option<String>,
    /// Filter by region (matched against regions TEXT[])
    pub region: Option<String>,
    /// Filter by program_status: active | upcoming | closed
    pub status: Option<String>,
    /// Sort order: deadline_asc | benefit_desc | relevance
    pub sort: Option<String>,
    /// Page number (1-based, default 1)
    pub page: Option<i64>,
    /// Items per page (default 20, max 100)
    pub per_page: Option<i64>,
}

// ── Detail response ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct EligibilityRule {
    pub id: Uuid,
    pub rule_json: serde_json::Value,
    pub hard_filter_json: Option<serde_json::Value>,
    pub explain_json: Option<serde_json::Value>,
    pub version: i32,
}

#[derive(Debug, Serialize)]
pub struct ProgramDocument {
    pub id: Uuid,
    pub document_name: String,
    pub description: Option<String>,
    pub is_required: Option<bool>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct ProgramDetail {
    #[serde(flatten)]
    pub program: Program,
    pub eligibility_rules: Vec<EligibilityRule>,
    pub required_documents: Vec<ProgramDocument>,
}

// ── Paginated list response ──────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ProgramListResponse {
    pub items: Vec<Program>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub has_next: bool,
}

// ── Helpers ─────────────────────────────────────────────────────────────────

fn db_error(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    tracing::error!("DB error: {e}");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": format!("DB error: {e}") })),
    )
}

// ── GET /api/v1/programs ─────────────────────────────────────────────────────

pub async fn list_programs(
    State(pool): State<PgPool>,
    Query(params): Query<ProgramQuery>,
) -> Result<Json<ProgramListResponse>, (StatusCode, Json<Value>)> {
    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    // Determine sort expression.
    // "relevance" is only meaningful when a FTS query is present; fall back to
    // deadline_asc otherwise to keep results deterministic.
    let has_fts = params.q.is_some();
    let order_clause = match params.sort.as_deref() {
        Some("benefit_desc") => {
            "COALESCE(benefit_amount_monthly, 0) + COALESCE(benefit_amount_semester, 0) DESC NULLS LAST, deadline_at ASC NULLS LAST"
        }
        Some("relevance") if has_fts => {
            "ts_rank(search_tsv, plainto_tsquery('simple', $1)) DESC, deadline_at ASC NULLS LAST"
        }
        // deadline_asc is the default
        _ => "deadline_at ASC NULLS LAST",
    };

    // We build the WHERE clause conditions manually and collect bind values so
    // that all paths use the same query shape.  SQLx's QueryBuilder works well
    // here but requires all bind values to be the same type; since we have
    // mixed types (text, arrays, ints) we fall back to raw SQL with positional
    // parameters and build the query string dynamically.

    // Positional bind slots: $1 is always reserved for the FTS query string
    // when has_fts=true (because order_clause references $1 for ts_rank).
    // When has_fts=false, no $1 exists and we start numbering from $1 for the
    // first actual filter.

    let mut conditions: Vec<String> = Vec::new();
    // param index counter; starts after the FTS slot if present
    let mut next_param: i32 = if has_fts { 2 } else { 1 };

    // Helper to allocate the next positional parameter index.
    macro_rules! alloc_param {
        () => {{
            let p = next_param;
            next_param += 1;
            p
        }};
    }

    // FTS condition — always $1 when present
    if has_fts {
        conditions.push("search_tsv @@ plainto_tsquery('simple', $1)".to_string());
    }

    // category → program_type
    let category_param = if params.category.is_some() {
        let p = alloc_param!();
        conditions.push(format!("program_type = ${p}"));
        Some(p)
    } else {
        None
    };

    // region → regions array
    let region_param = if params.region.is_some() {
        let p = alloc_param!();
        conditions.push(format!("${p} = ANY(regions)"));
        Some(p)
    } else {
        None
    };

    // status → program_status
    // Accepted values: active | upcoming | closed
    let status_param = if params.status.is_some() {
        let p = alloc_param!();
        conditions.push(format!("program_status = ${p}"));
        Some(p)
    } else {
        None
    };

    // Compose WHERE clause
    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    // ── Count query ──────────────────────────────────────────────────────────
    let count_sql = format!("SELECT COUNT(*) FROM programs {where_clause}");

    // ── Items query ──────────────────────────────────────────────────────────
    // Limit/offset use the next two positional params after all filters.
    let limit_param = next_param;
    let offset_param = next_param + 1;
    let items_sql = format!(
        "SELECT id, program_type, source_type, source_id, title, summary, \
         provider_name, official_url, program_status, application_start_at, \
         application_end_at, benefit_amount_monthly, benefit_amount_semester, \
         benefit_amount_once, region_scope, school_scope, tags, raw_payload, \
         normalized_payload, min_age, max_age, regions, deadline_at, is_active, \
         last_synced_at, created_at, updated_at, \
         company_name, company_logo_url, benefit_category, application_steps \
         FROM programs {where_clause} \
         ORDER BY {order_clause} \
         LIMIT ${limit_param} OFFSET ${offset_param}"
    );

    // ── Bind and execute ─────────────────────────────────────────────────────
    // We bind values in the same positional order for both the count and items
    // queries.  The limit/offset binds are appended only to the items query.

    macro_rules! bind_filters {
        ($query:expr) => {{
            let mut q = $query;
            if let Some(ref fts) = params.q {
                q = q.bind(fts.clone());
            }
            if let Some(_p) = category_param {
                if let Some(ref v) = params.category {
                    q = q.bind(v.clone());
                }
            }
            if let Some(_p) = region_param {
                if let Some(ref v) = params.region {
                    q = q.bind(v.clone());
                }
            }
            if let Some(_p) = status_param {
                if let Some(ref v) = params.status {
                    q = q.bind(v.clone());
                }
            }
            q
        }};
    }

    let total: i64 = {
        let q = sqlx::query_scalar::<_, i64>(&count_sql);
        let q = bind_filters!(q);
        q.fetch_one(&pool).await.map_err(db_error)?
    };

    let items: Vec<Program> = {
        let q = sqlx::query_as::<_, Program>(&items_sql);
        let q = bind_filters!(q);
        let q = q.bind(per_page).bind(offset);
        q.fetch_all(&pool).await.map_err(db_error)?
    };

    let has_next = offset + per_page < total;

    Ok(Json(ProgramListResponse {
        items,
        total,
        page,
        per_page,
        has_next,
    }))
}

// ── GET /api/v1/programs/{id} ────────────────────────────────────────────────

pub async fn get_program(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<ProgramDetail>, (StatusCode, Json<Value>)> {
    // Fetch the program row
    let program = sqlx::query_as::<_, Program>(
        "SELECT id, program_type, source_type, source_id, title, summary, \
         provider_name, official_url, program_status, application_start_at, \
         application_end_at, benefit_amount_monthly, benefit_amount_semester, \
         benefit_amount_once, region_scope, school_scope, tags, raw_payload, \
         normalized_payload, min_age, max_age, regions, deadline_at, is_active, \
         last_synced_at, created_at, updated_at, \
         company_name, company_logo_url, benefit_category, application_steps \
         FROM programs WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(db_error)?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Program not found" })),
        )
    })?;

    // Fetch eligibility rules (latest version first)
    let eligibility_rules = sqlx::query_as::<
        _,
        (
            Uuid,
            serde_json::Value,
            Option<serde_json::Value>,
            Option<serde_json::Value>,
            i32,
        ),
    >(
        "SELECT id, rule_json, hard_filter_json, explain_json, version \
         FROM eligibility_rules \
         WHERE program_id = $1 \
         ORDER BY version DESC",
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(db_error)?
    .into_iter()
    .map(
        |(eid, rule_json, hard_filter_json, explain_json, version)| EligibilityRule {
            id: eid,
            rule_json,
            hard_filter_json,
            explain_json,
            version,
        },
    )
    .collect::<Vec<_>>();

    // Fetch required documents ordered by sort_order
    let required_documents =
        sqlx::query_as::<_, (Uuid, String, Option<String>, Option<bool>, Option<i32>)>(
            "SELECT id, document_name, description, is_required, sort_order \
         FROM program_documents \
         WHERE program_id = $1 \
         ORDER BY sort_order ASC, document_name ASC",
        )
        .bind(id)
        .fetch_all(&pool)
        .await
        .map_err(db_error)?
        .into_iter()
        .map(
            |(did, document_name, description, is_required, sort_order)| ProgramDocument {
                id: did,
                document_name,
                description,
                is_required,
                sort_order,
            },
        )
        .collect::<Vec<_>>();

    Ok(Json(ProgramDetail {
        program,
        eligibility_rules,
        required_documents,
    }))
}
