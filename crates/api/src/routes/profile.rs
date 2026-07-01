use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use mazimi_core::models::{ProfileInput, UserProfile};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::AuthUser;

/// POST /api/v1/profile
///
/// Upserts the authenticated user's profile.
/// The user's ID is taken from the JWT — the client must be authenticated.
pub async fn save_profile(
    auth_user: AuthUser,
    State(pool): State<PgPool>,
    Json(payload): Json<SaveProfileRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = auth_user.id;
    let input = &payload.profile;

    // Upsert into user_profiles
    sqlx::query(
        r#"
        INSERT INTO user_profiles (
            user_id, birth_year, region_code, city_code, school_name, school_year,
            enrollment_status, employment_status, major_group, income_bracket,
            kosaf_support_bracket, housing_type, household_size,
            has_disability, is_multicultural_family, is_low_income_household,
            veteran_family, preferred_categories, school_type, age_band,
            updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20, now())
        ON CONFLICT (user_id) DO UPDATE SET
            birth_year = EXCLUDED.birth_year,
            region_code = EXCLUDED.region_code,
            city_code = EXCLUDED.city_code,
            school_name = EXCLUDED.school_name,
            school_year = EXCLUDED.school_year,
            enrollment_status = EXCLUDED.enrollment_status,
            employment_status = EXCLUDED.employment_status,
            major_group = EXCLUDED.major_group,
            income_bracket = EXCLUDED.income_bracket,
            kosaf_support_bracket = EXCLUDED.kosaf_support_bracket,
            housing_type = EXCLUDED.housing_type,
            household_size = EXCLUDED.household_size,
            has_disability = EXCLUDED.has_disability,
            is_multicultural_family = EXCLUDED.is_multicultural_family,
            is_low_income_household = EXCLUDED.is_low_income_household,
            veteran_family = EXCLUDED.veteran_family,
            preferred_categories = EXCLUDED.preferred_categories,
            school_type = EXCLUDED.school_type,
            age_band = EXCLUDED.age_band,
            profile_version = user_profiles.profile_version + 1,
            updated_at = now()
        "#,
    )
    .bind(user_id)
    .bind(input.birth_year)
    .bind(&input.region_code)
    .bind(&input.city_code)
    .bind(&input.school_name)
    .bind(input.school_year)
    .bind(&input.enrollment_status)
    .bind(&input.employment_status)
    .bind(&input.major_group)
    .bind(input.income_bracket)
    .bind(input.kosaf_support_bracket)
    .bind(&input.housing_type)
    .bind(input.household_size)
    .bind(input.has_disability.unwrap_or(false))
    .bind(input.is_multicultural_family.unwrap_or(false))
    .bind(input.is_low_income_household.unwrap_or(false))
    .bind(input.veteran_family.unwrap_or(false))
    .bind(input.preferred_categories.clone().unwrap_or_default())
    .bind(&input.school_type)
    .bind(&input.age_band)
    .execute(&pool)
    .await
    .map_err(crate::errors::internal_error)?;

    // Fetch back the saved profile
    let profile =
        sqlx::query_as::<_, UserProfile>("SELECT * FROM user_profiles WHERE user_id = $1")
            .bind(user_id)
            .fetch_one(&pool)
            .await
            .map_err(crate::errors::internal_error)?;

    Ok(Json(json!({
        "user_id": user_id,
        "profile": profile
    })))
}

/// GET /api/v1/profile
///
/// Fetches the authenticated user's own profile using JWT identity.
pub async fn get_my_profile(
    auth_user: AuthUser,
    State(pool): State<PgPool>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = auth_user.id;

    let profile =
        sqlx::query_as::<_, UserProfile>("SELECT * FROM user_profiles WHERE user_id = $1")
            .bind(user_id)
            .fetch_optional(&pool)
            .await
            .map_err(crate::errors::internal_error)?;

    match profile {
        Some(p) => Ok(Json(json!({
            "user_id": user_id,
            "profile": p
        }))),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Profile not found" })),
        )),
    }
}

/// GET /api/v1/profile/{user_id}
///
/// Fetches a profile by user_id from the path. Only the authenticated user
/// may fetch their own profile — other user IDs are rejected with 403.
pub async fn get_profile(
    auth_user: AuthUser,
    State(pool): State<PgPool>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Enforce ownership: callers may only read their own profile
    if auth_user.id != user_id && auth_user.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Forbidden: you may only access your own profile" })),
        ));
    }

    let profile =
        sqlx::query_as::<_, UserProfile>("SELECT * FROM user_profiles WHERE user_id = $1")
            .bind(user_id)
            .fetch_optional(&pool)
            .await
            .map_err(crate::errors::internal_error)?;

    match profile {
        Some(p) => Ok(Json(json!({
            "user_id": user_id,
            "profile": p
        }))),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Profile not found" })),
        )),
    }
}

// ── Request types ──

#[derive(Debug, serde::Deserialize)]
pub struct SaveProfileRequest {
    #[serde(flatten)]
    pub profile: ProfileInput,
}
