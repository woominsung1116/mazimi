use reqwest::Client;
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use tokio::net::TcpListener;
use uuid::Uuid;

const DATABASE_URL: &str = "postgres://wello:wello@localhost:5432/wello";
const JWT_SECRET: &str = "test-secret";

/// Starts the app on a random port, returns the base URL.
async fn start_test_server() -> String {
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(DATABASE_URL)
        .await
        .expect("Failed to connect to test database");

    sqlx::migrate!("../../infra/migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    let app = api::build_app_with_env(pool, JWT_SECRET.to_string(), "local".to_string());

    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .expect("Failed to bind random port");
    let addr: SocketAddr = listener.local_addr().unwrap();

    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });

    format!("http://{addr}")
}

/// Create a test user in the DB and return (user_id, access_token, refresh_token).
async fn create_test_user(base: &str) -> (Uuid, String, String) {
    // Insert user directly via a dedicated endpoint is not available for arbitrary users,
    // so we insert into DB via a direct pool connection and generate tokens ourselves.
    let pool = PgPoolOptions::new()
        .max_connections(2)
        .connect(DATABASE_URL)
        .await
        .expect("Failed to connect for test user setup");

    let user_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO users (auth_provider, auth_provider_id, role, created_at, updated_at)
        VALUES ('test', $1, 'user', now(), now())
        ON CONFLICT (auth_provider, auth_provider_id) DO UPDATE SET updated_at = now()
        RETURNING id
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .fetch_one(&pool)
    .await
    .expect("Failed to insert test user");

    // Insert a minimal profile so endpoints that read it don't 404
    sqlx::query(
        r#"
        INSERT INTO user_profiles (user_id, birth_year, region_code, updated_at)
        VALUES ($1, 2000, 'busan', now())
        ON CONFLICT (user_id) DO NOTHING
        "#,
    )
    .bind(user_id)
    .execute(&pool)
    .await
    .expect("Failed to insert test user profile");

    let _ = base; // unused but keeps signature consistent

    let access_token = api::auth::create_token(user_id, "user", JWT_SECRET)
        .expect("Failed to create access token");
    let refresh_token = api::auth::create_refresh_token(user_id, "user", JWT_SECRET)
        .expect("Failed to create refresh token");

    (user_id, access_token, refresh_token)
}

/// Create a test admin user in the DB and return (user_id, access_token).
async fn create_test_admin(base: &str) -> (Uuid, String) {
    let pool = PgPoolOptions::new()
        .max_connections(2)
        .connect(DATABASE_URL)
        .await
        .expect("Failed to connect for admin setup");

    let user_id: Uuid = sqlx::query_scalar(
        r#"
        INSERT INTO users (auth_provider, auth_provider_id, role, created_at, updated_at)
        VALUES ('test', $1, 'admin', now(), now())
        ON CONFLICT (auth_provider, auth_provider_id) DO UPDATE SET updated_at = now()
        RETURNING id
        "#,
    )
    .bind(format!("admin-{}", Uuid::new_v4()))
    .fetch_one(&pool)
    .await
    .expect("Failed to insert test admin user");

    let _ = base;

    let access_token = api::auth::create_token(user_id, "admin", JWT_SECRET)
        .expect("Failed to create admin access token");

    (user_id, access_token)
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

    let status = resp.status().as_u16();
    let body: Value = resp.json().await.expect("invalid json");
    assert_eq!(status, 200, "health check failed: {body}");
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
    assert!(
        body["total"].is_number(),
        "response must have 'total' field"
    );
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
    let (_, token, _) = create_test_user(&base).await;

    let payload = json!({
        "birth_year": 2001,
        "region_code": "busan"
    });

    let resp = client
        .post(format!("{base}/api/v1/profile"))
        .bearer_auth(&token)
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

// ── POST /api/v1/auth/refresh ──

#[tokio::test]
async fn auth_refresh_returns_new_tokens() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_, _, refresh_token) = create_test_user(&base).await;

    let resp = client
        .post(format!("{base}/api/v1/auth/refresh"))
        .json(&json!({ "refresh_token": refresh_token }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 200, "refresh should succeed");

    let body: Value = resp.json().await.expect("invalid json");
    assert!(
        body["token"].is_string(),
        "response must have 'token': {body}"
    );
    assert!(
        body["refresh_token"].is_string(),
        "response must have 'refresh_token': {body}"
    );
}

