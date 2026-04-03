/// Rule engine for evaluating eligibility conditions against a UserProfile.
///
/// ## DSL format (stored as JSON in `eligibility_rules.rule_json`)
///
/// ```json
/// {
///   "all": [
///     { "field": "region_code", "op": "in", "value": ["busan", "daegu"], "weight": 1.0 },
///     { "field": "income_bracket", "op": "lte", "value": 5, "weight": 2.0 }
///   ]
/// }
/// ```
///
/// Supported top-level nodes: `all`, `any`, or a single condition object.
/// Conditions may omit `weight`; default is 1.0.
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::models::{Program, UserProfile};

// ── DSL types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuleOp {
    Eq,
    Ne,
    In,
    NotIn,
    Between,
    Gte,
    Lte,
    Gt,
    Lt,
    Contains,
    IsTrue,
    IsFalse,
    IsNull,
    IsNotNull,
}

impl RuleOp {
    pub fn as_str(&self) -> &'static str {
        match self {
            RuleOp::Eq => "eq",
            RuleOp::Ne => "ne",
            RuleOp::In => "in",
            RuleOp::NotIn => "not_in",
            RuleOp::Between => "between",
            RuleOp::Gte => "gte",
            RuleOp::Lte => "lte",
            RuleOp::Gt => "gt",
            RuleOp::Lt => "lt",
            RuleOp::Contains => "contains",
            RuleOp::IsTrue => "is_true",
            RuleOp::IsFalse => "is_false",
            RuleOp::IsNull => "is_null",
            RuleOp::IsNotNull => "is_not_null",
        }
    }
}

/// A node in the eligibility rule tree.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum RuleNode {
    /// All child rules must pass (logical AND).
    All { all: Vec<RuleNode> },
    /// At least one child rule must pass (logical OR).
    Any { any: Vec<RuleNode> },
    /// A leaf condition evaluated against a single profile field.
    Condition {
        field: String,
        op: RuleOp,
        #[serde(default)]
        value: Value,
        #[serde(default = "default_weight")]
        weight: f64,
    },
}

fn default_weight() -> f64 {
    1.0
}

// ── Evaluation result types ────────────────────────────────────────────────

/// Per-condition evaluation detail, recorded for the explain trace.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvalDetail {
    pub field: String,
    pub op: String,
    pub expected: String,
    pub actual: Option<String>,
    pub weight: f64,
    /// `Some(true)` = matched, `Some(false)` = failed, `None` = unknown (field absent)
    pub passed: Option<bool>,
}

/// Full result of evaluating a rule tree against a user profile.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleEvalResult {
    pub matched_rules: Vec<EvalDetail>,
    pub failed_rules: Vec<EvalDetail>,
    /// Conditions where the profile field was `None` / absent — cannot determine pass/fail.
    pub unknown_rules: Vec<EvalDetail>,
    /// `sum(matched_weights) / sum(all_weights) * 100`, capped at 100.0
    pub match_percentage: f64,
    /// Human-readable Korean explanation strings for the recommendation card.
    pub explain_reasons: Vec<String>,
}

// ── Field extraction ───────────────────────────────────────────────────────

/// Extracts a profile field value as a `serde_json::Value` for comparison.
/// Returns `None` when the field is absent / not set on the profile.
fn extract_field(profile: &UserProfile, field: &str) -> Option<Value> {
    match field {
        "birth_year" => profile.birth_year.map(Value::from),
        "region_code" | "region" => profile
            .region_code
            .as_ref()
            .map(|v| Value::from(v.as_str())),
        "city_code" => profile.city_code.as_ref().map(|v| Value::from(v.as_str())),
        "school_name" => profile
            .school_name
            .as_ref()
            .map(|v| Value::from(v.as_str())),
        "school_year" => profile.school_year.map(Value::from),
        "school_type" => profile
            .school_type
            .as_ref()
            .map(|v| Value::from(v.as_str())),
        "enrollment_status" => profile
            .enrollment_status
            .as_ref()
            .map(|v| Value::from(v.as_str())),
        "employment_status" => profile
            .employment_status
            .as_ref()
            .map(|v| Value::from(v.as_str())),
        "major_group" => profile
            .major_group
            .as_ref()
            .map(|v| Value::from(v.as_str())),
        "income_bracket" => profile.income_bracket.map(Value::from),
        "kosaf_support_bracket" => profile.kosaf_support_bracket.map(Value::from),
        "housing_type" => profile
            .housing_type
            .as_ref()
            .map(|v| Value::from(v.as_str())),
        "household_size" => profile.household_size.map(Value::from),
        "age_band" => profile.age_band.as_ref().map(|v| Value::from(v.as_str())),
        "has_disability" => Some(Value::Bool(profile.has_disability)),
        "is_multicultural_family" => Some(Value::Bool(profile.is_multicultural_family)),
        "is_low_income_household" => Some(Value::Bool(profile.is_low_income_household)),
        "veteran_family" => Some(Value::Bool(profile.veteran_family)),
        _ => None,
    }
}

