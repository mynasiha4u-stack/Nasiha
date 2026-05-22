-- migration_16_tag_overrides_and_curate.sql
--
-- Three things:
--
-- 1. nasiha_tag_overrides JSONB column on content — admin-editable corrections
--    to Claude's occasion_tags. Shape: {"force_add": ["..."], "force_remove": ["..."]}.
--    Effective tags = (occasion_tags ∪ force_add) − force_remove.
--    Applied at the rendering / chat-context layer, not at enrichment.
--
-- 2. nasiha_tagline_override TEXT column — optional override for the AI-generated
--    good_for_summary tagline. When set, public display uses this instead.
--
-- 3. get_occasion_tag_counts() Postgres function — returns frequency of each
--    occasion_tag across published rows. Used by the rendering layer to rank
--    each restaurant's tags by rarity (show most distinctive first) and cap
--    visible tags at 3-4.
--
-- Idempotent.

ALTER TABLE content
  ADD COLUMN IF NOT EXISTS nasiha_tag_overrides JSONB DEFAULT '{"force_add":[],"force_remove":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS nasiha_tagline_override TEXT;

COMMENT ON COLUMN content.nasiha_tag_overrides   IS 'Admin overrides for occasion_tags. Shape {force_add: string[], force_remove: string[]}. Effective tags = Claude tags ∪ force_add − force_remove.';
COMMENT ON COLUMN content.nasiha_tagline_override IS 'Optional admin override for ai_enriched_summary.good_for_summary. When non-null, displays publicly INSTEAD of the AI tagline.';

CREATE OR REPLACE FUNCTION get_occasion_tag_counts()
RETURNS TABLE(tag TEXT, count BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT
    tag.value::TEXT AS tag,
    COUNT(*)::BIGINT AS count
  FROM content c
  CROSS JOIN LATERAL jsonb_array_elements_text(
    coalesce(c.ai_enriched_summary->'occasion_tags', '[]'::jsonb)
  ) AS tag(value)
  WHERE c.status = 'published'
  GROUP BY tag.value
  ORDER BY count DESC;
$$;

GRANT EXECUTE ON FUNCTION get_occasion_tag_counts() TO anon, authenticated, service_role;
