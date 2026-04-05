use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

// ── Request / Response types ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct StackCheckRequest {
    /// List of program IDs to check for stacking compatibility.
    /// Must contain between 2 and 20 IDs.
    pub program_ids: Vec<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct PairResult {
    pub program_a_id: Uuid,
    pub program_a_title: String,
    pub program_b_id: Uuid,
    pub program_b_title: String,
    /// "stackable" | "conflict"
    pub status: String,
    pub reason: String,
}

#[derive(Debug, Serialize)]
pub struct ProgramStackSummary {
    pub program_id: Uuid,
    pub title: String,
    pub program_type: String,
    pub provider_name: Option<String>,
    /// "stackable" | "conflict" — conflict if involved in any conflicting pair
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct StackCheckResponse {
    /// Per-program summary
    pub programs: Vec<ProgramStackSummary>,
    /// All pairs and their compatibility
    pub pairs: Vec<PairResult>,
    /// Convenience: true if all selected programs can be stacked simultaneously
    pub all_stackable: bool,
}

// ── Minimal DB row for stack analysis ────────────────────────────────────────

struct ProgramRow {
    id: Uuid,
    title: String,
    program_type: String,
    provider_name: Option<String>,
    source_id: Option<String>,
}

// ── Handler ──────────────────────────────────────────────────────────────────

/// POST /api/v1/stack-check
///
/// Accepts a list of program IDs and returns which ones can be received
/// simultaneously (stacked) and which ones conflict.
///
/// Stacking rules (applied in priority order):
///   1. KOSAF scholarships (source_id LIKE 'kosaf%') are exclusive with each other.
///   2. Same provider + same program_type → likely conflict.
///   3. Everything else → stackable (different providers or different benefit types
///      such as scholarship + housing support generally combine fine).
///
/// No authentication required — this is a public planning tool.
pub async fn stack_check(
    State(pool): State<PgPool>,
    Json(body): Json<StackCheckRequest>,
) -> Result<Json<StackCheckResponse>, (StatusCode, Json<Value>)> {
    // ── Input validation ─────────────────────────────────────────────────────
    if body.program_ids.len() < 2 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "program_ids must contain at least 2 IDs" })),
        ));
    }
    if body.program_ids.len() > 20 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "program_ids must not exceed 20 IDs" })),
        ));
    }

    // Deduplicate while preserving order
    let mut seen = std::collections::HashSet::new();
    let unique_ids: Vec<Uuid> = body
        .program_ids
        .into_iter()
        .filter(|id| seen.insert(*id))
        .collect();

    if unique_ids.len() < 2 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "program_ids must contain at least 2 distinct IDs" })),
        ));
    }

    // ── Fetch only the fields we need (parameterized query) ──────────────────
    let rows = sqlx::query_as::<
        _,
        (Uuid, String, String, Option<String>, Option<String>),
    >(
        "SELECT id, title, program_type, provider_name, source_id \
         FROM programs \
         WHERE id = ANY($1)",
    )
    .bind(&unique_ids)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "DB error in stack_check");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to fetch programs" })),
        )
    })?;

    // Map back to a typed struct and preserve request order
    let programs: Vec<ProgramRow> = {
        let mut map = std::collections::HashMap::new();
        for (id, title, program_type, provider_name, source_id) in rows {
            map.insert(
                id,
                ProgramRow {
                    id,
                    title,
                    program_type,
                    provider_name,
                    source_id,
                },
            );
        }
        // Only include IDs that exist in the DB, in the original request order
        unique_ids
            .iter()
            .filter_map(|id| map.remove(id))
            .collect()
    };

    if programs.len() < 2 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(
                json!({ "error": "At least 2 of the provided program IDs must exist in the database" }),
            ),
        ));
    }

    // ── Pair-wise stacking analysis ──────────────────────────────────────────
    let mut pairs: Vec<PairResult> = Vec::new();
    let mut conflict_ids: std::collections::HashSet<Uuid> = std::collections::HashSet::new();

    for i in 0..programs.len() {
        for j in (i + 1)..programs.len() {
            let a = &programs[i];
            let b = &programs[j];

            let (status, reason) = classify_pair(a, b);

            if status == "conflict" {
                conflict_ids.insert(a.id);
                conflict_ids.insert(b.id);
            }

            pairs.push(PairResult {
                program_a_id: a.id,
                program_a_title: a.title.clone(),
                program_b_id: b.id,
                program_b_title: b.title.clone(),
                status,
                reason,
            });
        }
    }

    // ── Build per-program summaries ──────────────────────────────────────────
    let summaries: Vec<ProgramStackSummary> = programs
        .iter()
        .map(|p| ProgramStackSummary {
            program_id: p.id,
            title: p.title.clone(),
            program_type: p.program_type.clone(),
            provider_name: p.provider_name.clone(),
            status: if conflict_ids.contains(&p.id) {
                "conflict".to_string()
            } else {
                "stackable".to_string()
            },
        })
        .collect();

    let all_stackable = conflict_ids.is_empty();

    Ok(Json(StackCheckResponse {
        programs: summaries,
        pairs,
        all_stackable,
    }))
}

// ── Stacking rule engine ─────────────────────────────────────────────────────

/// Returns ("stackable" | "conflict", reason_string) for a program pair.
fn classify_pair(a: &ProgramRow, b: &ProgramRow) -> (String, String) {
    // Rule 1: KOSAF scholarships are exclusive with each other.
    // source_id starts with "kosaf" → national scholarship fund.
    let a_is_kosaf = a
        .source_id
        .as_deref()
        .map(|s| s.starts_with("kosaf"))
        .unwrap_or(false);
    let b_is_kosaf = b
        .source_id
        .as_deref()
        .map(|s| s.starts_with("kosaf"))
        .unwrap_or(false);

    if a_is_kosaf && b_is_kosaf {
        return (
            "conflict".to_string(),
            "한국장학재단 지원은 동일 유형 중복 수혜가 불가합니다.".to_string(),
        );
    }

    // Rule 2: Same provider + same program_type → likely conflict.
    let same_provider = match (&a.provider_name, &b.provider_name) {
        (Some(pa), Some(pb)) => pa.trim() == pb.trim(),
        _ => false,
    };
    let same_type = a.program_type == b.program_type;

    if same_provider && same_type {
        let provider = a.provider_name.as_deref().unwrap_or("동일 기관");
        return (
            "conflict".to_string(),
            format!(
                "동일 기관({provider})의 같은 유형 혜택은 중복 수령이 제한될 수 있습니다."
            ),
        );
    }

    // Rule 3: Different types (e.g. scholarship + living support) → stackable.
    // Also: same provider but different types is usually fine (e.g. scholarship + housing).
    let reason = if !same_type {
        format!(
            "혜택 유형이 다르므로({} + {}) 중복 수령이 가능합니다.",
            korean_type_label(&a.program_type),
            korean_type_label(&b.program_type)
        )
    } else {
        "서로 다른 기관의 혜택으로 동시에 수령할 수 있습니다.".to_string()
    };

    ("stackable".to_string(), reason)
}

fn korean_type_label(program_type: &str) -> &str {
    match program_type {
        "scholarship" => "장학금",
        "youth_policy" => "청년정책",
        "welfare" => "복지/생활",
        "financial" | "savings" | "loan" => "금융상품",
        "corporate" | "company" => "기업혜택",
        _ => "기타",
    }
}
