-- Migration: eligibility_and_profile
-- Adds missing profile fields, eligibility_rules, program_documents tables,
-- and unique constraint on users(auth_provider, auth_provider_id).

-- ── 1. user_profiles: add missing fields ──

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS has_disability          BOOLEAN  DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_multicultural_family BOOLEAN  DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_low_income_household BOOLEAN  DEFAULT false,
    ADD COLUMN IF NOT EXISTS veteran_family          BOOLEAN  DEFAULT false,
    ADD COLUMN IF NOT EXISTS preferred_categories    TEXT[]   DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS school_type             TEXT,
    ADD COLUMN IF NOT EXISTS age_band                TEXT;

-- ── 2. eligibility_rules ──

CREATE TABLE IF NOT EXISTS eligibility_rules (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id       UUID        NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    rule_json        JSONB       NOT NULL,
    hard_filter_json JSONB,
    explain_json     JSONB,
    version          INTEGER     NOT NULL DEFAULT 1,
    created_by       TEXT,
    reviewed_by      TEXT,
    compiled_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eligibility_rules_program_id
    ON eligibility_rules(program_id);

-- ── 3. program_documents ──

CREATE TABLE IF NOT EXISTS program_documents (
    id            UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id    UUID    NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    document_name TEXT    NOT NULL,
    description   TEXT,
    is_required   BOOLEAN DEFAULT true,
    sort_order    INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_program_documents_program_id
    ON program_documents(program_id);

-- ── 4. unique constraint on users(auth_provider, auth_provider_id) ──

ALTER TABLE users
    ADD CONSTRAINT uq_users_auth_provider_id
        UNIQUE (auth_provider, auth_provider_id)
        DEFERRABLE INITIALLY DEFERRED;
