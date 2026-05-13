import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import { colors, headerGradient } from '../theme'

const STATUS_COLORS = {
  pending:   { bg: '#FEF3C7', color: '#92400E', label: '⏳ Pending review' },
  published: { bg: '#D1FAE5', color: '#065F46', label: '✅ Published' },
  rejected:  { bg: '#FEE2E2', color: '#991B1B', label: '✕ Rejected' },
  approved:  { bg: '#D1FAE5', color: '#065F46', label: '✅ Published' },
  paused:    { bg: '#E5E7EB', color: '#374151', label: '⏸ Paused' },
}

export default function MyListings() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  const [listings, setListings] = useState([])
  const [categories, setCategories] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')  // all, pending, published, rejected, paused
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')  // 'all' or a category id

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=${encodeURIComponent('/my-listings')}`)
    }
  }, [authLoading, user, navigate])

  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      // Load categories for label lookup
      const { data: cats } = await supabase.from('categories').select('id, slug, name')
      const catMap = {}
      ;(cats || []).forEach(c => { catMap[c.id] = c })
      setCategories(catMap)

      // Load user's listings, paginating to bypass Supabase's hard 1000-row
      // per-request cap. Loop fetching 1000 rows at a time until we have all.
      let all = []
      let offset = 0
      const chunkSize = 1000
      while (true) {
        const { data: chunk, error } = await supabase.from('content')
          .select('id, name, status, category_id, submitted_at, reviewed_at, review_notes, url_slug, image_url, event_date, address')
          .eq('owner_id', user.id)
          .order('submitted_at', { ascending: false })
          .range(offset, offset + chunkSize - 1)
        if (error) {
          console.warn('Failed to load listings chunk:', error)
          break
        }
        if (!chunk || chunk.length === 0) break
        all = all.concat(chunk)
        if (chunk.length < chunkSize) break  // last page
        offset += chunkSize
      }
      setListings(all)
      setLoading(false)
    }
    load()
  }, [user])

  const handleDelete = async (listing) => {
    if (!confirm(`Delete "${listing.name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('content').delete().eq('id', listing.id)
    if (error) { alert(`Couldn't delete: ${error.message}`); return }
    setListings(prev => prev.filter(l => l.id !== listing.id))
  }

  // Toggle pause: published → paused (hidden from public), paused → published
  // 'paused' is a non-standard status we treat as 'hidden'; admin doesn't see these in review queue
  const handleTogglePause = async (listing) => {
    const newStatus = listing.status === 'paused' ? 'published' : 'paused'
    const { error } = await supabase.from('content').update({ status: newStatus }).eq('id', listing.id)
    if (error) { alert(`Couldn't ${newStatus === 'paused' ? 'pause' : 'unpause'}: ${error.message}`); return }
    setListings(prev => prev.map(l => l.id === listing.id ? { ...l, status: newStatus } : l))
  }

  // Share: copy public URL to clipboard
  const handleShare = async (listing) => {
    const cat = categories[listing.category_id]
    if (!cat?.slug) { alert('Cannot share — category missing'); return }
    const slugForUrl = listing.url_slug || listing.id
    const url = `${window.location.origin}/${cat.slug}/${slugForUrl}`
    // Try clipboard API first; fall back to a prompt
    try {
      await navigator.clipboard.writeText(url)
      alert('Link copied to clipboard!')
    } catch {
      // Fallback for older browsers
      window.prompt('Copy this link:', url)
    }
  }

  const filtered = listings.filter(l => {
    // Status filter
    if (filter !== 'all') {
      if (filter === 'published') {
        if (l.status !== 'published' && l.status !== 'approved') return false
      } else if (l.status !== filter) return false
    }
    // Category filter
    if (categoryFilter !== 'all' && l.category_id !== categoryFilter) return false
    // Search filter (name + address)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      const inName = l.name?.toLowerCase().includes(q)
      const inAddress = l.address?.toLowerCase().includes(q)
      if (!inName && !inAddress) return false
    }
    return true
  })

  if (authLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#6A7A8A' }}>Loading…</div>
  if (!user) return null

  // Admin view: show "All submissions" toggle to review others' pending listings
  const isAdmin = profile?.is_admin

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#F7F3EE', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: headerGradient, padding: '48px 20px 22px' }}>
        <div style={{ marginBottom: 10 }}><TopBar /></div>
        <div style={{ marginBottom: 14 }}>
          <button onClick={() => navigate('/')} style={{ fontSize: 13, fontWeight: 700, color: '#1C2B3A', display: 'inline-block', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 999 }}>← Home</button>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1C2B3A', marginBottom: 4 }}>My listings</h1>
        <p style={{ fontSize: 13, color: 'rgba(28,43,58,0.7)' }}>
          {listings.length} total · manage and track your submissions
        </p>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Search bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', borderRadius: 12, padding: '11px 14px', marginBottom: 10, border: '1px solid rgba(0,0,0,0.08)' }}>
          <span style={{ fontSize: 16, opacity: 0.5 }}>🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name or address..."
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: 14, color: '#1C2B3A', background: 'transparent',
              fontFamily: 'inherit', padding: 0, minWidth: 0,
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: '#6A7A8A', padding: '2px 6px',
            }}>✕</button>
          )}
        </div>

        {/* Category dropdown */}
        <div style={{ marginBottom: 10 }}>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px',
              border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12,
              fontSize: 13, fontWeight: 600, color: '#1C2B3A',
              background: 'white', cursor: 'pointer',
              fontFamily: 'inherit', appearance: 'menulist',
            }}
          >
            <option value="all">All categories</option>
            {Object.values(categories)
              .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
              .map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
          </select>
        </div>

        {/* Status filter chips */}
        <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            { key: 'all',       label: 'All' },
            { key: 'pending',   label: 'Pending' },
            { key: 'published', label: 'Published' },
            { key: 'paused',    label: 'Paused' },
            { key: 'rejected',  label: 'Rejected' },
          ].map(f => {
            // Compute count after applying search + category, but ignoring status
            const count = listings.filter(l => {
              if (categoryFilter !== 'all' && l.category_id !== categoryFilter) return false
              if (searchQuery.trim()) {
                const q = searchQuery.trim().toLowerCase()
                const inName = l.name?.toLowerCase().includes(q)
                const inAddress = l.address?.toLowerCase().includes(q)
                if (!inName && !inAddress) return false
              }
              if (f.key === 'all') return true
              if (f.key === 'published') return l.status === 'published' || l.status === 'approved'
              return l.status === f.key
            }).length
            return (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(0,0,0,0.1)',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: filter === f.key ? '#1C2B3A' : 'white',
                color: filter === f.key ? 'white' : '#1a2a3a',
              }}>{f.label} ({count})</button>
            )
          })}
        </div>

        {/* Add new button */}
        <button onClick={() => navigate('/submit')} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '13px 0', marginBottom: 14,
          background: colors.brand, color: 'white', border: 'none',
          borderRadius: 12, cursor: 'pointer', fontSize: 14, fontWeight: 800,
        }}>+ Add a new listing</button>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6A7A8A' }}>Loading…</div>
        ) : isAdmin && listings.length > 100 ? (
          // Admin sees ALL their owned listings, but we don't show all 7,527 by default — show a hint
          <>
            <div style={{ background: 'white', borderRadius: 12, padding: 14, marginBottom: 14, fontSize: 12, color: '#3A4A5A', border: '1px solid rgba(0,0,0,0.06)' }}>
              <strong>Admin note:</strong> You own {listings.length} listings (most are seeded data). Use the filter chips above to narrow to specific statuses.
            </div>
            <ListingRows listings={filtered.slice(0, 50)} categories={categories} onDelete={handleDelete} onEdit={(l) => navigate(`/submit?edit=${l.id}`)} onDuplicate={(l) => navigate(`/submit?duplicate=${l.id}`)} onTogglePause={handleTogglePause} onShare={handleShare} />
            {filtered.length > 50 && (
              <div style={{ textAlign: 'center', padding: 16, color: '#6A7A8A', fontSize: 12 }}>
                Showing first 50 of {filtered.length}. Full admin tools coming soon.
              </div>
            )}
          </>
        ) : filtered.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 14, padding: 40, textAlign: 'center', border: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1C2B3A', marginBottom: 6 }}>
              {filter === 'all' ? 'No listings yet' : `No ${filter} listings`}
            </div>
            <div style={{ fontSize: 12, color: '#6A7A8A' }}>
              {filter === 'all' && 'Submit your first listing to see it here.'}
            </div>
          </div>
        ) : (
          <ListingRows listings={filtered} categories={categories} onDelete={handleDelete} onEdit={(l) => navigate(`/submit?edit=${l.id}`)} onDuplicate={(l) => navigate(`/submit?duplicate=${l.id}`)} onTogglePause={handleTogglePause} onShare={handleShare} />
        )}
      </div>

      <BottomNav />
    </div>
  )
}

