import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import { colors, headerGradient } from '../theme'

export default function EmailPreferences() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()

  const [newsletter, setNewsletter] = useState(false)
  const [notifyOnReview, setNotifyOnReview] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=${encodeURIComponent('/account/email')}`)
    }
  }, [authLoading, user, navigate])

  useEffect(() => {
    if (profile) {
      setNewsletter(profile.newsletter_subscribed ?? false)
      setNotifyOnReview(profile.notify_on_review ?? true)
    }
  }, [profile])

  const handleSave = async () => {
    setMsg({ type: '', text: '' })
    setSaving(true)
    try {
      // Update notify_on_review immediately
      const { error: profileErr } = await supabase
        .from('user_profiles')
        .update({ notify_on_review: notifyOnReview })
        .eq('id', user.id)
      if (profileErr) {
        setMsg({ type: 'error', text: profileErr.message })
        return
      }

      // Handle newsletter toggle separately (calls Beehiiv via Edge Function)
      const newsletterChanged = (profile?.newsletter_subscribed ?? false) !== newsletter
      if (newsletterChanged) {
        if (newsletter) {
          // Subscribe via Edge Function
          await supabase.functions.invoke('subscribe-newsletter', {
            body: { email: user.email, source: 'account_settings' },
          })
        } else {
          // Unsubscribe: for now, just update local state. Full Beehiiv unsubscribe
          // requires a separate API call which we can add later.
          await supabase.from('user_profiles').update({ newsletter_subscribed: false }).eq('id', user.id)
        }
      }

      await refreshProfile()
      setMsg({ type: 'success', text: 'Preferences saved.' })
    } catch (e) {
      setMsg({ type: 'error', text: String(e?.message || e) })
    } finally {
      setSaving(false)
    }
  }

  if (authLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#6A7A8A' }}>Loading…</div>
  if (!user) return null

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#F7F3EE', minHeight: '100vh', paddingBottom: 100 }}>
      <div style={{ background: headerGradient, padding: '48px 20px 22px' }}>
        <div style={{ marginBottom: 10 }}><TopBar /></div>
        <div style={{ marginBottom: 14 }}>
          <button onClick={() => navigate('/account')} style={{ fontSize: 13, fontWeight: 700, color: '#1C2B3A', display: 'inline-block', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 999 }}>← Account</button>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1C2B3A', marginBottom: 4 }}>Email preferences</h1>
        <p style={{ fontSize: 13, color: 'rgba(28,43,58,0.7)' }}>Choose what we email you about.</p>
      </div>

      <div style={{ padding: '20px 16px' }}>
        <ToggleRow
          title="Weekly newsletter"
          description="Top 5 Muslim events and community updates, every Monday."
          enabled={newsletter}
          onChange={setNewsletter}
        />

        <ToggleRow
          title="Listing review notifications"
          description="Get an email when your submitted listings are approved or need changes."
          enabled={notifyOnReview}
          onChange={setNotifyOnReview}
        />

        {msg.text && (
          <div style={{
            fontSize: 12, fontWeight: 600,
            color: msg.type === 'error' ? '#9A3A3A' : '#0F766E',
            background: msg.type === 'error' ? '#FEE2E2' : '#E0F7F5',
            padding: '10px 12px', borderRadius: 10, marginTop: 14, marginBottom: 6,
          }}>{msg.text}</div>
        )}

        <button onClick={handleSave} disabled={saving} style={{
          width: '100%', marginTop: 14, padding: '13px 0',
          background: colors.brand, color: 'white', border: 'none',
          borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer',
          opacity: saving ? 0.7 : 1,
        }}>
          {saving ? 'Saving...' : 'Save preferences'}
        </button>
      </div>

      <BottomNav />
    </div>
  )
}

function ToggleRow({ title, description, enabled, onChange }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: 14, padding: 16, marginBottom: 10,
      border: '1px solid rgba(0,0,0,0.06)',
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1C2B3A', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#6A7A8A', lineHeight: 1.4 }}>{description}</div>
      </div>
      <button onClick={() => onChange(!enabled)} style={{
        position: 'relative',
        width: 48, height: 28, borderRadius: 999,
        background: enabled ? colors.brand : '#D1D5DB',
        border: 'none', cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 150ms',
        padding: 0,
      }}>
        <div style={{
          position: 'absolute',
          top: 3, left: enabled ? 23 : 3,
          width: 22, height: 22, borderRadius: '50%',
          background: 'white',
          transition: 'left 150ms',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  )
}
