//! Payment verification routes.
//!
//! SECURITY:
//!   - Prices are fetched from `subscription_plans` in the DB — never trusted from the client.
//!   - `user_id` always comes from the JWT (AuthUser extractor) — never from request body.
//!   - All SQL uses parameterized binding; no string interpolation.
//!   - `payment_id` is stored with a UNIQUE constraint to prevent replay attacks.
//!   - PG receipt is verified against PortOne before any subscription is created.
//!     If credentials are absent the provider is fail-closed and all verifications fail.

use axum::{extract::State, http::StatusCode, Json};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::AppState;

// ── Request / response types ──────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct VerifyPaymentRequest {
    /// Opaque payment ID issued by the payment gateway (e.g. PortOne).
    pub payment_id: String,
    /// Amount in KRW that the client claims was charged.
    /// SECURITY: this value is validated against the DB price and rejected on mismatch.
    pub amount: i64,
    /// Product type: "premium_monthly" | "premium_yearly"
    pub product_type: String,
}

// ── Row types for sqlx ────────────────────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct Plan {
    price_krw: i64,
    duration_days: i32,
    active: bool,
}

#[derive(Debug, sqlx::FromRow)]
struct Subscription {
    id: Uuid,
    plan_id: String,
    expires_at: DateTime<Utc>,
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/// POST /api/v1/payments/verify
///
/// Verifies a payment by:
///   1. Fetching the authoritative plan price from the DB.
///   2. Calling the PortOne API to confirm the payment actually occurred.
///   3. Checking receipt.status == "paid" and receipt.amount == plan price.
///   4. Only then inserting the subscription row.
///
/// SECURITY:
///   - `user_id` is extracted from the JWT — the client cannot forge it.
///   - `price_krw` is read from the DB; client amount must match exactly.
///   - PG receipt is verified with PortOne before any DB write.
///   - Fail-closed: if PG credentials are absent, verification always fails.
///   - `payment_id` has a UNIQUE DB constraint — re-submitting the same ID
///     returns 409 Conflict rather than creating a duplicate subscription.
pub async fn verify_payment(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<VerifyPaymentRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = auth_user.id;
    let pool = &state.pool;

    let bad_request = |msg: &str| (StatusCode::BAD_REQUEST, Json(json!({ "error": msg })));
    let db_err = |e: sqlx::Error| {
        tracing::error!(error = %e, "DB error in verify_payment");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Internal server error" })),
        )
    };

    // Basic input validation
    if payload.payment_id.trim().is_empty() || payload.payment_id.len() > 256 {
        return Err(bad_request("payment_id must not be empty"));
    }
    if payload.amount <= 0 {
        return Err(bad_request("amount must be positive"));
    }

    // SECURITY: Fetch authoritative price from DB — never use client-supplied amount directly.
    let plan = sqlx::query_as::<_, Plan>(
        "SELECT price_krw, duration_days, active FROM subscription_plans WHERE id = $1",
    )
    .bind(&payload.product_type)
    .fetch_optional(pool)
    .await
    .map_err(db_err)?
    .ok_or_else(|| bad_request("Unknown product_type"))?;

    if !plan.active {
        return Err(bad_request("This plan is no longer available"));
    }

    // SECURITY: Verify the payment with PortOne before trusting it.
    // Fail-closed: if provider is unconfigured this always returns Err.
    let receipt = state
        .payment_provider
        .verify_payment(&payload.payment_id)
        .await
        .map_err(|e| {
            tracing::error!(
                user_id = %user_id,
                payment_id = %payload.payment_id,
                error = %e,
                "PG verification failed"
            );
            (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Payment could not be verified with the payment gateway" })),
            )
        })?;

    // SECURITY: Receipt must show "paid" status.
    if receipt.status != "paid" {
        tracing::warn!(
            user_id = %user_id,
            payment_id = %payload.payment_id,
            pg_status = %receipt.status,
            "PG receipt status is not 'paid'"
        );
        return Err(bad_request("Payment has not been completed"));
    }

    // SECURITY: Receipt amount must match DB plan price — prevents partial-payment attacks.
    if receipt.amount != plan.price_krw {
        tracing::warn!(
            user_id = %user_id,
            payment_id = %payload.payment_id,
            receipt_amount = receipt.amount,
            db_price = plan.price_krw,
            product_type = %payload.product_type,
            "PG receipt amount does not match plan price — possible partial-payment attack"
        );
        return Err(bad_request("Payment amount does not match plan price"));
    }

    // SECURITY: Also reject if client-supplied amount mismatches DB price (belt-and-suspenders).
    if payload.amount != plan.price_krw {
        tracing::warn!(
            user_id = %user_id,
            client_amount = payload.amount,
            db_price = plan.price_krw,
            product_type = %payload.product_type,
            "Client amount mismatch — possible price manipulation attempt"
        );
        return Err(bad_request("Payment amount does not match plan price"));
    }

    let expires_at = Utc::now() + chrono::Duration::days(plan.duration_days as i64);

    // Insert subscription; UNIQUE constraint on payment_id prevents replay.
    let row = sqlx::query_as::<_, Subscription>(
        r#"
        INSERT INTO user_subscriptions
            (user_id, plan_id, payment_id, price_krw, status, expires_at)
        VALUES ($1, $2, $3, $4, 'active', $5)
        RETURNING id, plan_id, expires_at
        "#,
    )
    .bind(user_id)
    .bind(&payload.product_type)
    .bind(&payload.payment_id)
    .bind(plan.price_krw) // use DB price, never client amount
    .bind(expires_at)
    .fetch_one(pool)
    .await
    .map_err(|e| match e {
        // payment_id already exists — idempotent 409
        sqlx::Error::Database(ref db)
            if db.constraint() == Some("user_subscriptions_payment_id_key") =>
        {
            (
                StatusCode::CONFLICT,
                Json(json!({ "error": "This payment has already been recorded" })),
            )
        }
        other => {
            tracing::error!(error = %other, "Failed to insert subscription");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Internal server error" })),
            )
        }
    })?;

    tracing::info!(
        user_id = %user_id,
        subscription_id = %row.id,
        plan_id = %row.plan_id,
        expires_at = %row.expires_at,
        "Subscription activated"
    );

    Ok(Json(json!({
        "verified": true,
        "subscription_id": row.id,
        "plan_id": row.plan_id,
        "expires_at": row.expires_at,
    })))
}

/// GET /api/v1/payments/status
///
/// Returns the authenticated user's current subscription status.
/// Looks for the most recent active subscription that has not yet expired.
pub async fn subscription_status(
    auth_user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = auth_user.id;
    let pool = &state.pool;

    let db_err = |e: sqlx::Error| {
        tracing::error!(error = %e, "DB error in subscription_status");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Internal server error" })),
        )
    };

    // Fetch the most recent non-expired active subscription for this user.
    // SECURITY: user_id is from JWT — no IDOR possible.
    let sub = sqlx::query_as::<_, Subscription>(
        r#"
        SELECT id, plan_id, expires_at
        FROM user_subscriptions
        WHERE user_id = $1
          AND status = 'active'
          AND expires_at > now()
        ORDER BY expires_at DESC
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(db_err)?;

    match sub {
        Some(s) => Ok(Json(json!({
            "active": true,
            "plan_id": s.plan_id,
            "expires_at": s.expires_at,
        }))),
        None => Ok(Json(json!({
            "active": false,
            "plan_id": null,
            "expires_at": null,
        }))),
    }
}