function ListingRows({ listings, categories, onDelete, onEdit, onDuplicate, onTogglePause, onShare }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {listings.map(l => {
        const cat = categories[l.category_id]
        const status = STATUS_COLORS[l.status] || STATUS_COLORS.pending
        const isPublished = l.status === 'published' || l.status === 'approved'
        const isPaused = l.status === 'paused'
        return (
          <div key={l.id} style={{
            background: 'white', borderRadius: 12, padding: 14,
            border: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6A7A8A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
                  {cat?.name || 'Listing'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B3A', lineHeight: 1.3 }}>{l.name}</div>
                {l.address && <div style={{ fontSize: 11, color: '#6A7A8A', marginTop: 3 }}>📍 {l.address}</div>}
                {l.event_date && <div style={{ fontSize: 11, color: '#6A7A8A', marginTop: 3 }}>📅 {l.event_date}</div>}
              </div>
              <div style={{
                background: status.bg, color: status.color,
                fontSize: 10, fontWeight: 700,
                padding: '4px 8px', borderRadius: 6,
                whiteSpace: 'nowrap',
              }}>{status.label}</div>
            </div>

            {l.review_notes && l.status === 'rejected' && (
              <div style={{ fontSize: 11, color: '#991B1B', marginBottom: 8, padding: 8, background: '#FEE2E2', borderRadius: 6 }}>
                <strong>Why:</strong> {l.review_notes}
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => onEdit(l)} style={smallBtn}>Edit</button>
              {(isPublished || isPaused) && (
                <button onClick={() => onTogglePause(l)} style={smallBtn}>
                  {isPaused ? 'Unpause' : 'Pause'}
                </button>
              )}
              <button onClick={() => onDuplicate(l)} style={smallBtn}>Duplicate</button>
              {isPublished && <button onClick={() => onShare(l)} style={smallBtn}>Share</button>}
              <button onClick={() => onDelete(l)} style={{ ...smallBtn, color: '#991B1B' }}>Delete</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const smallBtn = {
  background: '#F7F3EE', border: 'none',
  padding: '6px 12px', borderRadius: 8,
  fontSize: 11, fontWeight: 700, color: '#3A4A5A',
  cursor: 'pointer',
}
