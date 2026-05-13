import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import { colors, headerGradient } from '../theme'

export default function ProfileSettings() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()

  const [displayName, setDisplayName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [savingName, setSavingName] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [nameMsg, setNameMsg] = useState({ type: '', text: '' })  // {type: 'success'|'error', text}
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' })

  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/auth?redirect=${encodeURIComponent('/account/profile')}`)
    }
  }, [authLoading, user, navigate])

  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name)
  }, [profile])

  const handleSaveName = async () => {
    setNameMsg({ type: '', text: '' })
    if (!displayName.trim()) {
      setNameMsg({ type: 'error', text: 'Name cannot be empty.' })
      return
    }
    setSavingName(true)
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ display_name: displayName.trim() })
        .eq('id', user.id)
      if (error) { setNameMsg({ type: 'error', text: error.message }); return }
      await refreshProfile()
      setNameMsg({ type: 'success', text: 'Saved.' })
    } finally {
      setSavingName(false)
    }
  }

  const handleSavePassword = async () => {
    setPwMsg({ type: '', text: '' })
    if (newPassword.length < 6) {
      setPwMsg({ type: 'error', text: 'Password must be at least 6 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'Passwords don\'t match.' })
      return
    }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) { setPwMsg({ type: 'error', text: error.message }); return }
      setNewPassword('')
      setConfirmPassword('')
      setPwMsg({ type: 'success', text: 'Password updated.' })
    } finally {
      setSavingPassword(false)
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
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1C2B3A', marginBottom: 4 }}>Profile settings</h1>
        <p style={{ fontSize: 13, color: 'rgba(28,43,58,0.7)' }}>Update your name and password.</p>
      </div>

      <div style={{ padding: '20px 16px' }}>
        {/* Name */}
        <Section title="Display name">
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="What should we call you?"
            style={inputStyle}
          />
          {nameMsg.text && <Message type={nameMsg.type}>{nameMsg.text}</Message>}
          <button onClick={handleSaveName} disabled={savingName} style={primaryBtnStyle}>
            {savingName ? 'Saving...' : 'Save name'}
          </button>
        </Section>

        {/* Email (read-only) */}
        <Section title="Email">
          <div style={{ ...inputStyle, background: '#F7F3EE', color: '#6A7A8A' }}>{user.email}</div>
          <div style={{ fontSize: 11, color: '#6A7A8A', marginTop: 4 }}>Contact us to change your email.</div>
        </Section>

        {/* Password */}
        <Section title="Change password">
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="New password (min 6 characters)"
            style={inputStyle}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            style={{ ...inputStyle, marginTop: 8 }}
          />
          {pwMsg.text && <Message type={pwMsg.type}>{pwMsg.text}</Message>}
          <button onClick={handleSavePassword} disabled={savingPassword} style={primaryBtnStyle}>
            {savingPassword ? 'Saving...' : 'Update password'}
          </button>
        </Section>
      </div>

      <BottomNav />
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: 16, marginBottom: 14, border: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#3A4A5A', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

function Message({ type, children }) {
  const isError = type === 'error'
  return (
    <div style={{
      fontSize: 12, fontWeight: 600,
      color: isError ? '#9A3A3A' : '#0F766E',
      background: isError ? '#FEE2E2' : '#E0F7F5',
      padding: '8px 10px', borderRadius: 8, marginTop: 8,
    }}>{children}</div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '11px 13px',
  border: '1.5px solid rgba(0,0,0,0.1)',
  borderRadius: 10,
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  background: 'white',
}

const primaryBtnStyle = {
  width: '100%', marginTop: 10, padding: '11px 0',
  background: colors.brand, color: 'white', border: 'none',
  borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
}
