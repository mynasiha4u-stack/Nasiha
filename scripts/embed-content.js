#!/usr/bin/env node
/**
 * embed-content.js
 *
 * Phase 1 chat: generates / refreshes embeddings for every published content row.
 *
 * Idempotent + incremental: builds a doc string per row, SHA-256 hashes it, and
 * skips rows whose hash matches what's already in content_embeddings.source_hash.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/embed-content.js [--dry-run] [--limit N] [--force]
 *
 * Flags:
 *   --dry-run   Build docs and print stats, don't call OpenAI or write to DB.
 *   --limit N   Only process the first N rows that need (re)embedding.
 *   --force     Re-embed every row, ignoring the hash check.
 */

const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://puymhxfhoqryxnjubryw.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_KEY = process.env.OPENAI_API_KEY
const EMBED_MODEL = 'text-embedding-3-small'
const EMBED_DIMS = 1536
const BATCH_SIZE = 100  // OpenAI accepts up to 2048 inputs per call; 100 is a safe, sized batch.

if (!SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY env var is required.')
  process.exit(1)
}

const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')
const FORCE = argv.includes('--force')
const limitIdx = argv.indexOf('--limit')
const LIMIT = limitIdx >= 0 ? parseInt(argv[limitIdx + 1], 10) : Infinity

if (!OPENAI_KEY && !DRY_RUN) {
  console.error('ERROR: OPENAI_API_KEY env var is required (or pass --dry-run).')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ─────────────────────────────────────────────────────────────
// Doc building — the string we actually feed to the embedder.
// Keep this stable; changing it forces a full re-embed (hashes change).
// ─────────────────────────────────────────────────────────────
function buildDoc({ row, categorySlug, categoryName, attributes }) {
  const parts = []
  if (row.name) parts.push(row.name)
  if (categoryName) parts.push(`Category: ${categoryName}`)
  else if (categorySlug) parts.push(`Category: ${categorySlug}`)
  if (row.description) parts.push(row.description.trim())
  if (row.service_area) parts.push(`Based in: ${row.service_area}`)
  if (row.address) parts.push(`Address: ${row.address}`)
  if (row.metro) parts.push(`Metro: ${row.metro}`)
  if (Array.isArray(row.tags) && row.tags.length) parts.push(`Tags: ${row.tags.join(', ')}`)
  if (attributes && attributes.length) {
    const attrStr = attributes
      .map(a => `${a.attribute_name}=${a.attribute_value}`)
      .join('; ')
    parts.push(`Attributes: ${attrStr}`)
  }
  // Phase 4: include AI-distilled review insights so chat retrieval matches
  // semantic queries like "best biryani" or "good for date night".
  const s = row.ai_enriched_summary
  if (s && typeof s === 'object') {
    if (Array.isArray(s.known_for_dishes) && s.known_for_dishes.length)
      parts.push(`Known for: ${s.known_for_dishes.join(', ')}`)
    if (s.vibe) parts.push(`Vibe: ${s.vibe}`)
    if (Array.isArray(s.praise_themes) && s.praise_themes.length)
      parts.push(`Customers praise: ${s.praise_themes.join(', ')}`)
    if (Array.isArray(s.complaint_themes) && s.complaint_themes.length)
      parts.push(`Recurring complaints: ${s.complaint_themes.join(', ')}`)
    if (s.halal_notes) parts.push(`Halal: ${s.halal_notes}`)
    if (Array.isArray(s.recommended_for) && s.recommended_for.length)
      parts.push(`Recommended for: ${s.recommended_for.join(', ')}`)
  }
  return parts.join('. ').replace(/\s+/g, ' ').trim()
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex')
}

// ─────────────────────────────────────────────────────────────
// OpenAI embeddings — batched. Retries transient errors (5xx, 429, network)
// with exponential backoff: 1s, 2s, 4s, 8s, 16s. Real errors (auth, schema)
// fail on first try.
// ─────────────────────────────────────────────────────────────
async function embedBatch(texts) {
  const MAX_RETRIES = 5
  let attempt = 0
  while (true) {
    let res
    try {
      res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
      })
    } catch (e) {
      // Network blip — always retryable
      if (attempt >= MAX_RETRIES) throw new Error(`Network error after ${MAX_RETRIES} retries: ${e.message}`)
      const delay = 1000 * Math.pow(2, attempt)
      process.stdout.write(`\n  network error, retrying in ${delay/1000}s...`)
      await new Promise(r => setTimeout(r, delay))
      attempt++
      continue
    }
    if (res.ok) {
      const data = await res.json()
      return data.data.map(d => d.embedding)
    }
    const body = await res.text()
    // 5xx and 429 are retryable; 4xx (other) means our request is wrong, don't retry
    const retryable = res.status >= 500 || res.status === 429
    if (!retryable || attempt >= MAX_RETRIES) {
      throw new Error(`OpenAI ${res.status}: ${body}`)
    }
    const delay = 1000 * Math.pow(2, attempt)
    process.stdout.write(`\n  OpenAI ${res.status}, retrying in ${delay/1000}s...`)
    await new Promise(r => setTimeout(r, delay))
    attempt++
  }
}

