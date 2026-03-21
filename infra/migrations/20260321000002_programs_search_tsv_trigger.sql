-- Migration: programs_search_tsv_trigger
-- Adds a trigger that automatically populates the search_tsv column on every
-- INSERT or UPDATE of the programs table.
--
-- The tsvector combines:
--   title       weight A (highest relevance)
--   provider_name weight B
--   summary     weight C
--
-- Language: 'simple' avoids Korean stemming issues while still enabling
-- tokenisation.  Switch to a Korean-aware dictionary (e.g. pg_mecab) later
-- if the stack supports it.

CREATE OR REPLACE FUNCTION programs_search_tsv_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.search_tsv :=
        setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.provider_name, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(NEW.summary, '')), 'C');
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it was added by an earlier migration attempt
DROP TRIGGER IF EXISTS trig_programs_search_tsv ON programs;

CREATE TRIGGER trig_programs_search_tsv
BEFORE INSERT OR UPDATE OF title, provider_name, summary
ON programs
FOR EACH ROW
EXECUTE FUNCTION programs_search_tsv_update();

-- Back-fill existing rows that currently have search_tsv = NULL
UPDATE programs
SET search_tsv =
    setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(provider_name, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(summary, '')), 'C')
WHERE search_tsv IS NULL;
