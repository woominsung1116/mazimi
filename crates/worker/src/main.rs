mod alerts;
mod notifications;
mod pipeline;
mod sources;

use sqlx::postgres::PgPoolOptions;
use tokio_cron_scheduler::{Job, JobScheduler};
use tracing_subscriber::EnvFilter;

use mazimi_core::AppConfig;

use crate::notifications::NotificationDispatcher;
use crate::sources::dreamspon::DreamsponSource;
use crate::sources::financial::FssFinancialSource;
use crate::sources::gov_benefits::GovBenefitsSource;
use crate::sources::local_scraper::LocalScraperSource;
use crate::sources::scholarship::ScholarshipSource;
use crate::sources::youth_center::YouthCenterSource;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    let config = AppConfig::from_env()?;

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&config.database_url)
        .await?;

    tracing::info!("Worker connected to DB");

    // 알림 채널 초기화 (env 없는 채널은 warn 후 skip)
    let notifier = std::sync::Arc::new(NotificationDispatcher::from_env());

    let sched = JobScheduler::new().await?;

    // Health check every 60 seconds
    sched
        .add(Job::new_async("0 * * * * *", {
            let pool = pool.clone();
            move |_uuid, _l| {
                let pool = pool.clone();
                Box::pin(async move {
                    match sqlx::query_scalar::<_, i32>("SELECT 1")
                        .fetch_one(&pool)
                        .await
                    {
                        Ok(_) => tracing::info!("Worker health check: OK"),
                        Err(e) => tracing::error!("Worker health check failed: {}", e),
                    }
                })
            }
        })?)
        .await?;

    // Daily sync of all data sources at 02:00 UTC
    sched
        .add(Job::new_async("0 0 2 * * *", {
            let pool = pool.clone();
            move |_uuid, _l| {
                let pool = pool.clone();
                Box::pin(async move {
                    tracing::info!("sync_all: starting daily ingestion");

                    // 온통청년
                    match YouthCenterSource::from_env() {
                        Ok(src) => {
                            if let Err(e) = pipeline::run_ingestion(&pool, &src).await {
                                tracing::error!(source = "youth_center", error = %e, "ingestion failed");
                            }
                        }
                        Err(e) => {
                            tracing::warn!(source = "youth_center", error = %e, "source skipped (env not set)");
                        }
                    }

                    // 행안부 공공서비스 혜택
                    match GovBenefitsSource::from_env() {
                        Ok(src) => {
                            if let Err(e) = pipeline::run_ingestion(&pool, &src).await {
                                tracing::error!(source = "gov_benefits", error = %e, "ingestion failed");
                            }
                        }
                        Err(e) => {
                            tracing::warn!(source = "gov_benefits", error = %e, "source skipped (env not set)");
                        }
                    }

                    // 한국장학재단 장학금
                    match ScholarshipSource::from_env() {
                        Ok(src) => {
                            if let Err(e) = pipeline::run_ingestion(&pool, &src).await {
                                tracing::error!(source = "scholarship", error = %e, "ingestion failed");
                            }
                        }
                        Err(e) => {
                            tracing::warn!(source = "scholarship", error = %e, "source skipped (env not set)");
                        }
                    }

                    // 지역 청년 포털 HTML 스크래핑 (SCRAPER_ENABLED=true 일 때만)
                    // Scraping is optional and best-effort: selector drift is
                    // expected. Failures are logged but never abort the run.
                    match LocalScraperSource::from_env() {
                        Some(src) => {
                            if let Err(e) = pipeline::run_ingestion(&pool, &src).await {
                                tracing::warn!(
                                    source = "local_scraper",
                                    error = %e,
                                    "scraper ingestion failed (non-fatal)"
                                );
                            }
                        }
                        None => {
                            tracing::debug!(
                                source = "local_scraper",
                                "SCRAPER_ENABLED not set — skipping HTML scraping"
                            );
                        }
                    }

                    // 금융감독원 금융상품 비교공시 (FSS_API_KEY 없으면 skip)
                    match FssFinancialSource::from_env() {
                        Some(src) => {
                            if let Err(e) = pipeline::run_ingestion(&pool, &src).await {
                                tracing::error!(source = "fss_financial", error = %e, "ingestion failed");
                            }
                        }
                        None => {
                            tracing::debug!(
                                source = "fss_financial",
                                "FSS_API_KEY not set — skipping 금융상품 sync"
                            );
                        }
                    }

                    // 드림스폰 장학금 (기업 장학금 포함, 인증 불필요)
                    match DreamsponSource::from_env() {
                        Some(src) => {
                            if let Err(e) = pipeline::run_ingestion(&pool, &src).await {
                                tracing::error!(source = "dreamspon", error = %e, "ingestion failed");
                            }
                        }
                        None => {
                            tracing::debug!(
                                source = "dreamspon",
                                "DREAMSPON_ENABLED=false — skipping 드림스폰 sync"
                            );
                        }
                    }

                    tracing::info!("sync_all: daily ingestion complete");
                })
            }
        })?)
        .await?;

    // Expo push receipt check every 15 minutes
    sched
        .add(Job::new_async("0 */15 * * * *", {
            let notifier = notifier.clone();
            move |_uuid, _l| {
                let notifier = notifier.clone();
                Box::pin(async move {
                    notifier.check_pending_receipts().await;
                })
            }
        })?)
        .await?;

    // Deadline alerts every hour (D-7/D-3/D-1)
    sched
        .add(Job::new_async("0 0 * * * *", {
            let pool = pool.clone();
            let notifier = notifier.clone();
            move |_uuid, _l| {
                let pool = pool.clone();
                let notifier = notifier.clone();
                Box::pin(async move {
                    if let Err(e) = alerts::generate_deadline_alerts(&pool, &notifier).await {
                        tracing::error!(error = %e, "deadline alert generation failed");
                    }
                })
            }
        })?)
        .await?;

    sched.start().await?;

    tracing::info!("Worker scheduler started");

    // Keep running
    tokio::signal::ctrl_c().await?;
    tracing::info!("Worker shutting down");

    Ok(())
}
