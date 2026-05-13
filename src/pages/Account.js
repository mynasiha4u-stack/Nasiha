import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import { colors, headerGradient } from '../theme'

export default function Account() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading, signOut } = useAuth()

  const [myCount, setMyCount] = useState(null)
  const [pendingReviewCount, setPendingReviewCount] = useState(null)

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=${encodeURIComponent('/account')}`)
    }
  }, [authLoading, user, navigate])

  useEffect(() => {
    if (!user) return
    async function loadCounts() {
      // My listings count
      const { count: my } = await supabase.from('content')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id)
      setMyCount(my || 0)

      // Pending review count (admin only — exclude own data)
      if (profile?.is_admin) {
        const { count: pending } = await supabase.from('content')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .not('submitted_by', 'is', null)
          .neq('owner_id', user.id)
        setPendingReviewCount(pending || 0)
      }
    }
    loadCounts()
  }, [user, profile])

  if (authLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#6A7A8A' }}>Loading…</div>
  if (!user) return null

  const displayName = profile?.display_name || user.email?.split('@')[0]

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#F7F3EE', minHeight: '100vh', paddingBottom: 100 }}>
      <div style={{ background: headerGradient, padding: '48px 20px 32px' }}>
        <div style={{ marginBottom: 10 }}><TopBar /></div>
        <div style={{ marginBottom: 18 }}>
          <button onClick={() => navigate('/')} style={{ fontSize: 13, fontWeight: 700, color: '#1C2B3A', display: 'inline-block', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 999 }}>← Home</button>
        </div>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: colors.brand, color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, fontWeight: 800,
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          marginBottom: 12,
        }}>
          {(displayName || '?').charAt(0).toUpperCase()}
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1C2B3A', marginBottom: 2 }}>{displayName}</h1>
        <div style={{ fontSize: 13, color: 'rgba(28,43,58,0.65)' }}>{user.email}</div>
        {profile?.is_admin && (
          <div style={{
            display: 'inline-block',
            marginTop: 8,
            fontSize: 10, fontWeight: 700,
            color: colors.brand,
            background: 'rgba(194,65,12,0.1)',
            padding: '3px 9px', borderRadius: 999,
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>⚖️ Admin</div>
        )}
      </div>

      <div style={{ padding: '16px' }}>
        <Card
          icon="📋"
          title="My listings"
          description="See and manage your submissions"
          badge={myCount !== null ? String(myCount) : '...'}
          onClick={() => navigate('/my-listings')}
        />

        {profile?.is_admin && (
          <Card
            icon="⚖️"
            title="Admin · Review"
            description="Approve or reject submissions"
            badge={pendingReviewCount !== null ? String(pendingReviewCount) : '...'}
            badgeUrgent={pendingReviewCount > 0}
            onClick={() => navigate('/admin/review')}
          />
        )}

        <Card
          icon="✉️"
          title="Email preferences"
          description="Newsletter and notifications"
          onClick={() => navigate('/account/email')}
        />

        <Card
          icon="⚙️"
          title="Profile settings"
          description="Name and password"
          onClick={() => navigate('/account/profile')}
        />

        <button
          onClick={async () => { await signOut(); navigate('/') }}
          style={{
            width: '100%', marginTop: 20, padding: '13px 0',
            background: 'white', color: '#9A3A3A',
            border: '1px solid rgba(154,58,58,0.2)',
            borderRadius: 12, fontSize: 14, fontWeight: 700,
            cursor: 'pointer',
          }}>
          Sign out
        </button>
      </div>

      <BottomNav />
    </div>
  )
}

function Card({ icon, title, description, badge, badgeUrgent, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%',
      display: 'flex', alignItems: 'center', gap: 14,
      background: 'white',
      border: '1px solid rgba(0,0,0,0.06)',
      borderRadius: 14, padding: '14px 16px',
      marginBottom: 10,
      cursor: 'pointer',
      textAlign: 'left',
      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
    }}>
      <div style={{ fontSize: 24, lineHeight: 1 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1C2B3A', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#6A7A8A' }}>{description}</div>
      </div>
      {badge !== undefined && (
        <div style={{
          background: badgeUrgent ? colors.brand : '#F0EEE9',
          color: badgeUrgent ? 'white' : '#3A4A5A',
          fontSize: 12, fontWeight: 800,
          minWidth: 24, height: 24, borderRadius: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 8px',
        }}>{badge}</div>
      )}
      <div style={{ fontSize: 18, color: '#9AA5B0', marginLeft: 4 }}>›</div>
    </button>
  )
}
