-- Server-side document vault storage
-- Encrypted documents are stored as bytea (client encrypts before upload)

CREATE TABLE IF NOT EXISTS user_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,        -- 'resident_cert', 'income_cert', 'enrollment_cert', etc.
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    encrypted_data BYTEA NOT NULL,      -- AES-256-CBC encrypted by client before upload
    iv_hex TEXT NOT NULL,               -- IV used for encryption (hex encoded)
    issued_at TIMESTAMPTZ,              -- document issue date
    expires_at TIMESTAMPTZ,             -- document expiry date
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_documents_user_id ON user_documents(user_id);
CREATE INDEX idx_user_documents_type ON user_documents(user_id, document_type);

-- RLS: users can only access their own documents
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_documents_select ON user_documents
    FOR SELECT USING (
        user_id = current_setting('app.current_user_id', true)::UUID
    );

CREATE POLICY user_documents_insert ON user_documents
    FOR INSERT WITH CHECK (
        user_id = current_setting('app.current_user_id', true)::UUID
    );

CREATE POLICY user_documents_delete ON user_documents
    FOR DELETE USING (
        user_id = current_setting('app.current_user_id', true)::UUID
    );

-- Service role bypass
CREATE POLICY user_documents_service ON user_documents
    FOR ALL USING (
        current_setting('app.current_user_id', true) IS NULL
        OR current_setting('role', true) = 'service_role'
    );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_user_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_documents_updated_at
    BEFORE UPDATE ON user_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_user_documents_updated_at();
