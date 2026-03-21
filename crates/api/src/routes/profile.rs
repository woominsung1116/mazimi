use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;
use majimi_core::models::{ProfileInput, UserProfile};

/// POST /api/v1/profile
/// Accepts an optional `user_id` field; creates a new user when absent.
pub async fn save_profile(
    State(pool): State<PgPool>,
    Json(payload): Json<SaveProfileRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = match payload.user_id {
        Some(id) => id,
        None => {
            // Create a new anonymous user
            let row = sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO users (auth_provider) VALUES ('anonymous') RETURNING id",
            )
            .fetch_one(&pool)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": format!("Failed to create user: {e}") })),
                )
            })?;
            row
        }
    };

    let input = &payload.profile;

    // Upsert into user_profiles
    sqlx::query(
        r#"
        INSERT INTO user_profiles (
            user_id, birth_year, region_code, city_code, school_name, school_year,
            enrollment_status, employment_status, major_group, income_bracket,
            kosaf_support_bracket, housing_type, household_size, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now())
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
    .execute(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to upsert profile: {e}") })),
        )
    })?;

    // Fetch back the saved profile
    let profile = sqlx::query_as::<_, UserProfile>("SELECT * FROM user_profiles WHERE user_id = $1")
        .bind(user_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("Failed to fetch profile: {e}") })),
            )
        })?;

    Ok(Json(json!({
        "user_id": user_id,
        "profile": profile
    })))
}

/// GET /api/v1/profile/:user_id
pub async fn get_profile(
    State(pool): State<PgPool>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let profile = sqlx::query_as::<_, UserProfile>("SELECT * FROM user_profiles WHERE user_id = $1")
        .bind(user_id)
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("DB error: {e}") })),
            )
        })?;

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
    pub user_id: Option<Uuid>,
    #[serde(flatten)]
    pub profile: ProfileInput,
}
