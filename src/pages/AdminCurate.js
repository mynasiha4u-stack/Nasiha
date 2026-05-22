import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import { colors, headerGradient } from '../theme'
import { effectiveOccasionTags, tagMeta } from '../lib/listingTags'

/**
 * /admin/curate — Nasiha editorial cockpit.
 *
 * Admin-only (gated by profile.is_admin). Lets Nas:
 *   - Search restaurants by name
 *   - See Claude's AI enrichment on the LEFT (read-only reference)
 *   - Edit Nasiha editorial fields on the RIGHT:
 *       nasiha_pro_tip            — textarea
 *       nasiha_must_order         — chip input
 *       nasiha_tagline_override   — textarea
 *       nasiha_reviewer           — text (internal-only, never shown publicly)
 *       nasiha_tag_overrides      — toggle Claude tags off + multi-add from vocab
 *   - Cycle through restaurants needing review (sorted by Google review count DESC,
 *     filtered to nasiha_pro_tip IS NULL) for efficient sweeping.
 */

const VOCAB = [
  'date_night', 'family_with_kids', 'big_groups', 'outdoor_seating', 'late_night',
  'quick_lunch', 'business_meeting', 'prayer_facilities', 'takeout_friendly',
  'large_catering_orders', 'vegetarian_friendly', 'solo_friendly', 'cheap_eats',
]