#[tokio::test]
async fn auth_refresh_rejects_access_token() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_, access_token, _) = create_test_user(&base).await;

    // Passing an access token to the refresh endpoint should be rejected
    let resp = client
        .post(format!("{base}/api/v1/auth/refresh"))
        .json(&json!({ "refresh_token": access_token }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 401);
}

// ── GET /api/v1/auth/me ──

#[tokio::test]
async fn auth_me_returns_user_info() {
    let base = start_test_server().await;
    let client = Client::new();
    let (user_id, token, _) = create_test_user(&base).await;

    let resp = client
        .get(format!("{base}/api/v1/auth/me"))
        .bearer_auth(&token)
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 200, "auth/me should succeed");

    let body: Value = resp.json().await.expect("invalid json");
    assert_eq!(
        body["id"].as_str().unwrap_or(""),
        user_id.to_string(),
        "returned id must match"
    );
    assert!(
        body["role"].is_string(),
        "response must have 'role': {body}"
    );
}

#[tokio::test]
async fn auth_me_rejects_unauthenticated() {
    let base = start_test_server().await;
    let client = Client::new();

    let resp = client
        .get(format!("{base}/api/v1/auth/me"))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 401);
}

// ── GET /api/v1/profile ──

#[tokio::test]
async fn get_profile_returns_own_profile() {
    let base = start_test_server().await;
    let client = Client::new();
    let (user_id, token, _) = create_test_user(&base).await;

    let resp = client
        .get(format!("{base}/api/v1/profile"))
        .bearer_auth(&token)
        .send()
        .await
        .expect("request failed");

    assert_eq!(
        resp.status(),
        200,
        "GET /profile should succeed: body omitted"
    );

    let body: Value = resp.json().await.expect("invalid json");
    assert_eq!(
        body["user_id"].as_str().unwrap_or(""),
        user_id.to_string(),
        "user_id must match"
    );
}

#[tokio::test]
async fn get_profile_rejects_unauthenticated() {
    let base = start_test_server().await;
    let client = Client::new();

    let resp = client
        .get(format!("{base}/api/v1/profile"))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 401);
}

// ── POST /api/v1/programs/{id}/bookmark ──

#[tokio::test]
async fn bookmark_toggle_works() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_, token, _) = create_test_user(&base).await;

    // Get a program id to bookmark
    let programs_resp = client
        .get(format!("{base}/api/v1/programs"))
        .send()
        .await
        .expect("programs request failed");
    let programs_body: Value = programs_resp.json().await.expect("invalid json");
    let items = programs_body["items"]
        .as_array()
        .expect("items must be array");

    if items.is_empty() {
        // No programs to bookmark; skip
        return;
    }

    let program_id = items[0]["id"].as_str().expect("program must have id");

    // First toggle: should bookmark
    let resp1 = client
        .post(format!("{base}/api/v1/programs/{program_id}/bookmark"))
        .bearer_auth(&token)
        .send()
        .await
        .expect("request failed");
    assert_eq!(resp1.status(), 200);
    let body1: Value = resp1.json().await.expect("invalid json");
    assert_eq!(body1["bookmarked"], true, "first toggle must bookmark");

    // Second toggle: should unbookmark
    let resp2 = client
        .post(format!("{base}/api/v1/programs/{program_id}/bookmark"))
        .bearer_auth(&token)
        .send()
        .await
        .expect("request failed");
    assert_eq!(resp2.status(), 200);
    let body2: Value = resp2.json().await.expect("invalid json");
    assert_eq!(body2["bookmarked"], false, "second toggle must unbookmark");
}

