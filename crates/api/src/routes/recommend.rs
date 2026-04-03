use axum::{extract::State, http::StatusCode, Json};
use chrono::Utc;
use serde_json::{json, Value};
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

use mazimi_core::models::{
    EligibilityRule, ProfileInput, Program, RecommendationItem, RecommendationResult, UserProfile,
};
use mazimi_core::rule_engine;

/// POST /api/v1/recommend/preview
/// Returns recommendations based on profile input without requiring login.
pub async fn preview(
    State(pool): State<PgPool>,
    Json(input): Json<ProfileInput>,
) -> Result<Json<RecommendationResult>, (StatusCode, Json<Value>)> {
    let now = Utc::now();
    let current_year = now.format("%Y").to_string().parse::<i32>().unwrap_or(2026);

    // Validate birth_year range
    if input.birth_year < 1920 || input.birth_year > current_year {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(
                json!({ "error": format!("birth_year must be between 1920 and {}", current_year) }),
            ),
        ));
    }

    let user_age = current_year - input.birth_year;

    // Fetch active programs whose deadline hasn't passed.
    let programs = sqlx::query_as::<_, Program>(
        r#"
        SELECT *
        FROM programs
        WHERE is_active = true
          AND (COALESCE(deadline_at, application_end_at) IS NULL OR COALESCE(deadline_at, application_end_at) > $1)
        ORDER BY deadline_at ASC NULLS LAST
        "#,
    )
    .bind(now)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("DB error: {e}") })),
        )
    })?;

    // Batch-load all eligibility_rules for the fetched programs in one query.
    // Keyed by program_id; a program may have at most one active rule row.
    let program_ids: Vec<Uuid> = programs.iter().map(|p| p.id).collect();

    let eligibility_rules: HashMap<Uuid, EligibilityRule> = if program_ids.is_empty() {
        HashMap::new()
    } else {
        sqlx::query_as::<_, EligibilityRule>(
            r#"
            SELECT DISTINCT ON (program_id) *
            FROM eligibility_rules
            WHERE program_id = ANY($1)
            ORDER BY program_id, version DESC
            "#,
        )
        .bind(&program_ids)
        .fetch_all(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("DB error loading rules: {e}") })),
            )
        })?
        .into_iter()
        .map(|r| (r.program_id, r))
        .collect()
    };

    // Build a UserProfile from ProfileInput so the rule engine can consume it.
    // A synthetic user_id is used since this is a preview (no login required).
    let profile = profile_from_input(&input);

    let mut items: Vec<(f64, RecommendationItem)> = Vec::new();

    for prog in &programs {
        // ── Region filter (hard) ──
        let region_match = match &prog.regions {
            Some(regions) if !regions.is_empty() => regions.iter().any(|r| r == &input.region_code),
            _ => true, // nationwide
        };
        if !region_match {
            continue;
        }

        // ── Age filter (hard) ──
        if let Some(min) = prog.min_age {
            if user_age < min {
                continue;
            }
        }
        if let Some(max) = prog.max_age {
            if user_age > max {
                continue;
            }
        }

        match eligibility_rules.get(&prog.id) {
            // ── Rule-engine path ──────────────────────────────────────────────
            Some(rule_row) => {
                let rule_node = match rule_engine::parse_rule_json(&rule_row.rule_json) {
                    Ok(node) => node,
                    Err(e) => {
                        tracing::warn!(
                            program_id = %prog.id,
                            error = %e,
                            "Failed to parse rule_json; falling back to inline scoring"
                        );
                        // Parse failed — fall through to inline scoring.
                        let (score, reasons, missing) = inline_score(prog, &input, user_age);
                        items.push((score as f64, build_item(prog, score, reasons, missing)));
                        continue;
                    }
                };

                let eval_result = rule_engine::evaluate(&profile, &rule_node);

                // Skip programs where every evaluated rule failed (hard mismatch).
                // Programs with all-unknown rules are still shown so the user
                // knows to provide more info.
                if !eval_result.matched_rules.is_empty()
                    || !eval_result.unknown_rules.is_empty()
                    || eval_result.match_percentage > 0.0
                {
                    let final_score = rule_engine::compute_final_score(&eval_result, prog);

                    let missing_checks: Vec<String> = eval_result
                        .unknown_rules
                        .iter()
                        .map(|d| explain_missing(&d.field))
                        .collect();

                    items.push((
                        final_score,
                        build_item(
                            prog,
                            final_score.round() as i32,
                            eval_result.explain_reasons,
                            missing_checks,
                        ),
                    ));
                }
            }

            // ── Fallback: inline scoring (no rules in DB) ─────────────────────
            None => {
                let (score, reasons, missing) = inline_score(prog, &input, user_age);
                items.push((score as f64, build_item(prog, score, reasons, missing)));
            }
        }
    }

    // Sort by final score descending.
    items.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

    let items: Vec<RecommendationItem> = items.into_iter().map(|(_, item)| item).collect();

    let estimated_monthly: i64 = items
        .iter()
        .filter_map(|i| i.benefit_amount_monthly)
        .map(|v| v as i64)
        .sum();

    let estimated_semester: i64 = items
        .iter()
        .filter_map(|i| i.benefit_amount_semester)
        .map(|v| v as i64)
        .sum();

    let total = items.len();

    Ok(Json(RecommendationResult {
        total_available: total,
        estimated_monthly,
        estimated_semester,
        items,
    }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Build a `RecommendationItem` from a program and pre-computed fields.
fn build_item(
    prog: &Program,
    score: i32,
    reasons: Vec<String>,
    missing_checks: Vec<String>,
) -> RecommendationItem {
    RecommendationItem {
        program_id: prog.id,
        title: prog.title.clone(),
        program_type: prog.program_type.clone(),
        match_score: score.min(100),
        benefit_amount_monthly: prog.benefit_amount_monthly,
        benefit_amount_semester: prog.benefit_amount_semester,
        deadline: prog.deadline_at.map(|d| d.format("%Y-%m-%d").to_string()),
        reasons,
        missing_checks,
        official_url: prog.official_url.clone(),
    }
}

/// Convert a `ProfileInput` (from the API request) into a `UserProfile`
/// (what the rule engine expects). Optional boolean fields default to `false`.
fn profile_from_input(input: &ProfileInput) -> UserProfile {
    UserProfile {
        user_id: Uuid::nil(), // preview mode — no real user
        birth_year: Some(input.birth_year),
        region_code: Some(input.region_code.clone()),
        city_code: input.city_code.clone(),
        school_name: input.school_name.clone(),
        school_year: input.school_year,
        enrollment_status: input.enrollment_status.clone(),
        employment_status: input.employment_status.clone(),
        major_group: input.major_group.clone(),
        income_bracket: input.income_bracket,
        kosaf_support_bracket: input.kosaf_support_bracket,
        housing_type: input.housing_type.clone(),
        household_size: input.household_size,
        has_disability: input.has_disability.unwrap_or(false),
        is_multicultural_family: input.is_multicultural_family.unwrap_or(false),
        is_low_income_household: input.is_low_income_household.unwrap_or(false),
        veteran_family: input.veteran_family.unwrap_or(false),
        preferred_categories: input.preferred_categories.clone().unwrap_or_default(),
        school_type: input.school_type.clone(),
        age_band: input.age_band.clone(),
        profile_version: 1,
        updated_at: Utc::now(),
        nickname: None,
        profile_image_url: None,
    }
}

/// Original inline scoring logic kept as a fallback for programs that have no
/// `eligibility_rules` row in the DB.
///
/// Returns `(score, reasons, missing_checks)`.
/// Region and age hard-filters must already have passed before this is called.
fn inline_score(
    prog: &Program,
    input: &ProfileInput,
    _user_age: i32,
) -> (i32, Vec<String>, Vec<String>) {
    let now = Utc::now();
    let mut score: i32 = 0;
    let mut reasons: Vec<String> = Vec::new();
    let mut missing: Vec<String> = Vec::new();

    // Region match bonus.
    if let Some(regions) = &prog.regions {
        if !regions.is_empty() {
            score += 30;
            reasons.push(format!(
                "{} 거주 청년 대상이에요.",
                mazimi_core::region_label(&input.region_code)
            ));
        }
    }

    // Age passes (already filtered above).
    score += 30;
    reasons.push("현재 연령 조건에 맞아요.".to_string());

    // Deadline proximity.
    if let Some(deadline) = prog.deadline_at {
        let days_left = (deadline - now).num_days();
        if days_left <= 30 {
            score += 20;
            reasons.push(format!("마감이 {}일 남았어요! 서두르세요.", days_left));
        } else if days_left <= 60 {
            score += 15;
        } else {
            score += 10;
        }
    } else {
        score += 10; // always open
    }

    // Benefit amount.
    let monthly = prog.benefit_amount_monthly.unwrap_or(0);
    let semester = prog.benefit_amount_semester.unwrap_or(0);
    let once = prog.benefit_amount_once.unwrap_or(0);
    let max_benefit = monthly.max(semester / 6).max(once / 12);
    if max_benefit >= 300_000 {
        score += 20;
    } else if max_benefit >= 100_000 {
        score += 15;
    } else {
        score += 10;
    }

    // Missing checks.
    if input.income_bracket.is_none() && prog.program_type == "scholarship" {
        missing.push("소득 기준 확인 필요".to_string());
    }
    if input.enrollment_status.is_none() && prog.program_type == "scholarship" {
        missing.push("재학 상태 확인 필요".to_string());
    }

    (score.min(100), reasons, missing)
}

/// Human-readable Korean label for a missing profile field (used in the
/// rule-engine path where `unknown_rules` contains field names).
fn explain_missing(field: &str) -> String {
    match field {
        "income_bracket" | "kosaf_support_bracket" => "소득 기준 확인 필요".to_string(),
        "enrollment_status" => "재학 상태 확인 필요".to_string(),
        "employment_status" => "취업 상태 확인 필요".to_string(),
        "region_code" | "region" => "거주 지역 확인 필요".to_string(),
        "birth_year" => "생년 정보 확인 필요".to_string(),
        "school_type" => "학교 유형 확인 필요".to_string(),
        "major_group" => "전공 계열 확인 필요".to_string(),
        "housing_type" => "주거 형태 확인 필요".to_string(),
        "has_disability" => "장애 여부 확인 필요".to_string(),
        "is_multicultural_family" => "다문화가정 여부 확인 필요".to_string(),
        "is_low_income_household" => "저소득 가구 여부 확인 필요".to_string(),
        "veteran_family" => "보훈 가족 여부 확인 필요".to_string(),
        other => format!("{} 확인 필요", other),
    }
}
