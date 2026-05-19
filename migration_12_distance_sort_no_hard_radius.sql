-- migration_12_distance_sort_no_hard_radius.sql
--
-- Aligns chat retrieval with the Restaurants page behavior:
--   "When a location is mentioned, sort the entire eligible set by distance
--    and return top N closest. Don't hard-filter by a brittle minute-radius
--    cutoff."
--
-- Concrete bug this fixes: 'restaurants within 10 minutes of 12 Arundel Dr Hayward'
-- excluded Falafel Flare (4.1 mi from the anchor) because the intent extractor
-- converted '10 min' to a 4-mile radius (using 2.5 min/mile proxy), and the
-- hard radius cutoff dropped anything ≥ 4 mi. That's arbitrary — the user
-- asked for "around 10 minutes" and would absolutely want a 10-minute spot
-- that's actually 10.25 minutes.
--
-- Behavior:
-- - has_geo (with or without radius_miles): primary sort = distance ASC; RRF
--   breaks ties. Candidate universe = everything in the category within a
--   wide default cap (30 mi — Bay Area scope) so we don't return a restaurant
--   in Houston when the user mentioned Hayward.
-- - has_radius (explicit radius_miles passed in): used as an UPPER BOUND on
--   the candidate cap, but does NOT hard-filter the returned set. The chat
--   can mention whether each result is inside/outside the user's stated time
--   window via the estimate_minutes field.
-- - no geo: behavior unchanged from migration 11 (RRF-primary sort).
--
-- This makes the chat behave the way the Restaurants page filter does when
-- you turn on "Nearest" sort. Same data, same ordering, same UX.

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
  k                CONSTANT INT := 60;
  candidate_pool   CONSTANT INT := GREATEST(match_count * 5, 50);
  default_geo_cap  CONSTANT FLOAT := 30.0;   -- Bay Area scope. Restaurants 50 mi from anchor are noise.
  plain_q          TEXT;
  tsq              tsquery;
  has_geo          BOOLEAN := (near_lat IS NOT NULL AND near_lng IS NOT NULL);
  effective_cap    FLOAT := default_geo_cap;
BEGIN
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

  -- If the caller specifies a radius LARGER than our default cap, honor it
  -- (rare). If smaller, IGNORE — the user's "within N minutes" hint is
  -- informational only. We still return closest N regardless.
  IF radius_miles IS NOT NULL AND radius_miles > default_geo_cap THEN
    effective_cap := radius_miles;
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      c.id,
      c.display_lat,
      c.display_lng
    FROM content c
    LEFT JOIN categories cat ON cat.id = c.category_id
    WHERE c.status = 'published'
      AND (category_filter IS NULL OR cat.slug = category_filter)
      AND (NOT has_geo OR (
        c.display_lat IS NOT NULL
        AND c.display_lng IS NOT NULL
        AND (3959.0 * 2.0 * ASIN(SQRT(
          POWER(SIN(RADIANS(c.display_lat - near_lat) / 2.0), 2)
          + COS(RADIANS(near_lat)) * COS(RADIANS(c.display_lat))
          * POWER(SIN(RADIANS(c.display_lng - near_lng) / 2.0), 2)
        ))) <= effective_cap
      ))
  ),
  vec_ranked AS (
    SELECT ca.id AS cid,
      ROW_NUMBER() OVER (ORDER BY ce.embedding <=> query_embedding)::INT AS rnk
    FROM candidates ca
    JOIN content_embeddings ce ON ce.content_id = ca.id
    ORDER BY ce.embedding <=> query_embedding
    LIMIT (CASE WHEN has_geo THEN 10000 ELSE candidate_pool END)
  ),
  fts_ranked AS (
    SELECT ca.id AS cid,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(
          to_tsvector('english', coalesce(c.name,'') || ' ' || coalesce(c.description,'')),
          tsq
        ) DESC
      )::INT AS rnk
    FROM candidates ca
    JOIN content c ON c.id = ca.id
    WHERE tsq IS NOT NULL
      AND to_tsvector('english', coalesce(c.name,'') || ' ' || coalesce(c.description,'')) @@ tsq
    LIMIT (CASE WHEN has_geo THEN 10000 ELSE candidate_pool END)
  ),
  -- When has_geo: outer-join — every in-cap candidate appears, even with no
  -- vec/fts match. Distance carries the sort. RRF only orders ties.
  -- When no geo: inner-style — only semantically-matched candidates appear.
  combined AS (
    SELECT
      ca.id AS cid,
      vr.rnk AS vec_rnk,
      fr.rnk AS fts_rnk,
      (
        coalesce(1.0::float / (k + vr.rnk), 0)
      + coalesce(1.0::float / (k + fr.rnk), 0)
      ) AS score
    FROM candidates ca
    LEFT JOIN vec_ranked vr ON vr.cid = ca.id
    LEFT JOIN fts_ranked fr ON fr.cid = ca.id
    WHERE has_geo OR vr.rnk IS NOT NULL OR fr.rnk IS NOT NULL
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
  ORDER BY
    -- Primary: distance when geo is in play (mirrors Restaurants page "Nearest" sort).
    -- Secondary: RRF score for everything else, including ties at same distance.
    CASE WHEN has_geo THEN e.distance_miles ELSE NULL END ASC NULLS LAST,
    e.rrf_score DESC
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION match_content(VECTOR, TEXT, INT, TEXT, FLOAT, FLOAT, FLOAT)
  TO anon, authenticated, service_role;
