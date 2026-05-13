import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import { colors, headerGradient } from '../theme'

const STATUS_COLORS = {
  pending:   { bg: '#FEF3C7', color: '#92400E', label: '⏳ Pending' },
  published: { bg: '#D1FAE5', color: '#065F46', label: '✅ Published' },
  rejected:  { bg: '#FEE2E2', color: '#991B1B', label: '✕ Rejected' },
  approved:  { bg: '#D1FAE5', color: '#065F46', label: '✅ Published' },
}

/**
 * Admin review dashboard.
 * Lists submissions by status with approve/reject actions.
 * Only accessible to users with profile.is_admin = true.
 */
export default function AdminReview() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  const [listings, setListings] = useState([])
  const [categories, setCategories] = useState({})
  const [submitters, setSubmitters] = useState({})  // owner_id → email + display_name
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')  // pending, published, rejected
  const [actionInProgress, setActionInProgress] = useState(null)  // listing id

  // Auth check: must be logged in and admin
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent('/admin/review')}`)
      return
    }
    if (profile && !profile.is_admin) {
      // Logged in but not admin — bounce to home
      navigate('/')
    }
  }, [authLoading, user, profile, navigate])

  // Load submissions (only user-submitted ones, not seeded data owned by Nas as admin)
  useEffect(() => {
    if (!user || !profile?.is_admin) return
    async function load() {
      setLoading(true)
      const { data: cats } = await supabase.from('categories').select('id, slug, name')
      const catMap = {}
      ;(cats || []).forEach(c => { catMap[c.id] = c })
      setCategories(catMap)

      // Get pending/recently approved/rejected listings, EXCLUDING admin's own seeded data
      // We filter to listings that have submitted_by set (real user submissions, not bulk imports)
      let query = supabase.from('content')
        .select('*')
        .order('submitted_at', { ascending: false, nullsFirst: false })
        .not('submitted_by', 'is', null)
        .neq('owner_id', user.id)  // exclude Nas's own seeded content
        .range(0, 499)  // first 500 of each status

      if (filter === 'pending') query = query.eq('status', 'pending')
      else if (filter === 'published') query = query.in('status', ['published', 'approved'])
      else if (filter === 'rejected') query = query.eq('status', 'rejected')

      const { data, error } = await query

      if (error) console.warn('Failed to load submissions:', error)
      setListings(data || [])

      // Look up submitters (display names)
      const submitterIds = [...new Set((data || []).map(d => d.owner_id).filter(Boolean))]
      if (submitterIds.length) {
        const { data: profiles } = await supabase.from('user_profiles')
          .select('id, display_name')
          .in('id', submitterIds)
        const subMap = {}
        ;(profiles || []).forEach(p => { subMap[p.id] = p })
        setSubmitters(subMap)
      }

      setLoading(false)
    }
    load()
  }, [user, profile, filter])

  const handleApprove = async (listing) => {
    setActionInProgress(listing.id)
    try {
      const { error } = await supabase.from('content')
        .update({
          status: 'published',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', listing.id)
      if (error) { alert(`Couldn't approve: ${error.message}`); return }
      // Remove from current list
      setListings(prev => prev.filter(l => l.id !== listing.id))
    } finally {
      setActionInProgress(null)
    }
  }

  const handleReject = async (listing) => {
    const reason = prompt(`Why are you rejecting "${listing.name}"?\n\nThis reason will be visible to the submitter.`)
    if (reason === null) return  // cancelled
    if (!reason.trim()) {
      if (!confirm('No reason given. Reject anyway?')) return
    }
    setActionInProgress(listing.id)
    try {
      const { error } = await supabase.from('content')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          review_notes: reason.trim() || null,
        })
        .eq('id', listing.id)
      if (error) { alert(`Couldn't reject: ${error.message}`); return }
      setListings(prev => prev.filter(l => l.id !== listing.id))
    } finally {
      setActionInProgress(null)
    }
  }

  if (authLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#6A7A8A' }}>Loading…</div>
  if (!user || !profile?.is_admin) return null

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#F7F3EE', minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: headerGradient, padding: '48px 20px 22px' }}>
        <div style={{ marginBottom: 10 }}><TopBar /></div>
        <div style={{ marginBottom: 14 }}>
          <button onClick={() => navigate('/')} style={{ fontSize: 13, fontWeight: 700, color: '#1C2B3A', display: 'inline-block', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 999 }}>← Home</button>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1C2B3A', marginBottom: 4 }}>Admin · Review</h1>
        <p style={{ fontSize: 13, color: 'rgba(28,43,58,0.7)' }}>
          Approve or reject user-submitted listings.
        </p>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            { key: 'pending',   label: 'Pending' },
            { key: 'published', label: 'Recently approved' },
            { key: 'rejected',  label: 'Recently rejected' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: '7px 14px', borderRadius: 20, border: '1px solid rgba(0,0,0,0.1)',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: filter === f.key ? '#1C2B3A' : 'white',
              color: filter === f.key ? 'white' : '#1a2a3a',
            }}>{f.label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6A7A8A' }}>Loading submissions…</div>
        ) : listings.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 14, padding: 40, textAlign: 'center', border: '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>
              {filter === 'pending' ? '🎉' : '📭'}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1C2B3A', marginBottom: 6 }}>
              {filter === 'pending' ? 'Nothing to review!' : `No ${filter === 'published' ? 'recently approved' : 'recently rejected'} submissions`}
            </div>
            <div style={{ fontSize: 12, color: '#6A7A8A' }}>
              {filter === 'pending' && 'When users submit new listings, they\'ll appear here.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {listings.map(l => {
              const cat = categories[l.category_id]
              const status = STATUS_COLORS[l.status] || STATUS_COLORS.pending
              const submitter = submitters[l.owner_id]
              const isPending = l.status === 'pending'
              const submittedDate = l.submitted_at ? new Date(l.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
              const reviewedDate = l.reviewed_at ? new Date(l.reviewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null

              return (
                <div key={l.id} style={{
                  background: 'white', borderRadius: 14, padding: 16,
                  border: '1px solid rgba(0,0,0,0.06)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                }}>
                  {/* Header: category + status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#6A7A8A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {cat?.name || 'Listing'}
                    </div>
                    <div style={{
                      background: status.bg, color: status.color,
                      fontSize: 10, fontWeight: 700,
                      padding: '4px 8px', borderRadius: 6,
                    }}>{status.label}</div>
                  </div>

                  {/* Title */}
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1C2B3A', lineHeight: 1.3, marginBottom: 10 }}>{l.name}</div>

                  {/* Image preview if present */}
                  {l.image_url && (
                    <img src={l.image_url} alt={l.name} style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 10, marginBottom: 10 }} />
                  )}

                  {/* Details grid */}
                  <div style={{ fontSize: 12, color: '#3A4A5A', lineHeight: 1.6, marginBottom: 10 }}>
                    {l.description && <div style={{ marginBottom: 8 }}>{l.description}</div>}
                    {l.address && <div>📍 {l.address}</div>}
                    {l.event_date && <div>📅 {l.event_date}{l.event_time ? ` at ${l.event_time}` : ''}</div>}
                    {l.phone && <div>📞 {l.phone}</div>}
                    {l.email && <div>✉️ {l.email}</div>}
                    {l.website && <div>🌐 <a href={l.website} target="_blank" rel="noopener noreferrer" style={{ color: colors.brand }}>{l.website}</a></div>}
                    {l.instagram && <div>📷 {l.instagram}</div>}
                    {l.facebook && <div>👥 {l.facebook}</div>}
                    {l.hours && <div>🕐 {l.hours}</div>}
                    {l.specialty && <div>⚖️ {l.specialty}</div>}
                    {l.grades && <div>🎓 {l.grades}</div>}
                    {l.delivery && <div>🚗 {l.delivery}</div>}
                  </div>

                  {/* Rejection notes display (when not pending) */}
                  {l.review_notes && (
                    <div style={{ fontSize: 11, color: '#991B1B', padding: 8, background: '#FEE2E2', borderRadius: 6, marginBottom: 10 }}>
                      <strong>Rejection reason:</strong> {l.review_notes}
                    </div>
                  )}

                  {/* Submitter info */}
                  <div style={{ fontSize: 11, color: '#6A7A8A', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 8, marginBottom: isPending ? 10 : 0 }}>
                    Submitted by <strong>{submitter?.display_name || l.submitted_by || 'unknown'}</strong>
                    {l.submitted_by && submitter?.display_name && ` (${l.submitted_by})`}
                    {' · '}{submittedDate}
                    {reviewedDate && ` · Reviewed ${reviewedDate}`}
                  </div>

                  {/* Action buttons (pending only) */}
                  {isPending && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleApprove(l)}
                        disabled={actionInProgress === l.id}
                        style={{
                          flex: 1, padding: '10px 0',
                          background: '#0F766E', color: 'white', border: 'none',
                          borderRadius: 10, fontSize: 13, fontWeight: 700,
                          cursor: actionInProgress === l.id ? 'wait' : 'pointer',
                          opacity: actionInProgress === l.id ? 0.7 : 1,
                        }}>
                        {actionInProgress === l.id ? '...' : '✅ Approve'}
                      </button>
                      <button
                        onClick={() => handleReject(l)}
                        disabled={actionInProgress === l.id}
                        style={{
                          flex: 1, padding: '10px 0',
                          background: 'white', color: '#991B1B',
                          border: '1.5px solid #FCA5A5',
                          borderRadius: 10, fontSize: 13, fontWeight: 700,
                          cursor: actionInProgress === l.id ? 'wait' : 'pointer',
                          opacity: actionInProgress === l.id ? 0.7 : 1,
                        }}>
                        ✕ Reject
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
