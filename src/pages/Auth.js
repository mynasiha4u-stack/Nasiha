import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import TopBar from '../components/TopBar'
import { colors, headerGradient } from '../theme'

export default function Auth() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initialMode = params.get('mode') === 'signup' ? 'signup' : 'login'
  const redirectTo = params.get('redirect') || '/'

  const { signIn, signUp, signInWithGoogle } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setSubmitting(true)
    try {
      if (mode === 'signup') {
        if (password.length < 6) {
          setError('Password must be at least 6 characters.')
          return
        }
        const { error } = await signUp(email, password, displayName)
        if (error) { setError(error.message); return }
        setInfo('Check your email to confirm your account, then come back and sign in.')
      } else {
        const { error } = await signIn(email, password)
        if (error) { setError(error.message); return }
        navigate(redirectTo)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    const { error } = await signInWithGoogle()
    if (error) setError(error.message)
    // Google redirects away — no need to navigate
  }

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#F7F3EE', minHeight: '100vh' }}>
      <div style={{ background: headerGradient, padding: '48px 20px 22px' }}>
        <div style={{ marginBottom: 10 }}>
          <TopBar />
        </div>
        <div style={{ marginBottom: 14 }}>
          <button onClick={() => navigate(-1)} style={{ fontSize: 13, fontWeight: 700, color: colors.deep, display: 'inline-block', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 999 }}>← Back</button>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1C2B3A', marginBottom: 4 }}>
          {mode === 'signup' ? 'Join Nasiha' : 'Welcome back'}
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(28,43,58,0.7)' }}>
          {mode === 'signup' ? 'Create an account to post listings, contact vendors, and more.' : 'Log in to your account.'}
        </p>
      </div>

      <div style={{ padding: '20px 20px 40px' }}>
        {/* Google sign-in */}
        <button onClick={handleGoogle} type="button" style={{
          width: '100%', padding: '13px 0',
          background: 'white', border: '1.5px solid rgba(0,0,0,0.12)',
          borderRadius: 12, cursor: 'pointer',
          fontSize: 14, fontWeight: 700, color: '#1C2B3A',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          marginBottom: 14,
        }}>
          <GoogleIcon /> Continue with Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.1)' }} />
          <span style={{ fontSize: 11, color: '#6A7A8A', fontWeight: 600 }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.1)' }} />
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <Field label="Your name">
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="What should we call you?"
                style={inputStyle}
              />
            </Field>
          )}

          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'At least 6 characters' : ''}
              style={inputStyle}
            />
          </Field>

          {error && <div style={{ color: '#9A3A3A', fontSize: 12, marginBottom: 12, fontWeight: 600 }}>{error}</div>}
          {info && <div style={{ color: '#0F766E', fontSize: 12, marginBottom: 12, fontWeight: 600, background: '#E0F7F5', padding: 12, borderRadius: 10 }}>{info}</div>}

          <button type="submit" disabled={submitting} style={{
            width: '100%', padding: '13px 0',
            background: colors.brand, color: 'white', border: 'none',
            borderRadius: 12, fontSize: 14, fontWeight: 800,
            cursor: submitting ? 'wait' : 'pointer',
            opacity: submitting ? 0.7 : 1,
            marginBottom: 14,
          }}>
            {submitting ? '...' : (mode === 'signup' ? 'Create account' : 'Log in')}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: 13, color: '#3A4A5A' }}>
          {mode === 'signup' ? (
            <>Already have an account?{' '}
              <button onClick={() => { setMode('login'); setError('') }} style={linkStyle}>Log in</button>
            </>
          ) : (
            <>New to Nasiha?{' '}
              <button onClick={() => { setMode('signup'); setError('') }} style={linkStyle}>Create an account</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#3A4A5A', letterSpacing: 0.5, marginBottom: 5, textTransform: 'uppercase' }}>{label}</div>
      {children}
    </div>
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
}

const linkStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: colors.brand, fontSize: 13, fontWeight: 700, padding: 0,
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