#[tokio::test]
async fn bookmark_rejects_unauthenticated() {
    let base = start_test_server().await;
    let client = Client::new();
    let fake_id = Uuid::new_v4();

    let resp = client
        .post(format!("{base}/api/v1/programs/{fake_id}/bookmark"))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 401);
}

// ── POST /api/v1/programs/{id}/state ──

#[tokio::test]
async fn upsert_state_works() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_, token, _) = create_test_user(&base).await;

    let programs_resp = client
        .get(format!("{base}/api/v1/programs"))
        .send()
        .await
        .expect("programs request failed");
    let programs_body: Value = programs_resp.json().await.expect("invalid json");
    let items = programs_body["items"]
        .as_array()
        .expect("items must be array");

    if items.is_empty() {
        return;
    }

    let program_id = items[0]["id"].as_str().expect("program must have id");

    let resp = client
        .post(format!("{base}/api/v1/programs/{program_id}/state"))
        .bearer_auth(&token)
        .json(&json!({ "state": "interested", "memo": "test memo" }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 200, "upsert state should succeed");

    let body: Value = resp.json().await.expect("invalid json");
    assert_eq!(body["state"], "interested", "state must match");
}

#[tokio::test]
async fn upsert_state_rejects_invalid_state() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_, token, _) = create_test_user(&base).await;
    let fake_id = Uuid::new_v4();

    let resp = client
        .post(format!("{base}/api/v1/programs/{fake_id}/state"))
        .bearer_auth(&token)
        .json(&json!({ "state": "invalid_state_xyz" }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn upsert_state_rejects_unauthenticated() {
    let base = start_test_server().await;
    let client = Client::new();
    let fake_id = Uuid::new_v4();

    let resp = client
        .post(format!("{base}/api/v1/programs/{fake_id}/state"))
        .json(&json!({ "state": "interested" }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 401);
}

// ── GET /api/v1/dashboard ──

#[tokio::test]
async fn dashboard_returns_stats() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_, token, _) = create_test_user(&base).await;

    let resp = client
        .get(format!("{base}/api/v1/dashboard"))
        .bearer_auth(&token)
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 200, "dashboard should succeed");

    let body: Value = resp.json().await.expect("invalid json");
    assert!(
        body["bookmarked_count"].is_number(),
        "must have bookmarked_count: {body}"
    );
    assert!(
        body["applying_count"].is_number(),
        "must have applying_count: {body}"
    );
    assert!(
        body["upcoming_deadlines"].is_array(),
        "must have upcoming_deadlines: {body}"
    );
    assert!(
        body["estimated_monthly"].is_number(),
        "must have estimated_monthly: {body}"
    );
    assert!(
        body["estimated_semester"].is_number(),
        "must have estimated_semester: {body}"
    );
    assert!(
        body["todo_items"].is_array(),
        "must have todo_items: {body}"
    );
}

#[tokio::test]
async fn dashboard_rejects_unauthenticated() {
    let base = start_test_server().await;
    let client = Client::new();

    let resp = client
        .get(format!("{base}/api/v1/dashboard"))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 401);
}

// ── GET /api/v1/alerts ──

#[tokio::test]
async fn list_alerts_returns_paginated_list() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_, token, _) = create_test_user(&base).await;

    let resp = client
        .get(format!("{base}/api/v1/alerts"))
        .bearer_auth(&token)
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 200, "list alerts should succeed");

    let body: Value = resp.json().await.expect("invalid json");
    assert!(body["total"].is_number(), "must have total: {body}");
    assert!(body["items"].is_array(), "must have items: {body}");
}

#[tokio::test]
async fn list_alerts_rejects_unauthenticated() {
    let base = start_test_server().await;
    let client = Client::new();

    let resp = client
        .get(format!("{base}/api/v1/alerts"))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 401);
}

