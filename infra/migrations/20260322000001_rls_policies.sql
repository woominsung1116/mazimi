-- RLS (Row Level Security) policies for all Majimi tables.
--
-- Auth model:
--   - The Rust API server connects as the 'wello' PostgreSQL role (or postgres
--     in local dev). It sets a session-local claim before every query:
--       SET LOCAL app.current_user_id = '<uuid>';
--     This lets RLS policies read the caller's identity without relying on the
--     Supabase JWT flow.
--   - Service-level bypass: any query running as the 'wello' DB user (the API
--     server connection role) or 'postgres' (local dev superuser) skips user-
--     level restrictions automatically via the BYPASSRLS attribute OR via the
--     explicit bypass policy added to each table.
--   - End-user identity is read from current_setting('app.current_user_id', true).
--     The second argument (true) makes the function return NULL instead of
--     raising an error when the setting is absent (e.g. during migrations).
--
-- Policy naming convention:
--   "<table>_<operation>_<who>"
--   e.g. "users_select_own", "programs_select_public", "users_all_service"

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: current authenticated user UUID from session-local GUC.
-- Returns NULL when not set (migration context, service role, etc.).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION app_user_id() RETURNS UUID
    LANGUAGE sql STABLE SECURITY DEFINER AS
$$
    SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: true when the current DB role is the API server or local superuser.
-- This is the lightweight "service bypass" check used inside policies.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_service_role() RETURNS BOOLEAN
    LANGUAGE sql STABLE SECURITY DEFINER AS
$$
    SELECT current_user IN ('wello', 'postgres');
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. users
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- Service role: full access (API server writes, reads, upserts any user row).
CREATE POLICY "users_all_service" ON users
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

-- Users: read only their own row.
CREATE POLICY "users_select_own" ON users
    FOR SELECT
    USING (id = app_user_id());

-- Users: update only their own row.
CREATE POLICY "users_update_own" ON users
    FOR UPDATE
    USING (id = app_user_id())
    WITH CHECK (id = app_user_id());

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. user_profiles
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles_all_service" ON user_profiles
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

-- Users: read own profile.
CREATE POLICY "user_profiles_select_own" ON user_profiles
    FOR SELECT
    USING (user_id = app_user_id());

-- Users: insert only for their own user_id.
CREATE POLICY "user_profiles_insert_own" ON user_profiles
    FOR INSERT
    WITH CHECK (user_id = app_user_id());

-- Users: update only their own profile.
CREATE POLICY "user_profiles_update_own" ON user_profiles
    FOR UPDATE
    USING (user_id = app_user_id())
    WITH CHECK (user_id = app_user_id());

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. programs  (public catalogue — read-only for end-users)
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs FORCE ROW LEVEL SECURITY;

CREATE POLICY "programs_all_service" ON programs
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

-- Anyone (including anonymous / unauthenticated reads) can read active programs.
-- The API layer enforces auth at the route level; here we keep data open so that
-- the recommendation engine and public search always work.
CREATE POLICY "programs_select_public" ON programs
    FOR SELECT
    USING (true);

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. user_bookmarks
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bookmarks FORCE ROW LEVEL SECURITY;

CREATE POLICY "user_bookmarks_all_service" ON user_bookmarks
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

CREATE POLICY "user_bookmarks_select_own" ON user_bookmarks
    FOR SELECT
    USING (user_id = app_user_id());

CREATE POLICY "user_bookmarks_insert_own" ON user_bookmarks
    FOR INSERT
    WITH CHECK (user_id = app_user_id());

CREATE POLICY "user_bookmarks_update_own" ON user_bookmarks
    FOR UPDATE
    USING (user_id = app_user_id())
    WITH CHECK (user_id = app_user_id());

CREATE POLICY "user_bookmarks_delete_own" ON user_bookmarks
    FOR DELETE
    USING (user_id = app_user_id());

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. user_program_states
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE user_program_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_program_states FORCE ROW LEVEL SECURITY;

CREATE POLICY "user_program_states_all_service" ON user_program_states
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

CREATE POLICY "user_program_states_select_own" ON user_program_states
    FOR SELECT
    USING (user_id = app_user_id());

CREATE POLICY "user_program_states_insert_own" ON user_program_states
    FOR INSERT
    WITH CHECK (user_id = app_user_id());

CREATE POLICY "user_program_states_update_own" ON user_program_states
    FOR UPDATE
    USING (user_id = app_user_id())
    WITH CHECK (user_id = app_user_id());

CREATE POLICY "user_program_states_delete_own" ON user_program_states
    FOR DELETE
    USING (user_id = app_user_id());

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. user_program_state_history  (append-only audit log)
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE user_program_state_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_program_state_history FORCE ROW LEVEL SECURITY;

