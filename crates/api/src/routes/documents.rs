use axum::{extract::State, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{auth::AuthUser, AppState};

// ── Request/Response types ──

#[derive(Debug, Deserialize)]
pub struct UploadDocumentRequest {
    pub document_type: String,
    pub file_name: String,
    pub file_size_bytes: i64,
    pub mime_type: Option<String>,
    /// Base64-encoded AES-256-CBC encrypted data (client encrypts before upload)
    pub encrypted_data_base64: String,
    /// Hex-encoded IV used for encryption
    pub iv_hex: String,
    pub issued_at: Option<String>,
    pub expires_at: Option<String>,
}

// ── Helpers ──

const VALID_DOC_TYPES: &[&str] = &[
    "resident_cert",
    "income_cert",
    "enrollment_cert",
    "grade_cert",
    "bank_statement",
    "id_card",
    "family_cert",
    "tax_cert",
    "employment_cert",
    "other",
];

const MAX_FILE_SIZE: i64 = 10 * 1024 * 1024; // 10 MB

fn err_bad(msg: &str) -> (StatusCode, Json<Value>) {
    (StatusCode::BAD_REQUEST, Json(json!({ "error": msg })))
}

fn err_internal(msg: String) -> (StatusCode, Json<Value>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": msg })),
    )
}

// ── Handlers ──

/// GET /api/v1/documents
///
/// List all documents for the authenticated user (metadata only, no file data).
pub async fn list_documents(
    auth_user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let rows = sqlx::query_as::<_, (
        uuid::Uuid,
        String,
        String,
        i64,
        String,
        String,
        Option<chrono::DateTime<chrono::Utc>>,
        Option<chrono::DateTime<chrono::Utc>>,
        chrono::DateTime<chrono::Utc>,
    )>(
        r#"
        SELECT id, document_type, file_name, file_size_bytes, mime_type, iv_hex,
               issued_at, expires_at, created_at
        FROM user_documents
        WHERE user_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(auth_user.id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| err_internal(format!("DB query failed: {e}")))?;

    let docs: Vec<Value> = rows
        .into_iter()
        .map(|r| {
            json!({
                "id": r.0.to_string(),
                "document_type": r.1,
                "file_name": r.2,
                "file_size_bytes": r.3,
                "mime_type": r.4,
                "iv_hex": r.5,
                "issued_at": r.6.map(|d| d.to_rfc3339()),
                "expires_at": r.7.map(|d| d.to_rfc3339()),
                "created_at": r.8.to_rfc3339(),
            })
        })
        .collect();

    Ok(Json(json!({ "items": docs, "total": docs.len() })))
}

/// POST /api/v1/documents
///
/// Upload an encrypted document. Client encrypts with AES-256-CBC before sending.
/// Server stores the encrypted blob — never sees plaintext.
pub async fn upload_document(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Json(body): Json<UploadDocumentRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Validate document type
    if !VALID_DOC_TYPES.contains(&body.document_type.as_str()) {
        return Err(err_bad("Invalid document_type"));
    }

    // Validate file size
    if body.file_size_bytes <= 0 || body.file_size_bytes > MAX_FILE_SIZE {
        return Err(err_bad("file_size_bytes must be between 1 and 10MB"));
    }

    // Validate IV hex (32 hex chars = 16 bytes)
    if body.iv_hex.len() != 32 || !body.iv_hex.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(err_bad("iv_hex must be 32 hex characters"));
    }

    // Validate file name length
    if body.file_name.is_empty() || body.file_name.len() > 255 {
        return Err(err_bad("file_name must be 1-255 characters"));
    }

    // Decode base64 encrypted data
    use base64::Engine;
    let encrypted_bytes = base64::engine::general_purpose::STANDARD
        .decode(&body.encrypted_data_base64)
        .map_err(|_| err_bad("Invalid base64 in encrypted_data_base64"))?;

    let mime = body
        .mime_type
        .unwrap_or_else(|| "application/octet-stream".to_string());

    let issued_at: Option<chrono::DateTime<chrono::Utc>> = body
        .issued_at
        .as_deref()
        .and_then(|s| s.parse().ok());

    let expires_at: Option<chrono::DateTime<chrono::Utc>> = body
        .expires_at
        .as_deref()
        .and_then(|s| s.parse().ok());

    let row = sqlx::query_as::<_, (uuid::Uuid, chrono::DateTime<chrono::Utc>)>(
        r#"
        INSERT INTO user_documents
            (user_id, document_type, file_name, file_size_bytes, mime_type,
             encrypted_data, iv_hex, issued_at, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, created_at
        "#,
    )
    .bind(auth_user.id)
    .bind(&body.document_type)
    .bind(&body.file_name)
    .bind(body.file_size_bytes)
    .bind(&mime)
    .bind(&encrypted_bytes)
    .bind(&body.iv_hex)
    .bind(issued_at)
    .bind(expires_at)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| err_internal(format!("DB insert failed: {e}")))?;

    Ok(Json(json!({
        "id": row.0.to_string(),
        "created_at": row.1.to_rfc3339(),
    })))
}

/// GET /api/v1/documents/{id}/download
///
/// Download encrypted document data. Returns base64-encoded encrypted blob.
pub async fn download_document(
    auth_user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Path(doc_id): axum::extract::Path<uuid::Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let row = sqlx::query_as::<_, (Vec<u8>, String, String, String)>(
        r#"
        SELECT encrypted_data, iv_hex, file_name, mime_type
        FROM user_documents
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(doc_id)
    .bind(auth_user.id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| err_internal(format!("DB query failed: {e}")))?;

    let (encrypted_data, iv_hex, file_name, mime_type) = row.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Document not found" })),
        )
    })?;

    use base64::Engine;
    let data_b64 = base64::engine::general_purpose::STANDARD.encode(&encrypted_data);

    Ok(Json(json!({
        "encrypted_data_base64": data_b64,
        "iv_hex": iv_hex,
        "file_name": file_name,
        "mime_type": mime_type,
    })))
}

/// DELETE /api/v1/documents/{id}
///
/// Delete a document. Only the owner can delete.
pub async fn delete_document(
    auth_user: AuthUser,
    State(state): State<AppState>,
    axum::extract::Path(doc_id): axum::extract::Path<uuid::Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let result = sqlx::query("DELETE FROM user_documents WHERE id = $1 AND user_id = $2")
        .bind(doc_id)
        .bind(auth_user.id)
        .execute(&state.pool)
        .await
        .map_err(|e| err_internal(format!("DB delete failed: {e}")))?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Document not found" })),
        ));
    }

    Ok(Json(json!({ "success": true })))
}