// ── POST /api/v1/alerts/preferences ──

#[tokio::test]
async fn upsert_alert_preferences_returns_subscriptions() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_, token, _) = create_test_user(&base).await;

    // Need an active program to subscribe to
    let programs_resp = client
        .get(format!("{base}/api/v1/programs"))
        .send()
        .await
        .expect("programs request failed");
    let programs_body: Value = programs_resp.json().await.expect("invalid json");
    let items = programs_body["items"]
        .as_array()
        .expect("items must be array");

    // Filter to active programs
    let active = items
        .iter()
        .find(|p| p["is_active"].as_bool().unwrap_or(false));

    if active.is_none() {
        // No active programs; the handler returns 404 — just verify that
        let fake_id = Uuid::new_v4();
        let resp = client
            .post(format!("{base}/api/v1/alerts/preferences"))
            .bearer_auth(&token)
            .json(&json!({ "program_id": fake_id, "enabled": true }))
            .send()
            .await
            .expect("request failed");
        assert_eq!(resp.status(), 404);
        return;
    }

    let program_id = active.unwrap()["id"]
        .as_str()
        .expect("program must have id");

    let resp = client
        .post(format!("{base}/api/v1/alerts/preferences"))
        .bearer_auth(&token)
        .json(&json!({ "program_id": program_id, "enabled": true }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 200, "upsert preferences should succeed");

    let body: Value = resp.json().await.expect("invalid json");
    assert!(
        body["subscriptions"].is_array(),
        "must have subscriptions: {body}"
    );
    assert_eq!(body["updated"]["enabled"], true);
}

#[tokio::test]
async fn upsert_alert_preferences_rejects_unauthenticated() {
    let base = start_test_server().await;
    let client = Client::new();
    let fake_id = Uuid::new_v4();

    let resp = client
        .post(format!("{base}/api/v1/alerts/preferences"))
        .json(&json!({ "program_id": fake_id, "enabled": true }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 401);
}

// ── GET /api/v1/my/applications ──

#[tokio::test]
async fn list_applications_returns_list() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_, token, _) = create_test_user(&base).await;

    let resp = client
        .get(format!("{base}/api/v1/my/applications"))
        .bearer_auth(&token)
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 200, "list applications should succeed");

    let body: Value = resp.json().await.expect("invalid json");
    assert!(body["total"].is_number(), "must have total: {body}");
    assert!(body["items"].is_array(), "must have items: {body}");
}

#[tokio::test]
async fn list_applications_rejects_unauthenticated() {
    let base = start_test_server().await;
    let client = Client::new();

    let resp = client
        .get(format!("{base}/api/v1/my/applications"))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 401);
}

// ── PUT /api/v1/my/applications/{id} ──

#[tokio::test]
async fn update_application_works() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_, token, _) = create_test_user(&base).await;

    let programs_resp = client
        .get(format!("{base}/api/v1/programs"))
        .send()
        .await
        .expect("programs request failed");
    let programs_body: Value = programs_resp.json().await.expect("invalid json");
    let items = programs_body["items"]
        .as_array()
        .expect("items must be array");

    if items.is_empty() {
        return;
    }

    let program_id = items[0]["id"].as_str().expect("program must have id");

    // First set an initial state so the row exists
    let _ = client
        .post(format!("{base}/api/v1/programs/{program_id}/state"))
        .bearer_auth(&token)
        .json(&json!({ "state": "interested" }))
        .send()
        .await
        .expect("state setup failed");

    // Now update via PUT /my/applications/{id}
    let resp = client
        .put(format!("{base}/api/v1/my/applications/{program_id}"))
        .bearer_auth(&token)
        .json(&json!({ "status": "applying", "memo": "preparing docs" }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 200, "update application should succeed");

    let body: Value = resp.json().await.expect("invalid json");
    assert_eq!(body["status"], "applying", "status must be updated");
}

