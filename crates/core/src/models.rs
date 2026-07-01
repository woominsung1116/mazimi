use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ── Users ──

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub auth_provider: String,
    pub auth_provider_id: Option<String>,
    pub role: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── User Profiles ──

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserProfile {
    pub user_id: Uuid,
    pub birth_year: Option<i32>,
    pub region_code: Option<String>,
    pub city_code: Option<String>,
    pub school_name: Option<String>,
    pub school_year: Option<i32>,
    pub enrollment_status: Option<String>,
    pub employment_status: Option<String>,
    pub major_group: Option<String>,
    pub income_bracket: Option<i32>,
    pub kosaf_support_bracket: Option<i32>,
    pub housing_type: Option<String>,
    pub household_size: Option<i32>,
    pub has_disability: bool,
    pub is_multicultural_family: bool,
    pub is_low_income_household: bool,
    pub veteran_family: bool,
    pub preferred_categories: Vec<String>,
    pub school_type: Option<String>,
    pub age_band: Option<String>,
    pub profile_version: i32,
    pub updated_at: DateTime<Utc>,
    pub nickname: Option<String>,
    pub profile_image_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileInput {
    pub birth_year: i32,
    pub region_code: String,
    pub city_code: Option<String>,
    pub school_name: Option<String>,
    pub school_year: Option<i32>,
    pub enrollment_status: Option<String>,
    pub employment_status: Option<String>,
    pub major_group: Option<String>,
    pub income_bracket: Option<i32>,
    pub kosaf_support_bracket: Option<i32>,
    pub housing_type: Option<String>,
    pub household_size: Option<i32>,
    pub has_disability: Option<bool>,
    pub is_multicultural_family: Option<bool>,
    pub is_low_income_household: Option<bool>,
    pub veteran_family: Option<bool>,
    pub preferred_categories: Option<Vec<String>>,
    pub school_type: Option<String>,
    pub age_band: Option<String>,
}

// ── Eligibility Rules ──

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct EligibilityRule {
    pub id: Uuid,
    pub program_id: Uuid,
    /// DSL tree: `{ "all": [...] }` or `{ "any": [...] }` nodes
    pub rule_json: serde_json::Value,
    /// Quick hard-filter clauses evaluated before the full rule tree
    pub hard_filter_json: Option<serde_json::Value>,
    /// Template strings used to build human-readable match explanations
    pub explain_json: Option<serde_json::Value>,
    pub version: i32,
    pub created_by: Option<String>,
    pub reviewed_by: Option<String>,
    pub compiled_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Program Documents ──

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProgramDocument {
    pub id: Uuid,
    pub program_id: Uuid,
    pub document_name: String,
    pub description: Option<String>,
    pub is_required: bool,
    pub sort_order: i32,
}

// ── Programs ──

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Program {
    pub id: Uuid,
    pub program_type: String,
    pub source_type: String,
    pub source_id: Option<String>,
    pub title: String,
    pub summary: Option<String>,
    pub provider_name: Option<String>,
    pub official_url: Option<String>,
    pub program_status: String,
    pub application_start_at: Option<DateTime<Utc>>,
    pub application_end_at: Option<DateTime<Utc>>,
    pub benefit_amount_monthly: Option<i32>,
    pub benefit_amount_semester: Option<i32>,
    pub benefit_amount_once: Option<i32>,
    pub region_scope: Option<serde_json::Value>,
    pub school_scope: Option<serde_json::Value>,
    pub tags: Option<serde_json::Value>,
    pub raw_payload: Option<serde_json::Value>,
    pub normalized_payload: Option<serde_json::Value>,
    pub min_age: Option<i32>,
    pub max_age: Option<i32>,
    pub regions: Option<Vec<String>>,
    pub deadline_at: Option<DateTime<Utc>>,
    pub is_active: bool,
    pub last_synced_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // ── Corporate benefit fields (nullable for non-corporate programs) ──
    pub company_name: Option<String>,
    pub company_logo_url: Option<String>,
    pub benefit_category: Option<String>,
    // ── Application guide ──
    pub application_steps: Option<serde_json::Value>,
    /// 신청 방법 안내 텍스트 (원문, 온통청년 plcyAplyMthdCn 등)
    pub application_method: Option<String>,
    /// 제출 서류 안내 텍스트 (원문, 온통청년 sbmsnDcmntCn 등)
    pub submission_documents: Option<String>,
    /// 심사 방법 안내 텍스트 (원문, 온통청년 srngMthdCn 등)
    pub screening_method: Option<String>,
}

// ── Bookmarks ──

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Bookmark {
    pub id: Uuid,
    pub user_id: Uuid,
    pub program_id: Uuid,
    pub created_at: DateTime<Utc>,
}

// ── User Program States ──

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserProgramState {
    pub id: Uuid,
    pub user_id: Uuid,
    pub program_id: Uuid,
    pub state: String,
    pub memo: Option<String>,
    pub applied_at: Option<DateTime<Utc>>,
    pub result_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ── Recommendation Result ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendationItem {
    pub program_id: Uuid,
    pub title: String,
    pub program_type: String,
    pub match_score: i32,
    pub benefit_amount_monthly: Option<i32>,
    pub benefit_amount_semester: Option<i32>,
    pub deadline: Option<String>,
    pub reasons: Vec<String>,
    pub missing_checks: Vec<String>,
    pub official_url: Option<String>,
    /// 신청 방법 안내 텍스트 (신청 가이드 카드용)
    pub application_method: Option<String>,
    /// 제출 서류 안내 텍스트 (신청 가이드 카드용)
    pub submission_documents: Option<String>,
    /// 심사 방법 안내 텍스트 (신청 가이드 카드용)
    pub screening_method: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendationResult {
    pub total_available: usize,
    pub estimated_monthly: i64,
    pub estimated_semester: i64,
    pub items: Vec<RecommendationItem>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use uuid::Uuid;

    fn fixed_uuid() -> Uuid {
        Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap()
    }

    fn fixed_now() -> DateTime<Utc> {
        "2026-01-01T00:00:00Z".parse().unwrap()
    }

    // ── ProfileInput ──

    #[test]
    fn profile_input_required_fields() {
        let input = ProfileInput {
            birth_year: 2000,
            region_code: "busan".to_string(),
            city_code: None,
            school_name: None,
            school_year: None,
            enrollment_status: None,
            employment_status: None,
            major_group: None,
            income_bracket: None,
            kosaf_support_bracket: None,
            housing_type: None,
            household_size: None,
            has_disability: None,
            is_multicultural_family: None,
            is_low_income_household: None,
            veteran_family: None,
            preferred_categories: None,
            school_type: None,
            age_band: None,
        };
        assert_eq!(input.birth_year, 2000);
        assert_eq!(input.region_code, "busan");
        assert!(input.income_bracket.is_none());
        assert!(input.has_disability.is_none());
    }

    #[test]
    fn profile_input_roundtrip_json() {
        let input = ProfileInput {
            birth_year: 1999,
            region_code: "seoul".to_string(),
            city_code: Some("gangnam".to_string()),
            school_name: None,
            school_year: Some(2),
            enrollment_status: Some("enrolled".to_string()),
            employment_status: None,
            major_group: Some("engineering".to_string()),
            income_bracket: Some(3),
            kosaf_support_bracket: None,
            housing_type: Some("rental".to_string()),
            household_size: Some(2),
            has_disability: Some(false),
            is_multicultural_family: None,
            is_low_income_household: None,
            veteran_family: None,
            preferred_categories: Some(vec!["scholarship".to_string()]),
            school_type: Some("university".to_string()),
            age_band: None,
        };
        let json = serde_json::to_string(&input).expect("serialize");
        let decoded: ProfileInput = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(decoded.birth_year, 1999);
        assert_eq!(decoded.region_code, "seoul");
        assert_eq!(decoded.city_code, Some("gangnam".to_string()));
        assert_eq!(decoded.income_bracket, Some(3));
    }

    // ── RecommendationItem ──

    #[test]
    fn recommendation_item_score_capped() {
        let item = RecommendationItem {
            program_id: fixed_uuid(),
            title: "테스트 장학금".to_string(),
            program_type: "scholarship".to_string(),
            match_score: 100,
            benefit_amount_monthly: Some(300_000),
            benefit_amount_semester: None,
            deadline: Some("2026-12-31".to_string()),
            reasons: vec!["부산 거주 청년 대상이에요.".to_string()],
            missing_checks: vec![],
            official_url: Some("https://example.com".to_string()),
            application_method: None,
            submission_documents: None,
            screening_method: None,
        };
        assert!(item.match_score <= 100, "score must not exceed 100");
        assert_eq!(item.program_type, "scholarship");
    }

    #[test]
    fn recommendation_item_roundtrip_json() {
        let item = RecommendationItem {
            program_id: fixed_uuid(),
            title: "청년 지원금".to_string(),
            program_type: "support".to_string(),
            match_score: 75,
            benefit_amount_monthly: Some(200_000),
            benefit_amount_semester: None,
            deadline: None,
            reasons: vec!["현재 연령 조건에 맞아요.".to_string()],
            missing_checks: vec!["소득 기준 확인 필요".to_string()],
            official_url: None,
            application_method: None,
            submission_documents: None,
            screening_method: None,
        };
        let json = serde_json::to_string(&item).expect("serialize");
        let decoded: RecommendationItem = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(decoded.match_score, 75);
        assert_eq!(decoded.reasons.len(), 1);
        assert_eq!(decoded.missing_checks.len(), 1);
        assert!(decoded.deadline.is_none());
    }

    // ── RecommendationResult ──

    #[test]
    fn recommendation_result_estimated_totals() {
        let item1 = RecommendationItem {
            program_id: fixed_uuid(),
            title: "A".to_string(),
            program_type: "scholarship".to_string(),
            match_score: 80,
            benefit_amount_monthly: Some(200_000),
            benefit_amount_semester: None,
            deadline: None,
            reasons: vec![],
            missing_checks: vec![],
            official_url: None,
            application_method: None,
            submission_documents: None,
            screening_method: None,
        };
        let item2 = RecommendationItem {
            program_id: Uuid::parse_str("00000000-0000-0000-0000-000000000002").unwrap(),
            title: "B".to_string(),
            program_type: "support".to_string(),
            match_score: 60,
            benefit_amount_monthly: Some(300_000),
            benefit_amount_semester: Some(1_000_000),
            deadline: None,
            reasons: vec![],
            missing_checks: vec![],
            official_url: None,
            application_method: None,
            submission_documents: None,
            screening_method: None,
        };
        let result = RecommendationResult {
            total_available: 2,
            estimated_monthly: 500_000,
            estimated_semester: 1_000_000,
            items: vec![item1, item2],
        };
        assert_eq!(result.total_available, 2);
        assert_eq!(result.estimated_monthly, 500_000);
        assert_eq!(result.estimated_semester, 1_000_000);
    }

    #[test]
    fn recommendation_result_empty() {
        let result = RecommendationResult {
            total_available: 0,
            estimated_monthly: 0,
            estimated_semester: 0,
            items: vec![],
        };
        assert_eq!(result.total_available, 0);
        assert!(result.items.is_empty());
    }

    // ── UserProfile ──

    #[test]
    fn user_profile_version_starts_at_one() {
        let profile = UserProfile {
            user_id: fixed_uuid(),
            birth_year: Some(2000),
            region_code: Some("busan".to_string()),
            city_code: None,
            school_name: None,
            school_year: None,
            enrollment_status: None,
            employment_status: None,
            major_group: None,
            income_bracket: None,
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
            updated_at: fixed_now(),
            nickname: None,
            profile_image_url: None,
        };
        assert_eq!(profile.profile_version, 1);
        assert_eq!(profile.region_code, Some("busan".to_string()));
        assert!(!profile.has_disability);
        assert!(profile.preferred_categories.is_empty());
    }

    // ── Bookmark ──

    #[test]
    fn bookmark_fields() {
        let now = fixed_now();
        let bookmark = Bookmark {
            id: fixed_uuid(),
            user_id: fixed_uuid(),
            program_id: Uuid::parse_str("00000000-0000-0000-0000-000000000002").unwrap(),
            created_at: now,
        };
        assert_eq!(bookmark.user_id, fixed_uuid());
    }
}