// ── Operator evaluation ────────────────────────────────────────────────────

/// Returns `true` if `actual` satisfies `op` against `expected`.
fn eval_op(actual: &Value, op: &RuleOp, expected: &Value) -> bool {
    match op {
        RuleOp::Eq => actual == expected,
        RuleOp::Ne => actual != expected,
        RuleOp::In => {
            if let Some(arr) = expected.as_array() {
                arr.contains(actual)
            } else {
                false
            }
        }
        RuleOp::NotIn => {
            if let Some(arr) = expected.as_array() {
                !arr.contains(actual)
            } else {
                true
            }
        }
        RuleOp::Between => {
            if let Some(arr) = expected.as_array() {
                if arr.len() == 2 {
                    return cmp_values(actual, &arr[0]) >= 0 && cmp_values(actual, &arr[1]) <= 0;
                }
            }
            false
        }
        RuleOp::Gte => cmp_values(actual, expected) >= 0,
        RuleOp::Lte => cmp_values(actual, expected) <= 0,
        RuleOp::Gt => cmp_values(actual, expected) > 0,
        RuleOp::Lt => cmp_values(actual, expected) < 0,
        RuleOp::Contains => match (actual, expected) {
            (Value::String(s), Value::String(sub)) => s.contains(sub.as_str()),
            (Value::Array(arr), v) => arr.contains(v),
            _ => false,
        },
        RuleOp::IsTrue => actual == &Value::Bool(true),
        RuleOp::IsFalse => actual == &Value::Bool(false),
        RuleOp::IsNull => actual.is_null(),
        RuleOp::IsNotNull => !actual.is_null(),
    }
}

/// Numeric or string comparison, returning -1/0/1.
fn cmp_values(a: &Value, b: &Value) -> i32 {
    match (a.as_f64(), b.as_f64()) {
        (Some(av), Some(bv)) => {
            if av < bv {
                -1
            } else if av > bv {
                1
            } else {
                0
            }
        }
        _ => match (a.as_str(), b.as_str()) {
            (Some(as_), Some(bs)) => as_.cmp(bs) as i32,
            _ => i32::MAX, // incomparable types → comparisons should fail
        },
    }
}

// ── Korean explain template ───────────────────────────────────────────────

fn explain_unknown(field: &str) -> String {
    match field {
        "income_bracket" | "kosaf_support_bracket" => {
            "소득 구간 정보가 필요합니다 (입력 시 더 정확한 추천이 가능해요)".to_string()
        }
        "enrollment_status" => "재학 여부를 입력하면 더 정확한 추천이 가능해요".to_string(),
        "employment_status" => "취업 상태를 입력하면 더 정확한 추천이 가능해요".to_string(),
        "region_code" | "region" => "거주 지역 정보가 필요합니다".to_string(),
        "birth_year" => "생년 정보가 필요합니다".to_string(),
        "school_type" => "학교 유형을 입력하면 더 정확한 추천이 가능해요".to_string(),
        "major_group" => "전공 계열을 입력하면 더 정확한 추천이 가능해요".to_string(),
        "housing_type" => "주거 형태를 입력하면 더 정확한 추천이 가능해요".to_string(),
        _ => format!("{} 정보가 필요합니다", field),
    }
}

// ── Core evaluation logic ─────────────────────────────────────────────────

/// Internal accumulator passed through the recursive walk.
struct EvalAccumulator {
    matched: Vec<EvalDetail>,
    failed: Vec<EvalDetail>,
    unknown: Vec<EvalDetail>,
}

impl EvalAccumulator {
    fn new() -> Self {
        Self {
            matched: Vec::new(),
            failed: Vec::new(),
            unknown: Vec::new(),
        }
    }
}

