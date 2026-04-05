use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub app_env: String,
    pub app_port: u16,
    pub database_url: String,
    pub redis_url: String,
    pub jwt_secret: String,
}

impl AppConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        dotenvy::dotenv().ok();

        let app_env = std::env::var("APP_ENV").unwrap_or_else(|_| "local".to_string());
        let jwt_secret = std::env::var("JWT_SECRET")?;

        // Reject weak JWT secrets in non-local environments.
        // A 32-character minimum ensures at least 256 bits of entropy
        // when the secret is random, and blocks placeholder values like
        // "change-me-in-production" from reaching staging/prod.
        if app_env != "local" && jwt_secret.len() < 32 {
            anyhow::bail!(
                "JWT_SECRET must be at least 32 characters in non-local environments (current length: {})",
                jwt_secret.len()
            );
        }

        Ok(Self {
            app_env,
            app_port: std::env::var("APP_PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()?,
            database_url: std::env::var("DATABASE_URL")?,
            redis_url: std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://localhost:6379".to_string()),
            jwt_secret,
        })
    }
}

/// Worker-specific config for external data source API keys.
/// Each key falls back to GOV_API_KEY if its own var is not set.
#[derive(Debug, Clone)]
pub struct WorkerApiKeys {
    /// 정부24 공공서비스 혜택 API (odcloud)
    pub gov_benefits_api_key: String,
    /// 온통청년 Open API
    pub youth_center_api_key: String,
    /// 한국장학재단 장학금 API (odcloud)
    pub kosaf_api_key: String,
    /// 금융감독원 금융상품 비교공시 API
    /// Optional: empty string means the key is not configured.
    pub fss_api_key: String,
}

impl WorkerApiKeys {
    pub fn from_env() -> anyhow::Result<Self> {
        dotenvy::dotenv().ok();

        // GOV_API_KEY is the shared odcloud key used as fallback
        // for sources that do not have their own dedicated env var.
        let gov_key = std::env::var("GOV_API_KEY").unwrap_or_default();

        let gov_benefits_api_key =
            std::env::var("GOV_BENEFITS_API_KEY").unwrap_or_else(|_| gov_key.clone());

        let youth_center_api_key =
            std::env::var("YOUTH_CENTER_API_KEY").unwrap_or_else(|_| gov_key.clone());

        let kosaf_api_key = std::env::var("KOSAF_API_KEY").unwrap_or_else(|_| gov_key.clone());

        let fss_api_key = std::env::var("FSS_API_KEY").unwrap_or_default();

        Ok(Self {
            gov_benefits_api_key,
            youth_center_api_key,
            kosaf_api_key,
            fss_api_key,
        })
    }
}