#[tokio::test]
async fn update_application_rejects_invalid_status() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_, token, _) = create_test_user(&base).await;
    let fake_id = Uuid::new_v4();

    let resp = client
        .put(format!("{base}/api/v1/my/applications/{fake_id}"))
        .bearer_auth(&token)
        .json(&json!({ "status": "not_a_real_status" }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn update_application_rejects_unauthenticated() {
    let base = start_test_server().await;
    let client = Client::new();
    let fake_id = Uuid::new_v4();

    let resp = client
        .put(format!("{base}/api/v1/my/applications/{fake_id}"))
        .json(&json!({ "status": "applying" }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 401);
}

// ── GET /api/v1/my/saved ──

#[tokio::test]
async fn get_saved_returns_bookmarks() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_, token, _) = create_test_user(&base).await;

    let resp = client
        .get(format!("{base}/api/v1/my/saved"))
        .bearer_auth(&token)
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 200, "get saved should succeed");

    let body: Value = resp.json().await.expect("invalid json");
    assert!(body["total"].is_number(), "must have total: {body}");
    assert!(body["items"].is_array(), "must have items: {body}");
}

#[tokio::test]
async fn get_saved_rejects_unauthenticated() {
    let base = start_test_server().await;
    let client = Client::new();

    let resp = client
        .get(format!("{base}/api/v1/my/saved"))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 401);
}

// ── POST /api/v1/push/register ──

#[tokio::test]
async fn register_push_token_succeeds() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_, token, _) = create_test_user(&base).await;

    let resp = client
        .post(format!("{base}/api/v1/push/register"))
        .bearer_auth(&token)
        .json(&json!({
            "token": format!("ExponentPushToken[test-{}]", Uuid::new_v4()),
            "platform": "ios"
        }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 200, "push register should succeed");

    let body: Value = resp.json().await.expect("invalid json");
    assert_eq!(body["success"], true);
}

#[tokio::test]
async fn register_push_token_rejects_invalid_platform() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_, token, _) = create_test_user(&base).await;

    let resp = client
        .post(format!("{base}/api/v1/push/register"))
        .bearer_auth(&token)
        .json(&json!({
            "token": "some-token",
            "platform": "windows"
        }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn register_push_token_rejects_unauthenticated() {
    let base = start_test_server().await;
    let client = Client::new();

    let resp = client
        .post(format!("{base}/api/v1/push/register"))
        .json(&json!({ "token": "some-token", "platform": "ios" }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 401);
}

// ── DELETE /api/v1/push/register ──

#[tokio::test]
async fn unregister_push_token_succeeds() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_, token, _) = create_test_user(&base).await;

    // Register first so there's something to delete
    let _ = client
        .post(format!("{base}/api/v1/push/register"))
        .bearer_auth(&token)
        .json(&json!({
            "token": format!("ExponentPushToken[del-{}]", Uuid::new_v4()),
            "platform": "android"
        }))
        .send()
        .await
        .expect("register failed");

    let resp = client
        .delete(format!("{base}/api/v1/push/register"))
        .bearer_auth(&token)
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 200, "push unregister should succeed");

    let body: Value = resp.json().await.expect("invalid json");
    assert_eq!(body["success"], true);
}

#[tokio::test]
async fn unregister_push_token_rejects_unauthenticated() {
    let base = start_test_server().await;
    let client = Client::new();

    let resp = client
        .delete(format!("{base}/api/v1/push/register"))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 401);
}

// ── GET /api/v1/admin/stats ──

#[tokio::test]
async fn admin_stats_returns_counts() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_, admin_token) = create_test_admin(&base).await;

    let resp = client
        .get(format!("{base}/api/v1/admin/stats"))
        .bearer_auth(&admin_token)
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 200, "admin stats should succeed");

    let body: Value = resp.json().await.expect("invalid json");
    assert!(
        body["total_programs"].is_number(),
        "must have total_programs: {body}"
    );
    assert!(
        body["active_programs"].is_number(),
        "must have active_programs: {body}"
    );
    assert!(
        body["total_users"].is_number(),
        "must have total_users: {body}"
    );
}

