-- migration_14_halal_verification.sql
--
-- Adds an admin-editable halal_verification column to content.
--
-- IMPORTANT — this is NOT the same as ai_enriched_summary.halal_notes:
--   - halal_notes (in ai_enriched_summary JSONB) — Claude-derived from reviews,
--     used by chat for internal hedging. Public-facing surfaces don't display it.
--   - halal_verification (this column) — admin-set, capital-N Nasiha's
--     determination. Never derived from review reading. Default null = "no
--     determination made," not "unverified."
--
-- The public listing pages do NOT render any halal badge regardless of value.
-- Nasiha is not a halal certification body; inclusion in the directory is the
-- only implicit signal. This column exists for internal record-keeping and
-- future admin tooling (a small browse-and-set tool for Nas).
--
-- Idempotent.

ALTER TABLE content
  ADD COLUMN IF NOT EXISTS halal_verification TEXT
  CHECK (
    halal_verification IS NULL
    OR halal_verification IN (
      'certified',           -- official halal certification displayed
      'owner_confirmed',     -- owner explicitly states halal
      'sign_in_restaurant',  -- signage on premises says halal
      'community_vouched',   -- Nasiha admin or trusted community member confirmed
      'implied',             -- Muslim ownership / no alcohol / category strongly suggests, unconfirmed
      'unverified'           -- explicit "no determination made" — distinct from null which means "not yet looked at"
    )
  );

-- Operational index — admin tooling will likely page through "still null" rows.
CREATE INDEX IF NOT EXISTS content_halal_verification_null_idx
  ON content(id) WHERE halal_verification IS NULL AND status = 'published';