CREATE POLICY "state_history_all_service" ON user_program_state_history
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

-- Users can read their own history.
CREATE POLICY "state_history_select_own" ON user_program_state_history
    FOR SELECT
    USING (user_id = app_user_id());

-- History rows are written by the API server (service role) via trigger or
-- explicit INSERT; direct end-user INSERT is blocked (no insert policy here).

-- ═════════════════════════════════════════════════════════════════════════════
-- 7. alert_subscriptions
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_subscriptions FORCE ROW LEVEL SECURITY;

CREATE POLICY "alert_subscriptions_all_service" ON alert_subscriptions
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

CREATE POLICY "alert_subscriptions_select_own" ON alert_subscriptions
    FOR SELECT
    USING (user_id = app_user_id());

CREATE POLICY "alert_subscriptions_insert_own" ON alert_subscriptions
    FOR INSERT
    WITH CHECK (user_id = app_user_id());

CREATE POLICY "alert_subscriptions_update_own" ON alert_subscriptions
    FOR UPDATE
    USING (user_id = app_user_id())
    WITH CHECK (user_id = app_user_id());

CREATE POLICY "alert_subscriptions_delete_own" ON alert_subscriptions
    FOR DELETE
    USING (user_id = app_user_id());

-- ═════════════════════════════════════════════════════════════════════════════
-- 8. alert_deliveries  (written only by the worker/service, read by owner)
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE alert_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_deliveries FORCE ROW LEVEL SECURITY;

-- Service role inserts delivery records; end-users never write here.
CREATE POLICY "alert_deliveries_all_service" ON alert_deliveries
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

-- Users can read their own delivery history (for in-app notification centre).
CREATE POLICY "alert_deliveries_select_own" ON alert_deliveries
    FOR SELECT
    USING (user_id = app_user_id());

-- ═════════════════════════════════════════════════════════════════════════════
-- 9. eligibility_rules  (admin-managed reference data)
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE eligibility_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE eligibility_rules FORCE ROW LEVEL SECURITY;

CREATE POLICY "eligibility_rules_all_service" ON eligibility_rules
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

-- Public read: the rule engine and any authenticated client can read rules.
CREATE POLICY "eligibility_rules_select_public" ON eligibility_rules
    FOR SELECT
    USING (true);

-- ═════════════════════════════════════════════════════════════════════════════
-- 10. program_documents  (admin-managed reference data)
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE program_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_documents FORCE ROW LEVEL SECURITY;

CREATE POLICY "program_documents_all_service" ON program_documents
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

-- Public read: document checklists are visible to all users.
CREATE POLICY "program_documents_select_public" ON program_documents
    FOR SELECT
    USING (true);

-- ═════════════════════════════════════════════════════════════════════════════
-- 11. notification_preferences
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences FORCE ROW LEVEL SECURITY;

CREATE POLICY "notif_prefs_all_service" ON notification_preferences
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

CREATE POLICY "notif_prefs_select_own" ON notification_preferences
    FOR SELECT
    USING (user_id = app_user_id());

CREATE POLICY "notif_prefs_insert_own" ON notification_preferences
    FOR INSERT
    WITH CHECK (user_id = app_user_id());

CREATE POLICY "notif_prefs_update_own" ON notification_preferences
    FOR UPDATE
    USING (user_id = app_user_id())
    WITH CHECK (user_id = app_user_id());

CREATE POLICY "notif_prefs_delete_own" ON notification_preferences
    FOR DELETE
    USING (user_id = app_user_id());

-- ═════════════════════════════════════════════════════════════════════════════
-- 12. push_tokens
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens FORCE ROW LEVEL SECURITY;

CREATE POLICY "push_tokens_all_service" ON push_tokens
    FOR ALL
    USING (is_service_role())
    WITH CHECK (is_service_role());

CREATE POLICY "push_tokens_select_own" ON push_tokens
    FOR SELECT
    USING (user_id = app_user_id());

CREATE POLICY "push_tokens_insert_own" ON push_tokens
    FOR INSERT
    WITH CHECK (user_id = app_user_id());

CREATE POLICY "push_tokens_update_own" ON push_tokens
    FOR UPDATE
    USING (user_id = app_user_id())
    WITH CHECK (user_id = app_user_id());

CREATE POLICY "push_tokens_delete_own" ON push_tokens
    FOR DELETE
    USING (user_id = app_user_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- Verify: list all RLS-enabled tables (should be 12 rows after migration).
-- Run manually to confirm:
--   SELECT tablename, rowsecurity, forcerowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public' AND rowsecurity = true
--   ORDER BY tablename;
-- ─────────────────────────────────────────────────────────────────────────────
