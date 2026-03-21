-- Ingestion tracking tables

-- ── ingestion_runs ─────────────────────────────────────────────────────────
-- One row per pipeline execution (one source, one run).
CREATE TABLE ingestion_runs (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_name   TEXT        NOT NULL,
    status        TEXT        NOT NULL DEFAULT 'running',  -- running | success | failed
    started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at   TIMESTAMPTZ,
    total_fetched INT,
    total_changed INT,
    error_message TEXT
);

CREATE INDEX idx_ingestion_runs_source  ON ingestion_runs(source_name);
CREATE INDEX idx_ingestion_runs_status  ON ingestion_runs(status);
CREATE INDEX idx_ingestion_runs_started ON ingestion_runs(started_at DESC);

-- ── ingestion_items ────────────────────────────────────────────────────────
-- One row per (run, source_id): tracks per-record outcome.
CREATE TABLE ingestion_items (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id        UUID        NOT NULL REFERENCES ingestion_runs(id) ON DELETE CASCADE,
    source_id     TEXT        NOT NULL,
    program_id    UUID        REFERENCES programs(id) ON DELETE SET NULL,
    status        TEXT        NOT NULL DEFAULT 'upserted', -- upserted | unchanged | failed
    error_message TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(run_id, source_id)
);

CREATE INDEX idx_ingestion_items_run     ON ingestion_items(run_id);
CREATE INDEX idx_ingestion_items_status  ON ingestion_items(status);
CREATE INDEX idx_ingestion_items_program ON ingestion_items(program_id);

-- ── source_snapshots ───────────────────────────────────────────────────────
-- Stores the last-seen raw payload and content hash per (source, source_id).
-- Used for change detection without re-fetching the programs table.
CREATE TABLE source_snapshots (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_name   TEXT        NOT NULL,
    source_id     TEXT        NOT NULL,
    content_hash  TEXT        NOT NULL,
    raw_payload   JSONB       NOT NULL,
    fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(source_name, source_id)
);

CREATE INDEX idx_source_snapshots_source ON source_snapshots(source_name);
CREATE INDEX idx_source_snapshots_hash   ON source_snapshots(content_hash);

-- ── programs: add UNIQUE constraint for upsert ────────────────────────────
-- The pipeline does ON CONFLICT (source_type, source_id); add the constraint
-- only if it does not already exist (idempotent).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'programs_source_type_source_id_key'
    ) THEN
        ALTER TABLE programs
            ADD CONSTRAINT programs_source_type_source_id_key
            UNIQUE (source_type, source_id);
    END IF;
END
$$;