#[tokio::test]
async fn admin_stats_rejects_regular_user() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_, token, _) = create_test_user(&base).await;

    let resp = client
        .get(format!("{base}/api/v1/admin/stats"))
        .bearer_auth(&token)
        .send()
        .await
        .expect("request failed");

    assert_eq!(
        resp.status(),
        403,
        "regular user must not access admin stats"
    );
}

#[tokio::test]
async fn admin_stats_rejects_unauthenticated() {
    let base = start_test_server().await;
    let client = Client::new();

    let resp = client
        .get(format!("{base}/api/v1/admin/stats"))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 401);
}

// ── GET /api/v1/admin/programs ──

#[tokio::test]
async fn admin_list_programs_returns_list() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_, admin_token) = create_test_admin(&base).await;

    let resp = client
        .get(format!("{base}/api/v1/admin/programs"))
        .bearer_auth(&admin_token)
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 200, "admin list programs should succeed");

    let body: Value = resp.json().await.expect("invalid json");
    assert!(body["total"].is_number(), "must have total: {body}");
    assert!(body["items"].is_array(), "must have items: {body}");
}

#[tokio::test]
async fn admin_list_programs_rejects_regular_user() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_, token, _) = create_test_user(&base).await;

    let resp = client
        .get(format!("{base}/api/v1/admin/programs"))
        .bearer_auth(&token)
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 403);
}

// ── POST /api/v1/admin/sync ──

#[tokio::test]
async fn admin_sync_returns_started() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_, admin_token) = create_test_admin(&base).await;

    let resp = client
        .post(format!("{base}/api/v1/admin/sync"))
        .bearer_auth(&admin_token)
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 200, "admin sync should succeed");

    let body: Value = resp.json().await.expect("invalid json");
    assert_eq!(
        body["status"], "sync_started",
        "status must be sync_started: {body}"
    );
}

#[tokio::test]
async fn admin_sync_rejects_regular_user() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_, token, _) = create_test_user(&base).await;

    let resp = client
        .post(format!("{base}/api/v1/admin/sync"))
        .bearer_auth(&token)
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 403);
}

#[tokio::test]
async fn admin_sync_rejects_unauthenticated() {
    let base = start_test_server().await;
    let client = Client::new();

    let resp = client
        .post(format!("{base}/api/v1/admin/sync"))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 401);
}

// ── Stack Check tests ──────────────────────────────────────────────────────

