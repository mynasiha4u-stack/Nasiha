-- migration_13_signals_and_enrichment.sql
--
-- Phase 4 schema additions: signals table + ai_enriched_summary on content.
-- Built for one source (Google reviews) initially but shape generalizes to
-- yelp / instagram / whatsapp / halal_foodies / community submissions.
--
-- Idempotent. Run in Supabase SQL editor.

-- ─────────────────────────────────────────────────────────────
-- 1. signals — one row per individual external signal (review, post, mention)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id    UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  source        TEXT NOT NULL,        -- 'google' | 'yelp' | 'instagram' | 'whatsapp' | 'halal_foodies' | ...
  source_id     TEXT,                 -- per-source unique id (google review id, yelp id, ig post id, etc.)
  trust_tier    INT  NOT NULL,        -- 1 = Google/Yelp; 2 = moderate (curated community); 3 = scraped/unverified
  raw_text      TEXT NOT NULL,
  author        TEXT,                 -- display name; nullable
  review_rating NUMERIC,              -- 1-5 stars (or other if applicable); nullable for non-review signals
  review_date   TIMESTAMPTZ,
  raw_payload   JSONB,                -- full original JSON, so we can re-process later if the distillation prompt changes
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Prevents reimporting the same review twice. Some sources don't have a clean id
  -- so source_id is nullable; uniqueness only applied where both source AND source_id are set.
  CONSTRAINT signals_source_id_unique UNIQUE (source, source_id)
);

CREATE INDEX IF NOT EXISTS signals_content_idx ON signals(content_id, source);
CREATE INDEX IF NOT EXISTS signals_source_idx  ON signals(source, created_at DESC);

-- RLS: read-public (these are aggregated external signals, not private data).
-- Service role writes; everyone can read for chat retrieval.
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "signals are public read" ON signals;
CREATE POLICY "signals are public read" ON signals
  FOR SELECT TO anon, authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────
-- 2. content — add distilled enrichment + Google metadata + photos
-- ─────────────────────────────────────────────────────────────
ALTER TABLE content
  ADD COLUMN IF NOT EXISTS ai_enriched_summary JSONB,
  ADD COLUMN IF NOT EXISTS ai_enriched_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS google_place_id     TEXT,
  ADD COLUMN IF NOT EXISTS google_rating       NUMERIC,
  ADD COLUMN IF NOT EXISTS google_review_count INT,
  ADD COLUMN IF NOT EXISTS photos              TEXT[];

-- Partial unique index so the same Google place can't end up linked to two rows,
-- but we don't break existing NULLs (most rows won't have a place_id).
CREATE UNIQUE INDEX IF NOT EXISTS content_google_place_id_uidx
  ON content(google_place_id)
  WHERE google_place_id IS NOT NULL;

-- Index for finding which listings have been enriched (operational queries).
CREATE INDEX IF NOT EXISTS content_ai_enriched_idx
  ON content(ai_enriched_at DESC)
  WHERE ai_enriched_summary IS NOT NULL;
