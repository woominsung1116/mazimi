-- Remove manually seeded corporate_benefit dummy data
-- These will be replaced by automated scraper ingestion
DELETE FROM programs WHERE program_type = 'corporate_benefit' AND source_type = 'manual';
