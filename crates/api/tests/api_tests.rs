use reqwest::Client;
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use tokio::net::TcpListener;

const DATABASE_URL: &str = "postgres://wello:wello@localhost:5432/wello";

/// Starts the app on a random port, returns the base URL.
async fn start_test_server() -> String {
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(DATABASE_URL)
        .await
        .expect("Failed to connect to test database");

    let app = api::build_app(pool, "test-secret".to_string());

    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .expect("Failed to bind random port");
    let addr: SocketAddr = listener.local_addr().unwrap();

    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    format!("http://{addr}")
}

// ── GET /health ──

#[tokio::test]
async fn health_returns_200_ok() {
    let base = start_test_server().await;
    let client = Client::new();

    let resp = client
        .get(format!("{base}/health"))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 200);

    let body: Value = resp.json().await.expect("invalid json");
    assert_eq!(body["status"], "ok");
}

// ── GET /api/v1/programs ──

#[tokio::test]
async fn list_programs_returns_list() {
    let base = start_test_server().await;
    let client = Client::new();

    let resp = client
        .get(format!("{base}/api/v1/programs"))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 200);

    let body: Value = resp.json().await.expect("invalid json");
    assert!(body["total"].is_number(), "response must have 'total' field");
    assert!(body["items"].is_array(), "response must have 'items' array");
}

// ── POST /api/v1/recommend/preview (busan, birth_year 2000) ──

#[tokio::test]
async fn recommend_preview_busan_2000_returns_items() {
    let base = start_test_server().await;
    let client = Client::new();

    let payload = json!({
        "birth_year": 2000,
        "region_code": "busan"
    });

    let resp = client
        .post(format!("{base}/api/v1/recommend/preview"))
        .json(&payload)
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 200);

    let body: Value = resp.json().await.expect("invalid json");
    assert!(body["total_available"].is_number());
    assert!(body["items"].is_array());
    assert!(body["estimated_monthly"].is_number());
    assert!(body["estimated_semester"].is_number());
}

// ── POST /api/v1/profile → creates user and profile ──

#[tokio::test]
async fn save_profile_creates_user_and_profile() {
    let base = start_test_server().await;
    let client = Client::new();

    let payload = json!({
        "birth_year": 2001,
        "region_code": "busan"
    });

    let resp = client
        .post(format!("{base}/api/v1/profile"))
        .json(&payload)
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 200);

    let body: Value = resp.json().await.expect("invalid json");
    assert!(
        body["user_id"].is_string(),
        "response must include user_id: {body}"
    );
    assert_eq!(
        body["profile"]["birth_year"], 2001,
        "profile must echo birth_year"
    );
    assert_eq!(
        body["profile"]["region_code"], "busan",
        "profile must echo region_code"
    );
}

// ── Recommendation reproducibility: same input → same output ──

#[tokio::test]
async fn recommend_preview_is_reproducible() {
    let base = start_test_server().await;
    let client = Client::new();

    let payload = json!({
        "birth_year": 2000,
        "region_code": "busan"
    });

    let resp1 = client
        .post(format!("{base}/api/v1/recommend/preview"))
        .json(&payload)
        .send()
        .await
        .expect("first request failed");
    assert_eq!(resp1.status(), 200);
    let body1: Value = resp1.json().await.expect("invalid json on first call");

    let resp2 = client
        .post(format!("{base}/api/v1/recommend/preview"))
        .json(&payload)
        .send()
        .await
        .expect("second request failed");
    assert_eq!(resp2.status(), 200);
    let body2: Value = resp2.json().await.expect("invalid json on second call");

    assert_eq!(
        body1["total_available"], body2["total_available"],
        "total_available must be identical across calls"
    );
    assert_eq!(
        body1["estimated_monthly"], body2["estimated_monthly"],
        "estimated_monthly must be identical across calls"
    );
    assert_eq!(
        body1["items"], body2["items"],
        "items (including order) must be identical across calls"
    );
}