/// Recursively walk `node`, recording every leaf condition into `acc`.
/// Returns `true` if the subtree passes (used by `Any`/`All` short-circuiting
/// for score purposes; all leaves are still recorded regardless).
fn walk(profile: &UserProfile, node: &RuleNode, acc: &mut EvalAccumulator) -> bool {
    match node {
        RuleNode::All { all } => {
            let results: Vec<bool> = all.iter().map(|child| walk(profile, child, acc)).collect();
            results.iter().all(|&r| r)
        }
        RuleNode::Any { any } => {
            let results: Vec<bool> = any.iter().map(|child| walk(profile, child, acc)).collect();
            results.iter().any(|&r| r)
        }
        RuleNode::Condition {
            field,
            op,
            value: expected,
            weight,
        } => {
            let actual_opt = extract_field(profile, field);
            let detail = EvalDetail {
                field: field.clone(),
                op: op.as_str().to_string(),
                expected: expected.to_string(),
                actual: actual_opt.as_ref().map(|v| v.to_string()),
                weight: *weight,
                passed: None,
            };

            match actual_opt {
                None => {
                    // Field not present on profile — unknown
                    let mut d = detail;
                    d.passed = None;
                    acc.unknown.push(d);
                    // Treat unknown as non-matching for All, but note it for score
                    false
                }
                Some(actual) => {
                    let passed = eval_op(&actual, op, expected);
                    let mut d = detail;
                    d.passed = Some(passed);
                    if passed {
                        acc.matched.push(d);
                    } else {
                        acc.failed.push(d);
                    }
                    passed
                }
            }
        }
    }
}

// ── Public API ────────────────────────────────────────────────────────────

/// Evaluate a rule tree against a user profile.
///
/// Every leaf condition is categorised into matched / failed / unknown.
/// `match_percentage` = sum(matched weights) / sum(all weights) × 100.
pub fn evaluate(profile: &UserProfile, rules: &RuleNode) -> RuleEvalResult {
    let mut acc = EvalAccumulator::new();
    walk(profile, rules, &mut acc);

    let total_weight: f64 = acc
        .matched
        .iter()
        .chain(acc.failed.iter())
        .chain(acc.unknown.iter())
        .map(|d| d.weight)
        .sum();

    let matched_weight: f64 = acc.matched.iter().map(|d| d.weight).sum();

    let match_percentage = if total_weight > 0.0 {
        (matched_weight / total_weight * 100.0).min(100.0)
    } else {
        0.0
    };

    // Build explain strings
    let mut explain_reasons: Vec<String> = Vec::new();

    for detail in &acc.matched {
        explain_reasons.push({
            match detail.field.as_str() {
                "region_code" | "region" => format!(
                    "{} 거주 조건 충족",
                    detail
                        .actual
                        .as_deref()
                        .map(crate::region_label)
                        .unwrap_or("기타")
                ),
                "income_bracket" | "kosaf_support_bracket" => format!(
                    "소득 구간 {} 조건 충족",
                    detail.actual.as_deref().unwrap_or("-")
                ),
                "enrollment_status" => format!(
                    "{} 재학 상태 조건 충족",
                    detail.actual.as_deref().unwrap_or("-")
                ),
                "employment_status" => format!(
                    "{} 고용 상태 조건 충족",
                    detail.actual.as_deref().unwrap_or("-")
                ),
                "has_disability" => "장애인 해당 조건 충족".to_string(),
                "is_multicultural_family" => "다문화가정 조건 충족".to_string(),
                "is_low_income_household" => "저소득 가구 조건 충족".to_string(),
                "veteran_family" => "보훈 가족 조건 충족".to_string(),
                "birth_year" => format!(
                    "연령 조건 충족 (출생연도 {})",
                    detail.actual.as_deref().unwrap_or("-")
                ),
                "school_type" => format!(
                    "학교 유형({}) 조건 충족",
                    detail.actual.as_deref().unwrap_or("-")
                ),
                "major_group" => format!(
                    "전공 계열({}) 조건 충족",
                    detail.actual.as_deref().unwrap_or("-")
                ),
                other => format!("{} 조건 충족", other),
            }
        });
    }

    for detail in &acc.unknown {
        explain_reasons.push(explain_unknown(&detail.field));
    }

    RuleEvalResult {
        matched_rules: acc.matched,
        failed_rules: acc.failed,
        unknown_rules: acc.unknown,
        match_percentage,
        explain_reasons,
    }
}

