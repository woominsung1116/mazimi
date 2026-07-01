-- Migration: fix_users_unique_constraint_deferrable
--
-- Root cause: uq_users_auth_provider_id (added in 20260321000001) was
-- created DEFERRABLE INITIALLY DEFERRED. PostgreSQL does not allow
-- `INSERT ... ON CONFLICT (auth_provider, auth_provider_id) DO UPDATE`
-- to target a deferrable unique constraint — it errors with
-- "ON CONFLICT DO UPDATE command cannot affect row a second time" /
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification" at the Postgres protocol level, because deferred
-- constraints aren't enforced at insert-time and ON CONFLICT inference
-- requires an immediately-checked unique index.
--
-- Every user upsert in this codebase (crates/api/src/routes/auth.rs
-- kakao_login + kakao_callback, crates/api/tests/api_tests.rs test
-- helpers) relies on `ON CONFLICT (auth_provider, auth_provider_id)`.
-- No code anywhere uses `SET CONSTRAINTS ... DEFERRED` or otherwise
-- depends on deferred checking of this constraint — grepped the whole
-- repo, zero hits. The DEFERRABLE clause was set in the initial squash
-- commit with no accompanying rationale and appears to be an oversight;
-- as written it made every Kakao login/signup fail with a 500 from the
-- very first request, so it cannot have been relied upon in practice.
--
-- Fix: drop and re-add the constraint as a plain (non-deferrable,
-- immediate) UNIQUE constraint. This changes only *when* Postgres
-- checks the constraint (immediately vs. end-of-transaction), not
-- what it enforces — existing rows already satisfy uniqueness because
-- the constraint has been active since 20260321000001, so this is a
-- non-destructive, data-safe redefinition. No table/column is dropped.
--
-- Re-adding as UNIQUE (not `USING INDEX`) lets Postgres build a fresh
-- backing btree index in one statement; on the current row counts this
-- is effectively instant. If this table grows large before this
-- migration runs, consider CREATE UNIQUE INDEX CONCURRENTLY + ADD
-- CONSTRAINT ... USING INDEX to avoid an exclusive table lock — not
-- needed today given data volume.

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS uq_users_auth_provider_id;

ALTER TABLE users
    ADD CONSTRAINT uq_users_auth_provider_id
        UNIQUE (auth_provider, auth_provider_id);
