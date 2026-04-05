//! Payment provider abstraction.
//!
//! SECURITY:
//!   - Fail-closed by design: if PORTONE_API_KEY / PORTONE_API_SECRET are not
//!     set at startup, ALL payment verifications return an error.  There is no
//!     fallback that lets a payment through.
//!   - The access token obtained from PortOne is short-lived and not stored.
//!   - No client-supplied data is trusted; we always re-fetch from PortOne.

use anyhow::{bail, Context, Result};
use async_trait::async_trait;
use serde::Deserialize;

// ── Public types ──────────────────────────────────────────────────────────────

/// The receipt returned by the payment gateway after a successful verification.
#[derive(Debug, Clone)]
pub struct PgReceipt {
    /// Payment status string from the gateway (e.g. "paid", "failed", "cancelled").
    pub status: String,
    /// Amount actually charged, in KRW.
    pub amount: i64,
    /// Merchant UID (our internal order ID sent to the gateway).
    pub merchant_uid: String,
}

// ── Trait ─────────────────────────────────────────────────────────────────────

/// Verify that a payment actually occurred at the payment gateway.
///
/// Implementations must be `Send + Sync` so they can live in `AppState`.
#[async_trait]
pub trait PaymentProvider: Send + Sync {
    async fn verify_payment(&self, payment_id: &str) -> Result<PgReceipt>;
}

// ── Fail-closed sentinel ──────────────────────────────────────────────────────

/// Used when the PortOne credentials are absent.
/// Every call unconditionally fails, ensuring no payment can sneak through.
pub struct UnconfiguredProvider;

#[async_trait]
impl PaymentProvider for UnconfiguredProvider {
    async fn verify_payment(&self, _payment_id: &str) -> Result<PgReceipt> {
        bail!(
            "Payment gateway is not configured (PORTONE_API_KEY / PORTONE_API_SECRET missing). \
             All payment verifications are rejected."
        );
    }
}

// ── PortOne (iamport) provider ────────────────────────────────────────────────

/// Calls the PortOne REST API to verify a payment receipt.
///
/// Flow:
///   1. POST /users/getToken  → short-lived access token
///   2. GET  /payments/{imp_uid} with Bearer token → payment record
pub struct PortOneProvider {
    api_key: String,
    api_secret: String,
    client: reqwest::Client,
}

impl PortOneProvider {
    pub fn new(api_key: String, api_secret: String) -> Self {
        Self {
            api_key,
            api_secret,
            client: reqwest::Client::new(),
        }
    }

    /// Obtain a short-lived access token from PortOne.
    async fn fetch_token(&self) -> Result<String> {
        #[derive(Deserialize)]
        struct TokenResponse {
            response: TokenBody,
        }
        #[derive(Deserialize)]
        struct TokenBody {
            access_token: String,
        }

        let res = self
            .client
            .post("https://api.iamport.kr/users/getToken")
            .json(&serde_json::json!({
                "imp_key": self.api_key,
                "imp_secret": self.api_secret,
            }))
            .send()
            .await
            .context("Failed to reach PortOne token endpoint")?;

        if !res.status().is_success() {
            let status = res.status();
            let body = res.text().await.unwrap_or_default();
            bail!("PortOne getToken returned {status}: {body}");
        }

        let token_res: TokenResponse = res
            .json()
            .await
            .context("Failed to parse PortOne token response")?;

        Ok(token_res.response.access_token)
    }
}

#[async_trait]
impl PaymentProvider for PortOneProvider {
    async fn verify_payment(&self, payment_id: &str) -> Result<PgReceipt> {
        #[derive(Deserialize)]
        struct PaymentResponse {
            response: PaymentBody,
        }
        #[derive(Deserialize)]
        struct PaymentBody {
            status: String,
            amount: i64,
            merchant_uid: String,
        }

        let token = self.fetch_token().await?;

        let url = format!("https://api.iamport.kr/payments/{}", payment_id);
        let res = self
            .client
            .get(&url)
            .bearer_auth(&token)
            .send()
            .await
            .context("Failed to reach PortOne payments endpoint")?;

        if !res.status().is_success() {
            let status = res.status();
            let body = res.text().await.unwrap_or_default();
            bail!("PortOne /payments/{payment_id} returned {status}: {body}");
        }

        let payment_res: PaymentResponse = res
            .json()
            .await
            .context("Failed to parse PortOne payment response")?;

        Ok(PgReceipt {
            status: payment_res.response.status,
            amount: payment_res.response.amount,
            merchant_uid: payment_res.response.merchant_uid,
        })
    }
}

// ── Constructor helper ────────────────────────────────────────────────────────

/// Build the appropriate `PaymentProvider` from environment variables.
///
/// Returns `UnconfiguredProvider` (fail-closed) when either
/// `PORTONE_API_KEY` or `PORTONE_API_SECRET` is absent.
pub fn build_payment_provider() -> Box<dyn PaymentProvider> {
    match (
        std::env::var("PORTONE_API_KEY"),
        std::env::var("PORTONE_API_SECRET"),
    ) {
        (Ok(key), Ok(secret)) if !key.is_empty() && !secret.is_empty() => {
            tracing::info!("PortOne payment provider configured");
            Box::new(PortOneProvider::new(key, secret))
        }
        _ => {
            tracing::warn!(
                "PORTONE_API_KEY or PORTONE_API_SECRET is not set. \
                 ALL payment verifications will be rejected (fail-closed)."
            );
            Box::new(UnconfiguredProvider)
        }
    }
}
