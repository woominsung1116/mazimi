-- Initial schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT,
    phone TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'kakao',
    auth_provider_id TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    birth_year INT,
    region_code TEXT,
    city_code TEXT,
    school_name TEXT,
    school_year INT,
    enrollment_status TEXT,
    employment_status TEXT,
    major_group TEXT,
    income_bracket INT,
    kosaf_support_bracket INT,
    housing_type TEXT,
    household_size INT,
    profile_version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_type TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT,
    title TEXT NOT NULL,
    summary TEXT,
    provider_name TEXT,
    official_url TEXT,
    program_status TEXT NOT NULL DEFAULT 'active',
    application_start_at TIMESTAMPTZ,
    application_end_at TIMESTAMPTZ,
    benefit_amount_monthly INT,
    benefit_amount_semester INT,
    benefit_amount_once INT,
    region_scope JSONB DEFAULT '[]',
    school_scope JSONB DEFAULT '[]',
    tags JSONB DEFAULT '[]',
    raw_payload JSONB,
    normalized_payload JSONB,
    search_tsv TSVECTOR,
    min_age INT,
    max_age INT,
    regions TEXT[] DEFAULT '{}',
    deadline_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_programs_type ON programs(program_type);
CREATE INDEX idx_programs_status ON programs(program_status);
CREATE INDEX idx_programs_deadline ON programs(deadline_at);
CREATE INDEX idx_programs_active ON programs(is_active);
CREATE INDEX idx_programs_regions ON programs USING GIN(regions);
CREATE INDEX idx_programs_search ON programs USING GIN(search_tsv);
CREATE INDEX idx_programs_age ON programs(min_age, max_age);
