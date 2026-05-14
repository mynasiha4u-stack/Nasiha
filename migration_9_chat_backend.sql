-- migration_9_chat_backend.sql
-- Phase 1 of chat: retrieval backend only. No UI in this phase.
--
-- Creates:
--   1. pgvector extension
--   2. content_embeddings table (separate from content — see CLAUDE.md Schema decision B)
--   3. chat_conversations + chat_messages tables (for Phase 2; created now so the schema is settled)
--   4. match_content() — hybrid vector + full-text retrieval via Reciprocal Rank Fusion
--
-- Run order: paste this whole file into the Supabase SQL editor. Idempotent — safe to re-run.

-- ─────────────────────────────────────────────────────────────
-- 1. pgvector
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────────────────────────
-- 2. content_embeddings — one row per embedded content row.
--    source_hash lets the embedder skip unchanged rows on re-runs.
--    model column lets us run multiple embedding models side-by-side later.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_embeddings (
  content_id  UUID PRIMARY KEY REFERENCES content(id) ON DELETE CASCADE,
  embedding   VECTOR(1536) NOT NULL,
  model       TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  source_hash TEXT NOT NULL,
  embedded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HNSW index for fast cosine-distance kNN. m=16, ef_construction=64 are pgvector defaults.
CREATE INDEX IF NOT EXISTS content_embeddings_vec_idx
  ON content_embeddings USING hnsw (embedding vector_cosine_ops);

-- ─────────────────────────────────────────────────────────────
-- 3. content full-text search index — speeds up the FTS half of hybrid retrieval.
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS content_fts_idx ON content
  USING gin (to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,'')));

-- ─────────────────────────────────────────────────────────────
-- 4. Chat history tables. Phase 2 reads/writes these from the React app.
--    Phase 1 leaves them empty; schema is set now so we don't migrate twice.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chat_conversations_user_idx
  ON chat_conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id       UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role                  TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content               TEXT NOT NULL,
  retrieved_content_ids UUID[],
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chat_messages_conv_idx
  ON chat_messages(conversation_id, created_at);

-- RLS: each user only sees their own conversations & messages.
-- Service role (used by the Edge Function) bypasses RLS automatically.
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users see own conversations" ON chat_conversations;
CREATE POLICY "users see own conversations" ON chat_conversations
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users see own messages via conversation" ON chat_messages;
CREATE POLICY "users see own messages via conversation" ON chat_messages
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM chat_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM chat_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

-- ─────────────────────────────────────────────────────────────
-- 5. Hybrid retrieval: vector kNN + FTS, combined via Reciprocal Rank Fusion.
--
-- Why RRF: it doesn't require normalizing vector similarity against ts_rank
-- (they live on completely different scales). It just merges rank positions:
--    score = sum over each ranked list of 1 / (k + rank_in_list)
-- with k=60 (the canonical value from the original RRF paper). Robust and tuning-free.
--
-- Usage:
--   SELECT * FROM match_content(
--     query_embedding := '[0.01, ...]'::vector(1536),
--     query_text      := 'best biryani in Fremont',
--     match_count     := 10,
--     category_filter := NULL  -- e.g. 'restaurants' to scope to one category
--   );
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_content(
  query_embedding VECTOR(1536),
  query_text      TEXT,
  match_count     INT  DEFAULT 10,
  category_filter TEXT DEFAULT NULL
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
  vec_rank        INT,
  fts_rank        INT,
  rrf_score       FLOAT
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  k              CONSTANT INT := 60;            -- RRF constant
  candidate_pool CONSTANT INT := GREATEST(match_count * 5, 50);
  tsq            tsquery := CASE
                              WHEN query_text IS NOT NULL AND length(trim(query_text)) > 0
                              THEN websearch_to_tsquery('english', query_text)
                              ELSE NULL
                            END;
BEGIN
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
  )
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
    cb.vec_rnk::INT,
    cb.fts_rnk::INT,
    cb.score::FLOAT
  FROM combined cb
  JOIN content c ON c.id = cb.cid
  LEFT JOIN categories cat ON cat.id = c.category_id
  ORDER BY cb.score DESC
  LIMIT match_count;
END;
$$;

-- Let the Edge Function (service role) and anon (Phase 2 reads from frontend) call it.
GRANT EXECUTE ON FUNCTION match_content(VECTOR, TEXT, INT, TEXT) TO anon, authenticated, service_role;