/// Parse a `serde_json::Value` (as stored in `eligibility_rules.rule_json`) into a `RuleNode`.
pub fn parse_rule_json(value: &Value) -> Result<RuleNode, serde_json::Error> {
    serde_json::from_value(value.clone())
}

// ── Scoring formula ───────────────────────────────────────────────────────

/// Compute the final recommendation score from the rule evaluation result and the program.
///
/// Formula (spec §9-2):
/// ```text
/// score =
///     적합도     × 0.40  (rule match_percentage → 0–40 pts)
///   + 혜택 크기  × 0.20  (benefit score → 0–20 pts)
///   + 마감 임박  × 0.15  (deadline urgency → 0–15 pts)
///   + 지역 우선순위 × 0.10 (region priority → 0–10 pts)
///   + 유저 선호  × 0.10  (placeholder: always 5 pts until preference engine is built)
///   - 서류 복잡도 × 0.05 (placeholder: always 0 until document scoring is built)
/// ```
///
/// Returns a score in [0.0, 100.0].
pub fn compute_final_score(rule_result: &RuleEvalResult, program: &Program) -> f64 {
    // ① 적합도 (0–40)
    let eligibility_score = rule_result.match_percentage * 0.40;

    // ② 혜택 크기 (0–20)
    //    Normalise to a monthly equivalent for comparison.
    let monthly = program.benefit_amount_monthly.unwrap_or(0) as f64;
    let semester = program.benefit_amount_semester.unwrap_or(0) as f64 / 6.0;
    let once = program.benefit_amount_once.unwrap_or(0) as f64 / 12.0;
    let max_monthly_equiv = monthly.max(semester).max(once);
    let benefit_score: f64 = if max_monthly_equiv >= 500_000.0 {
        20.0
    } else if max_monthly_equiv >= 300_000.0 {
        17.0
    } else if max_monthly_equiv >= 100_000.0 {
        13.0
    } else if max_monthly_equiv > 0.0 {
        8.0
    } else {
        0.0
    };

    // ③ 마감 임박 (0–15)
    let deadline_score: f64 = match program.deadline_at {
        None => 10.0, // always open — stable, moderately urgent
        Some(deadline) => {
            let days_left = (deadline - chrono::Utc::now()).num_days();
            if days_left < 0 {
                0.0 // expired
            } else if days_left <= 7 {
                15.0 // very urgent
            } else if days_left <= 30 {
                12.0
            } else if days_left <= 60 {
                9.0
            } else {
                6.0
            }
        }
    };

    // ④ 지역 우선순위 (0–10)
    //    If the program is region-specific it is more targeted → higher priority.
    let region_score: f64 = match &program.regions {
        Some(regions) if !regions.is_empty() => 10.0, // region-targeted
        _ => 5.0,                                     // nationwide
    };

    // ⑤ 유저 선호 카테고리 (0–10) — placeholder until preference engine is built
    let preference_score: f64 = 5.0;

    // ⑥ 서류 복잡도 (-5–0) — placeholder until document scoring is built
    //    Currently 0 (no penalty). Will be negative once doc count is evaluated.
    let document_penalty: f64 = 0.0;

    let total =
        eligibility_score + benefit_score + deadline_score + region_score + preference_score
            - document_penalty;

    total.clamp(0.0, 100.0)
}

// ── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use serde_json::json;
    use uuid::Uuid;

    fn make_profile(region: &str, income: Option<i32>, enrollment: Option<&str>) -> UserProfile {
        UserProfile {
            user_id: Uuid::new_v4(),
            birth_year: Some(2000),
            region_code: Some(region.to_string()),
            city_code: None,
            school_name: None,
            school_year: None,
            enrollment_status: enrollment.map(|s| s.to_string()),
            employment_status: None,
            major_group: None,
            income_bracket: income,
            kosaf_support_bracket: None,
            housing_type: None,
            household_size: None,
            has_disability: false,
            is_multicultural_family: false,
            is_low_income_household: false,
            veteran_family: false,
            preferred_categories: vec![],
            school_type: None,
            age_band: None,
            profile_version: 1,
            updated_at: Utc::now(),
            nickname: None,
            profile_image_url: None,
        }
    }

    fn make_program() -> Program {
        Program {
            id: Uuid::new_v4(),
            program_type: "scholarship".to_string(),
            source_type: "manual".to_string(),
            source_id: None,
            title: "테스트 장학금".to_string(),
            summary: None,
            provider_name: None,
            official_url: None,
            program_status: "open".to_string(),
            application_start_at: None,
            application_end_at: None,
            benefit_amount_monthly: Some(300_000),
            benefit_amount_semester: None,
            benefit_amount_once: None,
            region_scope: None,
            school_scope: None,
            tags: None,
            raw_payload: None,
            normalized_payload: None,
            min_age: None,
            max_age: None,
            regions: Some(vec!["busan".to_string()]),
            deadline_at: None,
            is_active: true,
            last_synced_at: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            company_name: None,
            company_logo_url: None,
            benefit_category: None,
            application_steps: None,
        }
    }

    #[test]
    fn all_conditions_matched() {
        let profile = make_profile("busan", Some(3), Some("enrolled"));
        let rule: RuleNode = serde_json::from_value(json!({
            "all": [
                { "field": "region_code", "op": "in", "value": ["busan", "daegu"], "weight": 2.0 },
                { "field": "income_bracket", "op": "lte", "value": 5, "weight": 1.0 },
                { "field": "enrollment_status", "op": "in", "value": ["enrolled", "on_leave"], "weight": 1.0 }
            ]
        }))
        .unwrap();

        let result = evaluate(&profile, &rule);
        assert_eq!(result.matched_rules.len(), 3);
        assert_eq!(result.failed_rules.len(), 0);
        assert_eq!(result.unknown_rules.len(), 0);
        assert!((result.match_percentage - 100.0).abs() < 0.01);
    }

    #[test]
    fn unknown_field_recorded() {
        let profile = make_profile("busan", None, None);
        let rule: RuleNode = serde_json::from_value(json!({
            "all": [
                { "field": "income_bracket", "op": "lte", "value": 5, "weight": 1.0 }
            ]
        }))
        .unwrap();

        let result = evaluate(&profile, &rule);
        assert_eq!(result.unknown_rules.len(), 1);
        assert_eq!(result.matched_rules.len(), 0);
        assert!((result.match_percentage - 0.0).abs() < 0.01);
        assert!(result.explain_reasons[0].contains("소득 구간"));
    }

    #[test]
    fn any_passes_if_one_matches() {
        let profile = make_profile("busan", Some(3), None);
        let rule: RuleNode = serde_json::from_value(json!({
            "any": [
                { "field": "region_code", "op": "eq", "value": "busan", "weight": 1.0 },
                { "field": "region_code", "op": "eq", "value": "daegu", "weight": 1.0 }
            ]
        }))
        .unwrap();

        let result = evaluate(&profile, &rule);
        assert_eq!(result.matched_rules.len(), 1);
        assert_eq!(result.failed_rules.len(), 1);
        assert!((result.match_percentage - 50.0).abs() < 0.01);
    }

    #[test]
    fn between_op_works() {
        let profile = make_profile("seoul", Some(3), None);
        let rule: RuleNode = serde_json::from_value(json!({
            "all": [
                { "field": "income_bracket", "op": "between", "value": [1, 5], "weight": 1.0 }
            ]
        }))
        .unwrap();

        let result = evaluate(&profile, &rule);
        assert_eq!(result.matched_rules.len(), 1);
    }

    #[test]
    fn compute_final_score_range() {
        let profile = make_profile("busan", Some(2), Some("enrolled"));
        let rule: RuleNode = serde_json::from_value(json!({
            "all": [
                { "field": "region_code", "op": "in", "value": ["busan"], "weight": 1.0 },
                { "field": "enrollment_status", "op": "eq", "value": "enrolled", "weight": 1.0 }
            ]
        }))
        .unwrap();
        let eval = evaluate(&profile, &rule);
        let program = make_program();
        let score = compute_final_score(&eval, &program);
        assert!((0.0..=100.0).contains(&score), "score={score}");
    }

    #[test]
    fn parse_rule_json_roundtrip() {
        let raw = json!({
            "all": [
                { "field": "region_code", "op": "in", "value": ["busan"], "weight": 1.0 }
            ]
        });
        let node = parse_rule_json(&raw).expect("parse");
        let re_serialised = serde_json::to_value(&node).expect("serialise");
        assert!(re_serialised.get("all").is_some());
    }
}