// pgvector literal format: '[0.123,0.456,...]'
function toPgVector(arr) {
  return '[' + arr.join(',') + ']'
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'WRITE'}${FORCE ? ' (--force)' : ''}, limit=${LIMIT === Infinity ? 'none' : LIMIT}`)

  // 1. Categories lookup (id → slug, name)
  const { data: cats, error: catErr } = await supabase
    .from('categories')
    .select('id, slug, name')
  if (catErr) throw catErr
  const catById = new Map(cats.map(c => [c.id, c]))

  // 2. All published content rows
  console.log('Fetching published content rows...')
  const allRows = []
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from('content')
      .select('id, name, description, address, service_area, metro, tags, category_id, status, updated_at, ai_enriched_summary')
      .eq('status', 'published')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    allRows.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }
  console.log(`  ${allRows.length} published rows.`)

  // 3. Pull all attributes in one go, group by content_id.
  // CHUNK=100 — each UUID is ~45 chars URL-encoded; 500 IDs blew past Supabase's
  // 16KB request-line limit. 100 is comfortably under.
  console.log('Fetching attributes...')
  const attrsById = new Map()
  const ids = allRows.map(r => r.id)
  const CHUNK = 100
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from('attributes')
      .select('content_id, attribute_name, attribute_value')
      .in('content_id', slice)
    if (error) throw error
    for (const a of data || []) {
      if (!attrsById.has(a.content_id)) attrsById.set(a.content_id, [])
      attrsById.get(a.content_id).push(a)
    }
  }

  // 4. Existing embeddings: id → source_hash
  console.log('Fetching existing embeddings...')
  const existing = new Map()
  let efrom = 0
  while (true) {
    const { data, error } = await supabase
      .from('content_embeddings')
      .select('content_id, source_hash, model')
      .range(efrom, efrom + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const e of data) existing.set(e.content_id, e)
    if (data.length < PAGE) break
    efrom += PAGE
  }
  console.log(`  ${existing.size} existing embedding rows.`)

  // 5. Build docs, decide who needs (re)embedding
  const todo = []
  let skipped = 0
  let totalChars = 0
  for (const row of allRows) {
    const cat = catById.get(row.category_id) || {}
    const doc = buildDoc({
      row,
      categorySlug: cat.slug,
      categoryName: cat.name,
      attributes: attrsById.get(row.id) || [],
    })
    if (!doc) continue
    const hash = sha256(doc)
    const prev = existing.get(row.id)
    const upToDate = !FORCE && prev && prev.source_hash === hash && prev.model === EMBED_MODEL
    if (upToDate) {
      skipped++
      continue
    }
    todo.push({ id: row.id, name: row.name, doc, hash })
    totalChars += doc.length
    if (todo.length >= LIMIT) break
  }

  console.log(`\nSummary:`)
  console.log(`  Total published rows: ${allRows.length}`)
  console.log(`  Up-to-date (skipping): ${skipped}`)
  console.log(`  To embed: ${todo.length}`)
  console.log(`  Total chars of new docs: ${totalChars.toLocaleString()}`)
  // OpenAI tokenizes at ~4 chars/token for English. Cost: $0.02 / 1M tokens.
  const estTokens = Math.ceil(totalChars / 4)
  const estCost = estTokens * 0.02 / 1_000_000
  console.log(`  Est. tokens: ${estTokens.toLocaleString()} → est. cost: $${estCost.toFixed(4)}`)

  if (DRY_RUN) {
    console.log('\nDRY RUN — no API calls, no writes.')
    if (todo.length > 0) {
      console.log('\nFirst 3 sample docs:')
      for (const t of todo.slice(0, 3)) {
        console.log(`\n  [${t.name}]`)
        console.log(`  ${t.doc.slice(0, 300)}${t.doc.length > 300 ? '…' : ''}`)
      }
    }
    return
  }

  if (todo.length === 0) {
    console.log('\nNothing to do. Exiting.')
    return
  }

  // 6. Embed in batches, upsert as we go
  console.log(`\nEmbedding ${todo.length} rows in batches of ${BATCH_SIZE}...`)
  let done = 0
  for (let i = 0; i < todo.length; i += BATCH_SIZE) {
    const batch = todo.slice(i, i + BATCH_SIZE)
    const texts = batch.map(t => t.doc)
    let embeddings
    try {
      embeddings = await embedBatch(texts)
    } catch (e) {
      console.error(`Batch ${i / BATCH_SIZE} failed:`, e.message)
      console.error('Stopping — re-run the script to resume from here.')
      process.exit(1)
    }
    if (embeddings.length !== batch.length) {
      throw new Error(`Got ${embeddings.length} embeddings for ${batch.length} inputs`)
    }
    const rows = batch.map((t, idx) => ({
      content_id: t.id,
      embedding: toPgVector(embeddings[idx]),
      model: EMBED_MODEL,
      source_hash: t.hash,
      embedded_at: new Date().toISOString(),
    }))
    const { error } = await supabase
      .from('content_embeddings')
      .upsert(rows, { onConflict: 'content_id' })
    if (error) {
      console.error('Upsert failed:', error)
      process.exit(1)
    }
    done += batch.length
    process.stdout.write(`\r  ${done}/${todo.length}`)
  }
  process.stdout.write('\n')
  console.log(`Done. Embedded ${done} rows.`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
