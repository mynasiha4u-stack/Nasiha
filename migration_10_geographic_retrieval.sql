-- migration_10_geographic_retrieval.sql
-- Adds location-aware retrieval to the chat backend.
--
-- match_content() gains 3 new optional params: near_lat, near_lng, radius_miles.
-- - When `near_lat`/`near_lng` are NULL: behavior is unchanged from migration 9.
-- - When provided: each candidate's radial distance is computed (Haversine, miles).
-- - When `radius_miles` is also provided: results are hard-filtered to that radius
--   and sorted by distance ascending (with RRF as the tiebreaker).
-- - When `near_lat`/`near_lng` provided WITHOUT `radius_miles`: distance is still
--   computed and returned, but ranking is RRF-only (location is informational).
--
-- New return columns: display_lat, display_lng, distance_miles.
--
-- Paste this whole file into the Supabase SQL editor. Idempotent (DROP + CREATE).

DROP FUNCTION IF EXISTS match_content(VECTOR, TEXT, INT, TEXT);
DROP FUNCTION IF EXISTS match_content(VECTOR, TEXT, INT, TEXT, FLOAT, FLOAT, FLOAT);

CREATE OR REPLACE FUNCTION match_content(
  query_embedding VECTOR(1536),
  query_text      TEXT,
  match_count     INT   DEFAULT 10,
  category_filter TEXT  DEFAULT NULL,
  near_lat        FLOAT DEFAULT NULL,
  near_lng        FLOAT DEFAULT NULL,
  radius_miles    FLOAT DEFAULT NULL
)
RETURNS TABLE (
  id              UUID,
  name            TEXT,
  description     TEXT,
  category_slug   TEXT,
  service_area    TEXT,
  address         TEXT,
  phone           TEXT,
  email           TEXT,
  website         TEXT,
  instagram       TEXT,
  facebook        TEXT,
  whatsapp        TEXT,
  url_slug        TEXT,
  display_lat     DOUBLE PRECISION,
  display_lng     DOUBLE PRECISION,
  distance_miles  FLOAT,
  vec_rank        INT,
  fts_rank        INT,
  rrf_score       FLOAT
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  k              CONSTANT INT := 60;
  candidate_pool CONSTANT INT := GREATEST(match_count * 5, 50);
  plain_q        TEXT;
  tsq            tsquery;
  has_geo        BOOLEAN := (near_lat IS NOT NULL AND near_lng IS NOT NULL);
  has_radius     BOOLEAN := (has_geo AND radius_miles IS NOT NULL);
BEGIN
  -- OR-of-tokens FTS query (see migration_9 commentary)
  IF query_text IS NULL OR length(trim(query_text)) = 0 THEN
    tsq := NULL;
  ELSE
    plain_q := plainto_tsquery('english', query_text)::text;
    IF length(plain_q) > 0 THEN
      tsq := to_tsquery('english', regexp_replace(plain_q, ' & ', ' | ', 'g'));
    ELSE
      tsq := NULL;
    END IF;
  END IF;

  RETURN QUERY
  WITH vec_ranked AS (
    SELECT
      c.id AS cid,
      ROW_NUMBER() OVER (ORDER BY ce.embedding <=> query_embedding)::INT AS rnk
    FROM content_embeddings ce
    JOIN content c ON c.id = ce.content_id
    LEFT JOIN categories cat ON cat.id = c.category_id
    WHERE c.status = 'published'
      AND (category_filter IS NULL OR cat.slug = category_filter)
    ORDER BY ce.embedding <=> query_embedding
    LIMIT candidate_pool
  ),
  fts_ranked AS (
    SELECT
      c.id AS cid,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(
          to_tsvector('english', coalesce(c.name,'') || ' ' || coalesce(c.description,'')),
          tsq
        ) DESC
      )::INT AS rnk
    FROM content c
    LEFT JOIN categories cat ON cat.id = c.category_id
    WHERE c.status = 'published'
      AND tsq IS NOT NULL
      AND to_tsvector('english', coalesce(c.name,'') || ' ' || coalesce(c.description,'')) @@ tsq
      AND (category_filter IS NULL OR cat.slug = category_filter)
    LIMIT candidate_pool
  ),
  combined AS (
    SELECT
      cid,
      MIN(rnk) FILTER (WHERE src='vec') AS vec_rnk,
      MIN(rnk) FILTER (WHERE src='fts') AS fts_rnk,
      SUM(1.0::float / (k + rnk))       AS score
    FROM (
      SELECT cid, rnk, 'vec' AS src FROM vec_ranked
      UNION ALL
      SELECT cid, rnk, 'fts' AS src FROM fts_ranked
    ) u
    GROUP BY cid
  ),
  enriched AS (
    SELECT
      c.id,
      c.name,
      c.description,
      cat.slug AS category_slug,
      c.service_area,
      c.address,
      c.phone,
      c.email,
      c.website,
      c.instagram,
      c.facebook,
      c.whatsapp,
      c.url_slug,
      c.display_lat,
      c.display_lng,
      CASE
        WHEN has_geo AND c.display_lat IS NOT NULL AND c.display_lng IS NOT NULL THEN
          (3959.0 * 2.0 * ASIN(SQRT(
            POWER(SIN(RADIANS(c.display_lat - near_lat) / 2.0), 2)
            + COS(RADIANS(near_lat)) * COS(RADIANS(c.display_lat))
            * POWER(SIN(RADIANS(c.display_lng - near_lng) / 2.0), 2)
          )))::FLOAT
        ELSE NULL
      END AS distance_miles,
      cb.vec_rnk::INT AS vec_rank,
      cb.fts_rnk::INT AS fts_rank,
      cb.score::FLOAT AS rrf_score
    FROM combined cb
    JOIN content c ON c.id = cb.cid
    LEFT JOIN categories cat ON cat.id = c.category_id
  )
  SELECT *
  FROM enriched e
  WHERE (NOT has_radius)
     OR (e.distance_miles IS NOT NULL AND e.distance_miles <= radius_miles)
  ORDER BY
    -- When a hard radius is set, sort by distance (closer first); RRF breaks ties.
    -- When no radius, sort by RRF only — location info is just informational.
    CASE WHEN has_radius THEN e.distance_miles ELSE NULL END ASC NULLS LAST,
    e.rrf_score DESC
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION match_content(VECTOR, TEXT, INT, TEXT, FLOAT, FLOAT, FLOAT)
  TO anon, authenticated, service_role;