#[tokio::test]
async fn stack_check_returns_results_for_valid_ids() {
    let base = start_test_server().await;
    let client = Client::new();

    // Get two program IDs from the listing
    let resp = client
        .get(format!("{base}/api/v1/programs"))
        .send()
        .await
        .expect("request failed");
    let body: Value = resp.json().await.expect("json");
    let items = body["items"].as_array().expect("items");
    if items.len() < 2 {
        return; // not enough seed data
    }
    let id1 = items[0]["id"].as_str().unwrap();
    let id2 = items[1]["id"].as_str().unwrap();

    let resp = client
        .post(format!("{base}/api/v1/stack-check"))
        .json(&json!({ "program_ids": [id1, id2] }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 200);
    let body: Value = resp.json().await.expect("json");
    assert!(body["pairs"].is_array());
    assert!(body["all_stackable"].is_boolean());
}

#[tokio::test]
async fn stack_check_rejects_single_id() {
    let base = start_test_server().await;
    let client = Client::new();

    let resp = client
        .post(format!("{base}/api/v1/stack-check"))
        .json(&json!({ "program_ids": ["00000000-0000-0000-0000-000000000001"] }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn stack_check_rejects_too_many_ids() {
    let base = start_test_server().await;
    let client = Client::new();

    let ids: Vec<String> = (0..21)
        .map(|i| format!("00000000-0000-0000-0000-{:012}", i))
        .collect();

    let resp = client
        .post(format!("{base}/api/v1/stack-check"))
        .json(&json!({ "program_ids": ids }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 400);
}

// ── Document Vault tests ───────────────────────────────────────────────────

#[tokio::test]
async fn documents_list_empty_for_new_user() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_uid, token, _refresh) = create_test_user(&base).await;

    let resp = client
        .get(format!("{base}/api/v1/documents"))
        .bearer_auth(&token)
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 200);
    let body: Value = resp.json().await.expect("json");
    assert_eq!(body["total"], 0);
    assert!(body["items"].as_array().unwrap().is_empty());
}

#[tokio::test]
async fn documents_upload_download_delete_cycle() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_uid, token, _refresh) = create_test_user(&base).await;

    // Simulate encrypted data: 256 bytes of zeros, base64 encoded
    let fake_encrypted = vec![0u8; 256];
    use base64::Engine;
    let data_b64 = base64::engine::general_purpose::STANDARD.encode(&fake_encrypted);

    // Upload
    let upload_resp = client
        .post(format!("{base}/api/v1/documents"))
        .bearer_auth(&token)
        .json(&json!({
            "document_type": "income_cert",
            "file_name": "test_doc.pdf",
            "file_size_bytes": 256,
            "encrypted_data_base64": data_b64,
            "iv_hex": "00112233445566778899aabbccddeeff",
        }))
        .send()
        .await
        .expect("upload failed");

    assert_eq!(upload_resp.status(), 200);
    let upload_body: Value = upload_resp.json().await.expect("json");
    let doc_id = upload_body["id"].as_str().expect("must have id");

    // Download
    let dl_resp = client
        .get(format!("{base}/api/v1/documents/{doc_id}/download"))
        .bearer_auth(&token)
        .send()
        .await
        .expect("download failed");

    assert_eq!(dl_resp.status(), 200);
    let dl_body: Value = dl_resp.json().await.expect("json");
    assert_eq!(dl_body["encrypted_data_base64"], data_b64);
    assert_eq!(dl_body["iv_hex"], "00112233445566778899aabbccddeeff");

    // Delete
    let del_resp = client
        .delete(format!("{base}/api/v1/documents/{doc_id}"))
        .bearer_auth(&token)
        .send()
        .await
        .expect("delete failed");

    assert_eq!(del_resp.status(), 200);

    // Verify deleted
    let dl2_resp = client
        .get(format!("{base}/api/v1/documents/{doc_id}/download"))
        .bearer_auth(&token)
        .send()
        .await
        .expect("download after delete failed");

    assert_eq!(dl2_resp.status(), 404);
}

#[tokio::test]
async fn documents_upload_rejects_size_mismatch() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_uid, token, _refresh) = create_test_user(&base).await;

    let fake_encrypted = vec![0u8; 256];
    use base64::Engine;
    let data_b64 = base64::engine::general_purpose::STANDARD.encode(&fake_encrypted);

    // Declare wrong size (100 vs actual 256)
    let resp = client
        .post(format!("{base}/api/v1/documents"))
        .bearer_auth(&token)
        .json(&json!({
            "document_type": "income_cert",
            "file_name": "test.pdf",
            "file_size_bytes": 100,
            "encrypted_data_base64": data_b64,
            "iv_hex": "00112233445566778899aabbccddeeff",
        }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 400);
    let body: Value = resp.json().await.expect("json");
    assert!(body["error"].as_str().unwrap().contains("does not match"));
}

