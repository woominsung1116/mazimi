use sqlx::postgres::PgPoolOptions;
use tracing_subscriber::EnvFilter;

use majimi_core::AppConfig;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    let config = AppConfig::from_env()?;

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await?;

    sqlx::migrate!("../../infra/migrations")
        .run(&pool)
        .await?;

    tracing::info!("DB connected and migrations applied");

    let app = api::build_app(pool, config.jwt_secret.clone());

    let addr = format!("0.0.0.0:{}", config.app_port);
    tracing::info!("API server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app.into_make_service_with_connect_info::<std::net::SocketAddr>()).await?;

    Ok(())
}