export default function AdminCurate() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()

  const [mode, setMode] = useState('search')                  // 'search' | 'queue'
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [queue, setQueue] = useState([])                       // for queue mode
  const [queueIdx, setQueueIdx] = useState(0)
  const [active, setActive] = useState(null)                   // active row
  const [draft, setDraft] = useState(null)                     // editable copy
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  // Auth gate
  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate(`/auth?redirect=${encodeURIComponent('/admin/curate')}`); return }
    if (profile && !profile.is_admin) { navigate('/'); return }
  }, [authLoading, user, profile, navigate])

  // Search by name
  async function doSearch(q) {
    if (!q || !q.trim()) { setSearchResults([]); return }
    const { data } = await supabase
      .from('content')
      .select('id, name, address, ai_enriched_at, google_review_count')
      .ilike('name', `%${q.trim()}%`)
      .eq('status', 'published')
      .order('google_review_count', { ascending: false, nullsLast: true })
      .limit(25)
    setSearchResults(data || [])
  }

  // Load queue: rows where nasiha_pro_tip is null, sorted by google_review_count DESC
  async function loadQueue() {
    const { data: cat } = await supabase.from('categories').select('id').eq('slug', 'restaurants').single()
    if (!cat) return
    const { data } = await supabase
      .from('content')
      .select('id, name, address, ai_enriched_at, google_review_count')
      .eq('category_id', cat.id)
      .eq('status', 'published')
      .is('nasiha_pro_tip', null)
      .not('ai_enriched_summary', 'is', null)   // only enriched rows
      .order('google_review_count', { ascending: false, nullsLast: true })
      .limit(200)
    setQueue(data || [])
    setQueueIdx(0)
    if (data && data.length > 0) await loadRow(data[0].id)
  }

  // Load full row by id
  async function loadRow(id) {
    const { data, error } = await supabase
      .from('content')
      .select('id, name, address, ai_enriched_summary, ai_enriched_at, google_rating, google_review_count, nasiha_pro_tip, nasiha_must_order, nasiha_tagline_override, nasiha_reviewer, nasiha_tag_overrides')
      .eq('id', id)
      .single()
    if (error || !data) return
    setActive(data)
    setDraft({
      nasiha_pro_tip: data.nasiha_pro_tip || '',
      nasiha_must_order: Array.isArray(data.nasiha_must_order) ? [...data.nasiha_must_order] : [],
      nasiha_tagline_override: data.nasiha_tagline_override || '',
      nasiha_reviewer: data.nasiha_reviewer || 'Nas',
      nasiha_tag_overrides: data.nasiha_tag_overrides || { force_add: [], force_remove: [] },
    })
  }

  async function save() {
    if (!active || !draft) return
    setSaving(true)
    const patch = {
      nasiha_pro_tip:           draft.nasiha_pro_tip.trim() || null,
      nasiha_must_order:        draft.nasiha_must_order.length > 0 ? draft.nasiha_must_order : null,
      nasiha_tagline_override:  draft.nasiha_tagline_override.trim() || null,
      nasiha_reviewer:          draft.nasiha_reviewer.trim() || null,
      nasiha_tag_overrides:     draft.nasiha_tag_overrides,
    }
    const { error } = await supabase.from('content').update(patch).eq('id', active.id)
    setSaving(false)
    if (error) { alert('Save failed: ' + error.message); return }
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
    await loadRow(active.id)
  }

  function nextInQueue() {
    if (mode !== 'queue' || queue.length === 0) return
    const next = (queueIdx + 1) % queue.length
    setQueueIdx(next)
    loadRow(queue[next].id)
  }
  function prevInQueue() {
    if (mode !== 'queue' || queue.length === 0) return
    const prev = (queueIdx - 1 + queue.length) % queue.length
    setQueueIdx(prev)
    loadRow(queue[prev].id)
  }

  const enrichment = active?.ai_enriched_summary || {}
  const claudeTags = useMemo(
    () => Array.isArray(enrichment.occasion_tags) ? enrichment.occasion_tags : [],
    [enrichment]
  )

  if (authLoading || !profile?.is_admin) {
    return <div style={{ padding: 40, textAlign: 'center', color: colors.textMuted }}>Loading…</div>
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', background: colors.surface, minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: headerGradient, padding: '36px 20px 22px' }}>
        <div style={{ marginBottom: 10 }}><TopBar /></div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: colors.deep, marginBottom: 6 }}>✨ Curate</h1>
        <p style={{ fontSize: 13, color: 'rgba(28,43,58,0.65)' }}>Nasiha editorial layer — Pro Tips, must-orders, tag overrides.</p>
      </div>

      <div style={{ padding: 16 }}>
        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={() => setMode('search')} style={tabStyle(mode === 'search')}>🔍 Search</button>
          <button onClick={() => { setMode('queue'); loadQueue() }} style={tabStyle(mode === 'queue')}>📋 Needs Review queue</button>
        </div>

        {mode === 'search' && (
          <div style={{ marginBottom: 14 }}>
            <input
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); doSearch(e.target.value) }}
              placeholder="Search restaurants by name…"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', fontSize: 14 }}
            />
            {searchResults.length > 0 && (
              <div style={{ marginTop: 8, background: 'white', borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', maxHeight: 240, overflowY: 'auto' }}>
                {searchResults.map(r => (
                  <button key={r.id} onClick={() => loadRow(r.id)} style={{
                    width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none',
                    borderBottom: '1px solid rgba(0,0,0,0.05)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: 13, color: '#1C2B3A', fontWeight: 600 }}>{r.name}</span>
                    <span style={{ fontSize: 11, color: '#9A9A9A' }}>
                      {r.ai_enriched_at ? '✓ enriched' : '✗ not enriched'} · {r.google_review_count ?? '?'} reviews
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {mode === 'queue' && queue.length > 0 && (
          <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white', padding: 10, borderRadius: 10 }}>
            <button onClick={prevInQueue} style={pillBtn}>← Prev</button>
            <span style={{ fontSize: 13, color: '#6A7A8A' }}>{queueIdx + 1} of {queue.length} · needs review (no Pro Tip yet)</span>
            <button onClick={nextInQueue} style={pillBtn}>Next →</button>
          </div>
        )}

        {!active && mode === 'search' && (
          <div style={{ textAlign: 'center', color: '#6A7A8A', padding: 40, fontSize: 13 }}>
            Type a restaurant name above to start curating.
          </div>
        )}

        {active && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* LEFT — Claude's enrichment, read-only reference */}
            <div style={{ background: 'white', padding: 14, borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Claude's enrichment · reference only</div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1C2B3A', marginBottom: 6 }}>{active.name}</h2>
              <div style={{ fontSize: 12, color: '#6A7A8A', marginBottom: 10 }}>{active.address}</div>
              <div style={{ fontSize: 12, color: '#6A7A8A', marginBottom: 14 }}>
                Google: ★ {active.google_rating ?? '?'} · {active.google_review_count ?? '?'} reviews
              </div>
              {enrichment.good_for_summary && <Block label="AI tagline" value={enrichment.good_for_summary} />}
              {enrichment.signature_strength && <Block label="Signature" value={enrichment.signature_strength} />}
              {enrichment.vibe && <Block label="Vibe" value={enrichment.vibe} />}
              {Array.isArray(enrichment.known_for_dishes) && enrichment.known_for_dishes.length > 0 && (
                <Block label="Known for" value={enrichment.known_for_dishes.join(', ')} />
              )}
              {Array.isArray(enrichment.praise_themes) && enrichment.praise_themes.length > 0 && (
                <Block label="Praise" value={enrichment.praise_themes.join(' · ')} />
              )}
              {Array.isArray(enrichment.complaint_themes) && enrichment.complaint_themes.length > 0 && (
                <Block label="Complaints (internal)" value={enrichment.complaint_themes.join(' · ')} />
              )}
              {claudeTags.length > 0 && (
                <Block label="Claude tags" value={claudeTags.join(', ')} />
              )}
              {Array.isArray(enrichment.minor_tags) && enrichment.minor_tags.length > 0 && (
                <Block label="Minor tags" value={enrichment.minor_tags.join(' · ')} />
              )}
            </div>

            {/* RIGHT — Editorial form */}
            <div style={{ background: 'white', padding: 14, borderRadius: 12, border: '2px solid ' + colors.brand }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: colors.brand, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Editorial · saves to nasiha_* columns</div>

              <FieldLabel>💡 Nasiha Pro Tip (1-3 sentences)</FieldLabel>
              <textarea
                value={draft?.nasiha_pro_tip || ''}
                onChange={e => setDraft({ ...draft, nasiha_pro_tip: e.target.value })}
                rows={3}
                placeholder="Insider tip — what should the reader know that a typical review wouldn't tell them?"
                style={textareaStyle}
              />

              <FieldLabel>Must order (Nasiha picks)</FieldLabel>
              <ChipInput
                values={draft?.nasiha_must_order || []}
                onChange={vs => setDraft({ ...draft, nasiha_must_order: vs })}
                placeholder="add dish + Enter"
              />

              <FieldLabel>Tagline override (optional, replaces AI tagline publicly)</FieldLabel>
              <textarea
                value={draft?.nasiha_tagline_override || ''}
                onChange={e => setDraft({ ...draft, nasiha_tagline_override: e.target.value })}
                rows={2}
                placeholder="Optional override for Claude's good_for_summary…"
                style={textareaStyle}
              />

              <FieldLabel>Internal: reviewer attribution (not shown publicly)</FieldLabel>
              <input
                value={draft?.nasiha_reviewer || ''}
                onChange={e => setDraft({ ...draft, nasiha_reviewer: e.target.value })}
                placeholder="Nas, or contributor name"
                style={inputStyle}
              />

              <FieldLabel>Tag overrides</FieldLabel>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: '#6A7A8A', marginBottom: 4 }}>Toggle Claude tags off:</div>
                {claudeTags.length === 0 && <div style={{ fontSize: 12, color: '#9A9A9A', fontStyle: 'italic' }}>(no Claude tags)</div>}
                {claudeTags.map(t => {
                  const removed = (draft?.nasiha_tag_overrides?.force_remove || []).includes(t)
                  return (
                    <button key={t} onClick={() => toggleRemove(draft, setDraft, t)} style={{
                      ...chipBtn,
                      background: removed ? '#FEE2E2' : '#E0F7F5',
                      color: removed ? '#991B1B' : '#0F766E',
                      textDecoration: removed ? 'line-through' : 'none',
                    }}>{tagMeta(t).emoji} {tagMeta(t).label}{removed ? ' ✕' : ''}</button>
                  )
                })}
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6A7A8A', marginBottom: 4 }}>Force-add tags Claude missed:</div>
                {VOCAB.filter(v => !claudeTags.includes(v)).map(t => {
                  const added = (draft?.nasiha_tag_overrides?.force_add || []).includes(t)
                  return (
                    <button key={t} onClick={() => toggleAdd(draft, setDraft, t)} style={{
                      ...chipBtn,
                      background: added ? '#D1FAE5' : 'transparent',
                      color: added ? '#065F46' : '#6A7A8A',
                      border: added ? '1px solid #10B981' : '1px solid rgba(0,0,0,0.12)',
                    }}>{tagMeta(t).emoji} {tagMeta(t).label}{added ? ' ✓' : ''}</button>
                  )
                })}
              </div>

              {/* Effective tags preview */}
              <div style={{ marginTop: 12, padding: 10, background: '#F7F3EE', borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6A7A8A', textTransform: 'uppercase', marginBottom: 6 }}>Effective tags (after overrides)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {effectiveOccasionTags({
                    ai_enriched_summary: enrichment,
                    nasiha_tag_overrides: draft?.nasiha_tag_overrides,
                  }).map(t => (
                    <span key={t} style={{ background: '#0F766E', color: 'white', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999 }}>
                      {tagMeta(t).emoji} {tagMeta(t).label}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={save} disabled={saving} style={{
                  background: colors.brand, color: 'white', border: 'none', borderRadius: 8,
                  padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
                }}>{saving ? 'Saving…' : 'Save'}</button>
                {savedFlash && <span style={{ fontSize: 12, color: '#065F46', fontWeight: 700 }}>✓ Saved</span>}
              </div>
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}

function toggleRemove(draft, setDraft, t) {
  const ov = draft?.nasiha_tag_overrides || { force_add: [], force_remove: [] }
  const cur = new Set(Array.isArray(ov.force_remove) ? ov.force_remove : [])
  if (cur.has(t)) cur.delete(t); else cur.add(t)
  setDraft({ ...draft, nasiha_tag_overrides: { ...ov, force_remove: [...cur] } })
}
function toggleAdd(draft, setDraft, t) {
  const ov = draft?.nasiha_tag_overrides || { force_add: [], force_remove: [] }
  const cur = new Set(Array.isArray(ov.force_add) ? ov.force_add : [])
  if (cur.has(t)) cur.delete(t); else cur.add(t)
  setDraft({ ...draft, nasiha_tag_overrides: { ...ov, force_add: [...cur] } })
}

function Block({ label, value }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#1C2B3A', lineHeight: 1.4 }}>{value}</div>
    </div>
  )
}
function FieldLabel({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: '#1C2B3A', marginBottom: 4, marginTop: 10 }}>{children}</div>
}
function ChipInput({ values, onChange, placeholder }) {
  const [draft, setDraft] = useState('')
  function add() {
    const t = draft.trim()
    if (!t) return
    if (!values.includes(t)) onChange([...values, t])
    setDraft('')
  }
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
        {values.map(v => (
          <span key={v} style={{ background: '#FFF3CD', color: '#9A6D00', fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            ★ {v}
            <button onClick={() => onChange(values.filter(x => x !== v))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9A6D00', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        onBlur={add}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  )
}

const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)', fontSize: 13, fontFamily: 'inherit' }
const textareaStyle = { ...inputStyle, resize: 'vertical' }
const pillBtn = { background: colors.deep, color: 'white', border: 'none', borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }
const chipBtn = { fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 999, marginRight: 4, marginBottom: 4, cursor: 'pointer', border: '1px solid transparent' }

function tabStyle(active) {
  return {
    flex: 1, padding: '10px 14px', borderRadius: 10, border: 'none',
    background: active ? colors.deep : 'white',
    color: active ? 'white' : '#1C2B3A',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
  }
}
