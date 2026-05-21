-- migration_15_nasiha_editorial.sql
--
-- Two pieces:
--
-- 1. Three new columns on content for Nasiha's editorial layer on top of the
--    Google-derived enrichment. These are ADMIN-EDITABLE only — the enrich
--    script never writes here. They take priority over Claude's content on
--    the public detail page.
--
-- 2. New nasiha_signature_dishes table for the curated "Top Dishes in the Bay"
--    editorial project. Schema only — public /best-dishes route is NOT built
--    yet, that lands after data starts going in.
--
-- Idempotent.

-- ─────────────────────────────────────────────────────────────
-- 1. Editorial columns on content
-- ─────────────────────────────────────────────────────────────
ALTER TABLE content
  ADD COLUMN IF NOT EXISTS nasiha_pro_tip   TEXT,
  ADD COLUMN IF NOT EXISTS nasiha_must_order TEXT[],
  ADD COLUMN IF NOT EXISTS nasiha_reviewer  TEXT;

COMMENT ON COLUMN content.nasiha_pro_tip   IS 'Editorial insider tip, written by Nas or trusted reviewer. ~1-3 sentences. NEVER touched by enrichment scripts.';
COMMENT ON COLUMN content.nasiha_must_order IS 'Authoritative list of dishes Nas recommends. Takes priority over ai_enriched_summary.known_for_dishes on the listing page.';
COMMENT ON COLUMN content.nasiha_reviewer  IS 'Attribution for the pro tip. Typically "Nas" or "Reviewed by {name}".';

-- ─────────────────────────────────────────────────────────────
-- 2. nasiha_signature_dishes — "Top Dishes in the Bay"
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nasiha_signature_dishes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_name   TEXT NOT NULL,
  content_id  UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  blurb       TEXT,
  photo_url   TEXT,
  rank        INT,
  featured    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nasiha_signature_dishes_content_idx
  ON nasiha_signature_dishes(content_id);
-- Ordering used by the future /best-dishes page: featured first, then by rank.
CREATE INDEX IF NOT EXISTS nasiha_signature_dishes_order_idx
  ON nasiha_signature_dishes(featured DESC, rank ASC NULLS LAST);

-- Public read (it's editorial content), admin write only.
ALTER TABLE nasiha_signature_dishes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "signature dishes are public read" ON nasiha_signature_dishes;
CREATE POLICY "signature dishes are public read" ON nasiha_signature_dishes
  FOR SELECT TO anon, authenticated
  USING (true);
-- Service role bypasses RLS automatically; no policy needed for writes from
-- the admin tooling. If we ever expose writes to user_profiles.is_admin
-- directly, that policy can be added later.
