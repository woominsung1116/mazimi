-- Migration: program_application_guide_fields
-- Adds free-text application guide columns to programs, sourced from
-- 온통청년 (youth_center) API fields that were previously ingested but
-- discarded: plcyAplyMthdCn (신청방법), sbmsnDcmntCn (제출서류),
-- srngMthdCn (심사방법). Nullable text columns — no RLS impact, no
-- backfill required for existing rows (populated on next ingestion run).

ALTER TABLE programs ADD COLUMN IF NOT EXISTS application_method TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS submission_documents TEXT;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS screening_method TEXT;
