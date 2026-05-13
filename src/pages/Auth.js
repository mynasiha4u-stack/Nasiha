import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import TopBar from '../components/TopBar'
import { colors, headerGradient } from '../theme'

/**
 * Two-step auth flow:
 *
 * Step 1 (email): user types email → we call check-email Edge Function
 * Step 2 (depends on lookup result):
 *   - "not_found"             → signup form (name + password + newsletter checkbox)
 *   - "subscriber_no_password" → "Welcome back, set a password to start posting" (password only)
 *   - "full_user"             → "Welcome back, log in" (password only)
 */
export default function Auth() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirectTo = params.get('redirect') || '/'
  const { signIn, signUp, signInWithGoogle } = useAuth()

  // Step state
  const [step, setStep] = useState('email')  // 'email' or 'password'
  const [lookup, setLookup] = useState(null)  // result from check-email: {status, display_name}

  // Form fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [newsletter, setNewsletter] = useState(true)  // default ON for new signups

  // UI state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  // Step 1: email lookup
  const handleEmailContinue = async (e) => {
    e?.preventDefault()
    setError('')
    setInfo('')
    if (!email.includes('@')) { setError('Please enter a valid email.'); return }
    setSubmitting(true)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('check-email', {
        body: { email: email.toLowerCase().trim() },
      })
      if (fnError) {
        // If the lookup function fails, fall back to treating as new
        console.warn('check-email failed:', fnError)
        setLookup({ status: 'not_found' })
      } else {
        setLookup(data)
      }
      setStep('password')
    } finally {
      setSubmitting(false)
    }
  }

  // Step 2: handle the appropriate action based on lookup
  const handleStep2 = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setSubmitting(true)
    try {
      if (lookup?.status === 'full_user') {
        // Just log in
        const { error } = await signIn(email, password)
        if (error) { setError(error.message); return }
        navigate(redirectTo)
        return
      }

      if (lookup?.status === 'subscriber_no_password') {
        // User exists from newsletter signup — they need to set a password.
        // Use Supabase's password reset flow which functions as a "set initial password" flow.
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        })
        if (error) { setError(error.message); return }
        setInfo(`We sent a link to ${email} — click it to set your password and finish creating your account.`)
        return
      }

      // not_found → new signup
      if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
      if (!displayName.trim()) { setError('Please enter your name.'); return }

      const { data, error } = await signUp(email, password, displayName)
      if (error) { setError(error.message); return }

      // If they checked the newsletter box, subscribe them
      if (newsletter && data?.user) {
        // Fire-and-forget — don't block signup on Beehiiv hiccups
        supabase.functions.invoke('subscribe-newsletter', {
          body: { email, source: 'signup_flow' },
        }).catch(e => console.warn('Newsletter signup failed:', e))
      }

      setInfo('Check your email to confirm your account, then come back and log in.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    const { error } = await signInWithGoogle()
    if (error) setError(error.message)
  }

  const goBackToEmail = () => {
    setStep('email')
    setLookup(null)
    setPassword('')
    setDisplayName('')
    setError('')
    setInfo('')
  }

  // Determine title and subhead based on step + lookup
  const { title, subhead } = getHeading(step, lookup)

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#F7F3EE', minHeight: '100vh' }}>
      <div style={{ background: headerGradient, padding: '48px 20px 22px' }}>
        <div style={{ marginBottom: 10 }}>
          <TopBar />
        </div>
        <div style={{ marginBottom: 14 }}>
          <button onClick={() => step === 'password' ? goBackToEmail() : navigate(-1)} style={{ fontSize: 13, fontWeight: 700, color: colors.deep, display: 'inline-block', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 999 }}>← Back</button>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1C2B3A', marginBottom: 4 }}>{title}</h1>
        <p style={{ fontSize: 13, color: 'rgba(28,43,58,0.7)' }}>{subhead}</p>
      </div>

      <div style={{ padding: '20px 20px 40px' }}>
        {step === 'email' && (
          <>
            <button onClick={handleGoogle} type="button" style={googleBtnStyle}>
              <GoogleIcon /> Continue with Google
            </button>

            <div style={dividerStyle}>
              <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.1)' }} />
              <span style={{ fontSize: 11, color: '#6A7A8A', fontWeight: 600 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.1)' }} />
            </div>

            <form onSubmit={handleEmailContinue}>
              <Field label="Email">
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={inputStyle}
                />
              </Field>

              {error && <ErrorMsg>{error}</ErrorMsg>}

              <button type="submit" disabled={submitting} style={primaryBtnStyle}>
                {submitting ? '...' : 'Continue'}
              </button>
            </form>
          </>
        )}

        {step === 'password' && (
          <form onSubmit={handleStep2}>
            <div style={{ background: 'white', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13, color: '#3A4A5A', border: '1px solid rgba(0,0,0,0.06)' }}>
              📧 {email}
            </div>

            {lookup?.status === 'not_found' && (
              <>
                <Field label="Your name">
                  <input
                    type="text"
                    required
                    autoFocus
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="What should we call you?"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Password">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    style={inputStyle}
                  />
                </Field>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newsletter}
                    onChange={e => setNewsletter(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: colors.brand, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, color: '#3A4A5A' }}>
                    Subscribe to the weekly Nasiha newsletter
                  </span>
                </label>
              </>
            )}

            {lookup?.status === 'full_user' && (
              <Field label="Password">
                <input
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            )}

            {/* No password field for subscriber_no_password — they'll get an email */}

            {error && <ErrorMsg>{error}</ErrorMsg>}
            {info && <InfoMsg>{info}</InfoMsg>}

            <button type="submit" disabled={submitting} style={primaryBtnStyle}>
              {submitting ? '...' : getStep2ButtonLabel(lookup)}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function getHeading(step, lookup) {
  if (step === 'email') {
    return {
      title: 'Welcome to Nasiha',
      subhead: 'Sign in or create your account to post listings.',
    }
  }
  if (lookup?.status === 'full_user') {
    return {
      title: `Welcome back${lookup.display_name ? `, ${lookup.display_name}` : ''}`,
      subhead: 'Enter your password to log in.',
    }
  }
  if (lookup?.status === 'subscriber_no_password') {
    return {
      title: 'One more step',
      subhead: `You're already on our newsletter. Set a password to start posting.`,
    }
  }
  return {
    title: 'Create your account',
    subhead: 'Just a few details to get you started.',
  }
}

function getStep2ButtonLabel(lookup) {
  if (lookup?.status === 'full_user') return 'Log in'
  if (lookup?.status === 'subscriber_no_password') return 'Send me a link'
  return 'Create account'
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#3A4A5A', letterSpacing: 0.5, marginBottom: 5, textTransform: 'uppercase' }}>{label}</div>
      {children}
    </div>
  )
}

function ErrorMsg({ children }) {
  return <div style={{ color: '#9A3A3A', fontSize: 12, marginBottom: 12, fontWeight: 600 }}>{children}</div>
}
function InfoMsg({ children }) {
  return <div style={{ color: '#0F766E', fontSize: 12, marginBottom: 12, fontWeight: 600, background: '#E0F7F5', padding: 12, borderRadius: 10 }}>{children}</div>
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

const primaryBtnStyle = {
  width: '100%', padding: '13px 0',
  background: colors.brand, color: 'white', border: 'none',
  borderRadius: 12, fontSize: 14, fontWeight: 800,
  cursor: 'pointer',
}

const googleBtnStyle = {
  width: '100%', padding: '13px 0',
  background: 'white', border: '1.5px solid rgba(0,0,0,0.12)',
  borderRadius: 12, cursor: 'pointer',
  fontSize: 14, fontWeight: 700, color: '#1C2B3A',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  marginBottom: 14,
}

const dividerStyle = {
  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
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
