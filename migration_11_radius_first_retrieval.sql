-- migration_11_radius_first_retrieval.sql
--
-- Fixes the "Pakwan Restaurant problem": when a user asks "5 restaurants within
-- 10 minutes of 12 Arundel Dr Hayward", they want the CLOSEST 5 restaurants,
-- with semantic relevance as a tiebreaker — not the most semantically-restaurant-y
-- 50 (filtered after-the-fact by radius), which is what migration_10 did.
--
-- Concrete bug: Pakwan Restaurant (3.26 mi from 12 Arundel, in DB) didn't appear
-- because it didn't make the top 50 by either vector similarity or FTS rank —
-- its name/description doesn't strongly match the literal query words, so the
-- retrieval filtered it out BEFORE the radius filter ran.
--
-- Architecture change:
-- - When `radius_miles` is set (has_radius=TRUE), pre-filter ALL candidates to
--   within radius FIRST. Then rank that subset by vec / FTS / RRF. Crucially,
--   candidates with NO semantic or FTS match still appear — they just have a
--   lower rrf_score. The primary sort becomes distance ASC.
-- - When no radius (just near_lat/lng): unchanged, RRF-primary sort.
-- - When no geo at all: unchanged.
--
-- Idempotent — CREATE OR REPLACE with same signature as migration_10.

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
  WITH candidates AS (
    -- The candidate universe.
    -- When has_radius: pre-filtered to within radius (typically dozens of rows).
    -- When no radius: the entire published+category-filtered table (used by vec/fts
    --   as the universe to LIMIT into a top-K candidate_pool).
    SELECT
      c.id,
      c.display_lat,
      c.display_lng
    FROM content c
    LEFT JOIN categories cat ON cat.id = c.category_id
    WHERE c.status = 'published'
      AND (category_filter IS NULL OR cat.slug = category_filter)
      AND (NOT has_radius OR (
        c.display_lat IS NOT NULL
        AND c.display_lng IS NOT NULL
        AND (3959.0 * 2.0 * ASIN(SQRT(
          POWER(SIN(RADIANS(c.display_lat - near_lat) / 2.0), 2)
          + COS(RADIANS(near_lat)) * COS(RADIANS(c.display_lat))
          * POWER(SIN(RADIANS(c.display_lng - near_lng) / 2.0), 2)
        ))) <= radius_miles
      ))
  ),
  vec_ranked AS (
    SELECT ca.id AS cid,
      ROW_NUMBER() OVER (ORDER BY ce.embedding <=> query_embedding)::INT AS rnk
    FROM candidates ca
    JOIN content_embeddings ce ON ce.content_id = ca.id
    ORDER BY ce.embedding <=> query_embedding
    -- When has_radius the candidate set is bounded already; allow all of them.
    -- When no radius we must cap to avoid scanning 7k+ rows.
    LIMIT (CASE WHEN has_radius THEN 10000 ELSE candidate_pool END)
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
    LIMIT (CASE WHEN has_radius THEN 10000 ELSE candidate_pool END)
  ),
  -- For has_radius: outer-join — every in-radius candidate appears, ranks are
  -- NULL if no vec/fts match (rrf_score then = 0, but distance carries the sort).
  -- For no radius: inner-style — only candidates appearing in vec OR fts make it.
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
    WHERE has_radius OR vr.rnk IS NOT NULL OR fr.rnk IS NOT NULL
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
    -- has_radius: closest first; RRF breaks ties on equal distance (rare).
    -- no radius (whether or not has_geo): rank by relevance.
    CASE WHEN has_radius THEN e.distance_miles ELSE NULL END ASC NULLS LAST,
    e.rrf_score DESC
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION match_content(VECTOR, TEXT, INT, TEXT, FLOAT, FLOAT, FLOAT)
  TO anon, authenticated, service_role;