#[tokio::test]
async fn documents_upload_rejects_invalid_doc_type() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_uid, token, _refresh) = create_test_user(&base).await;

    use base64::Engine;
    let data_b64 = base64::engine::general_purpose::STANDARD.encode(&[0u8; 16]);

    let resp = client
        .post(format!("{base}/api/v1/documents"))
        .bearer_auth(&token)
        .json(&json!({
            "document_type": "invalid_type",
            "file_name": "test.pdf",
            "file_size_bytes": 16,
            "encrypted_data_base64": data_b64,
            "iv_hex": "00112233445566778899aabbccddeeff",
        }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn documents_upload_rejects_bad_iv() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_uid, token, _refresh) = create_test_user(&base).await;

    use base64::Engine;
    let data_b64 = base64::engine::general_purpose::STANDARD.encode(&[0u8; 16]);

    let resp = client
        .post(format!("{base}/api/v1/documents"))
        .bearer_auth(&token)
        .json(&json!({
            "document_type": "income_cert",
            "file_name": "test.pdf",
            "file_size_bytes": 16,
            "encrypted_data_base64": data_b64,
            "iv_hex": "short",
        }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn documents_rejects_unauthenticated() {
    let base = start_test_server().await;
    let client = Client::new();

    let resp = client
        .get(format!("{base}/api/v1/documents"))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 401);
}

#[tokio::test]
async fn documents_download_rejects_other_user() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_uid1, token1, _) = create_test_user(&base).await;
    let (_uid2, token2, _) = create_test_user(&base).await;

    // User1 uploads
    use base64::Engine;
    let data_b64 = base64::engine::general_purpose::STANDARD.encode(&[0u8; 32]);
    let upload_resp = client
        .post(format!("{base}/api/v1/documents"))
        .bearer_auth(&token1)
        .json(&json!({
            "document_type": "id_card",
            "file_name": "my_id.pdf",
            "file_size_bytes": 32,
            "encrypted_data_base64": data_b64,
            "iv_hex": "aabbccddeeff00112233445566778899",
        }))
        .send()
        .await
        .expect("upload failed");
    let doc_id = upload_resp.json::<Value>().await.unwrap()["id"]
        .as_str()
        .unwrap()
        .to_string();

    // User2 tries to download — must fail
    let resp = client
        .get(format!("{base}/api/v1/documents/{doc_id}/download"))
        .bearer_auth(&token2)
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 404);
}

// ── Payment tests ──────────────────────────────────────────────────────────

#[tokio::test]
async fn payment_verify_rejects_empty_payment_id() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_uid, token, _) = create_test_user(&base).await;

    let resp = client
        .post(format!("{base}/api/v1/payments/verify"))
        .bearer_auth(&token)
        .json(&json!({
            "payment_id": "",
            "amount": 4900,
            "product_type": "premium_monthly",
        }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn payment_verify_rejects_wrong_amount() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_uid, token, _) = create_test_user(&base).await;

    let resp = client
        .post(format!("{base}/api/v1/payments/verify"))
        .bearer_auth(&token)
        .json(&json!({
            "payment_id": "test_pay_999",
            "amount": 1,
            "product_type": "premium_monthly",
        }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn payment_verify_rejects_unknown_product() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_uid, token, _) = create_test_user(&base).await;

    let resp = client
        .post(format!("{base}/api/v1/payments/verify"))
        .bearer_auth(&token)
        .json(&json!({
            "payment_id": "test_pay_000",
            "amount": 4900,
            "product_type": "nonexistent_plan",
        }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 400);
}

#[tokio::test]
async fn payment_status_returns_inactive_for_new_user() {
    let base = start_test_server().await;
    let client = Client::new();
    let (_uid, token, _) = create_test_user(&base).await;

    let resp = client
        .get(format!("{base}/api/v1/payments/status"))
        .bearer_auth(&token)
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 200);
    let body: Value = resp.json().await.expect("json");
    assert_eq!(body["active"], false);
}

#[tokio::test]
async fn payment_rejects_unauthenticated() {
    let base = start_test_server().await;
    let client = Client::new();

    let resp = client
        .post(format!("{base}/api/v1/payments/verify"))
        .json(&json!({
            "payment_id": "test",
            "amount": 4900,
            "product_type": "premium_monthly",
        }))
        .send()
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 401);
}
