import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from './BottomNav'
import { colors, headerGradient, card, radius } from '../theme'
import { supabase } from '../lib/supabase'
import {
  effectiveOccasionTags,
  effectiveTagline,
  rankTagsByRarity,
  fetchTagCounts,
  tagMeta,
} from '../lib/listingTags'

export function cleanText(text) {
  if (!text) return ''
  const nl = '\n'
  let s = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/Age Group:/g, nl + 'Age Group:')
    .replace(/Delivery Offered:/g, nl + 'Delivery Offered:')
    .replace(/On Site Prep:/g, nl + 'On Site Prep:')
    .replace(/Services Offered:/g, nl + 'Services Offered:')
    .replace(/Services:/g, nl + 'Services:')
    .replace(/Location:/g, nl + 'Location:')
    .replace(/Price:/g, nl + 'Price:')
    .replace(/Hours:/g, nl + 'Hours:')
    .replace(/Contact:/g, nl + 'Contact:')
    .replace(/About:/g, nl + 'About:')

  // Break before common transition phrases that usually start new thoughts
  const transitions = [
    'We offer', 'Our program', 'Our staff', 'Located', 'Hours are', 'Hours:',
    'Please', 'For more', 'Currently', 'We are', 'Tuition', 'Ages ',
    'We provide', 'We accept', 'Email ', 'Call ', 'Visit ', 'Cost ',
    'Pricing', 'Schedule', 'Daily ', 'Weekly ', 'Children', 'Open ',
  ]
  transitions.forEach(t => {
    const re = new RegExp('([.!?])\\s+(' + t.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&') + ')', 'g')
    s = s.replace(re, '$1' + nl + '$2')
  })

  // Group every ~2 sentences into a paragraph (heuristic for unbroken walls of text)
  s = s.split(nl).map(line => {
    if (line.length < 200) return line
    const sentences = line.match(/[^.!?]+[.!?]+/g) || [line]
    const grouped = []
    for (let i = 0; i < sentences.length; i += 2) {
      grouped.push(sentences.slice(i, i + 2).join(' ').trim())
    }
    return grouped.join(nl)
  }).join(nl)

  return s.replace(/\n{3,}/g, '\n\n').trim()
}

export function ContactRibbon({ item }) {
  const contacts = [
    item.phone    && { href: `tel:${item.phone}`,                                    icon: '📞', label: 'Call' },
    item.email    && { href: `mailto:${item.email}`,                                  icon: '✉️', label: 'Email' },
    item.whatsapp && { href: `https://wa.me/${item.whatsapp.replace(/\D/g,'')}`,      icon: '💬', label: 'WhatsApp', external: true },
    item.instagram&& { href: item.instagram,                                           ig: true,   label: 'Instagram', external: true },
    item.facebook && { href: item.facebook,                                            fb: true,   label: 'Facebook',  external: true },
    item.website  && { href: item.website.startsWith('http') ? item.website : 'https://' + item.website, icon: '🌐', label: 'Website', external: true },
  ].filter(Boolean)
  if (!contacts.length) return null
  return (
    <div style={{ ...card, padding: '4px 8px', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' }}>
      {contacts.map((c, i) => (
        <a key={i} href={c.href} target={c.external ? '_blank' : undefined} rel="noreferrer"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 8px', textDecoration: 'none', gap: 4, minWidth: 50 }}>
          {c.ig
            ? <div style={{ width: 26, height: 26, background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 800 }}>IG</div>
            : c.fb
            ? <div style={{ width: 26, height: 26, background: '#1877F2', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 15, fontWeight: 900 }}>f</div>
            : <span style={{ fontSize: 22 }}>{c.icon}</span>
          }
          <span style={{ fontSize: 10, color: colors.textSecondary, fontWeight: 600 }}>{c.label}</span>
        </a>
      ))}
    </div>
  )
}

export function ActionButtons({ item }) {
  const buttons = [
    item.phone   && { href: `tel:${item.phone}`,                                                                            label: '📞 Call',    primary: true },
    item.website && { href: item.website.startsWith('http') ? item.website : 'https://' + item.website, label: '🌐 Website', external: true },
    item.email   && { href: `mailto:${item.email}`,                                                                          label: '✉️ Email' },
  ].filter(Boolean).slice(0, 3)
  if (!buttons.length) return null
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
      {buttons.map((b, i) => (
        <a key={i} href={b.href} target={b.external ? '_blank' : undefined} rel="noreferrer"
          style={{ flex: 1, minWidth: 90, background: i === 0 ? colors.brand : 'white', border: i === 0 ? 'none' : `1px solid ${colors.border}`, borderRadius: radius.md, padding: '13px 0', color: i === 0 ? 'white' : colors.textPrimary, fontWeight: 700, fontSize: 13, textAlign: 'center', textDecoration: 'none' }}>
          {b.label}
        </a>
      ))}
    </div>
  )
}

export default function ListingDetail({ item, typeBadge, typeColor, loading, notFoundLabel = 'Not found', children }) {
  const navigate = useNavigate()

  if (loading) return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.surface }}>
      <div style={{ textAlign: 'center', color: colors.textMuted }}><div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>Loading...</div>
    </div>
  )
  if (!item) return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.surface }}>
      <div style={{ color: colors.textMuted }}>{notFoundLabel}</div>
    </div>
  )

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: colors.surface, minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ background: headerGradient, padding: '52px 20px 24px' }}>
        <button onClick={() => navigate(-1)} style={{ fontSize: 13, fontWeight: 700, color: colors.deep, marginBottom: 14, display: 'inline-block', background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: radius.full }}>← Back</button>
        {item.image_url && <img src={item.image_url} alt={item.name} style={{ width: '100%', borderRadius: radius.md, marginBottom: 14, objectFit: 'cover', maxHeight: 200 }} />}
        {/* typeBadge intentionally omitted — Nasiha does NOT render halal/category badges
            on public listing surfaces. Halal status is an admin-internal field. */}
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1C2B3A', lineHeight: 1.3, marginBottom: 6 }}>{item.name}</h1>
        <EditorialTagline item={item} />
        <div style={{ fontSize: 13, color: 'rgba(28,43,58,0.65)', marginTop: 6 }}>📍 {item.metro}{item.address ? ` · ${item.address.split(',')[0]}` : ''}</div>
        <GoogleRatingLine item={item} />
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <NasihaProTip item={item} />
        <ActionButtons item={item} />
        <ContactRibbon item={item} />
        {(item.display_lat || item.address) && (
          <div style={{ ...card, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              <div style={{ fontSize: 10, color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Location</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary }}>{item.address || item.metro}</div>
            </div>
            <a
              href={item.display_lat && item.display_lng
                ? `https://www.google.com/maps/dir/?api=1&destination=${item.display_lat},${item.display_lng}`
                : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.address)}`}
              target="_blank" rel="noreferrer"
              style={{ background: colors.brand, borderRadius: radius.sm, padding: '10px 14px', fontSize: 12, fontWeight: 700, color: 'white', textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}>
              Directions
            </a>
          </div>
        )}
        {children}
        <EnrichmentBlock item={item} />
        {item.description && (
          <div style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 10 }}>About</div>
            <div style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{cleanText(item.description)}</div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Editorial + enrichment sub-components
// ─────────────────────────────────────────────────────────────

function EditorialTagline({ item }) {
  const tagline = effectiveTagline(item)
  if (!tagline) return null
  return (
    <div style={{ fontSize: 14, color: '#3A4A5A', fontStyle: 'italic', marginTop: 4, lineHeight: 1.4 }}>
      {tagline}
    </div>
  )
}

function GoogleRatingLine({ item }) {
  if (item.google_rating == null && item.google_review_count == null) return null
  return (
    <div style={{ fontSize: 12, color: 'rgba(28,43,58,0.65)', marginTop: 4 }}>
      {item.google_rating != null && <span style={{ fontWeight: 700 }}>★ {Number(item.google_rating).toFixed(1)}</span>}
      {item.google_review_count != null && <span>{item.google_rating != null ? '  ·  ' : ''}{Number(item.google_review_count).toLocaleString()} reviews</span>}
    </div>
  )
}

function NasihaProTip({ item }) {
  if (!item.nasiha_pro_tip || !item.nasiha_pro_tip.trim()) return null
  return (
    <div style={{
      background: 'linear-gradient(135deg, #FFF8E1 0%, #FFF3CD 100%)',
      border: '1px solid #F4C430',
      borderRadius: radius.md,
      padding: '14px 16px',
      marginBottom: 14,
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#9A6D00', marginBottom: 6, letterSpacing: 0.2 }}>
        💡 NASIHA PRO TIP
      </div>
      <div style={{ fontSize: 14, color: '#5A4500', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
        {item.nasiha_pro_tip}
      </div>
    </div>
  )
}

/**
 * Renders Claude's enrichment (vibe, known_for, signature, occasion tags, praise,
 * minor tags) — augmented with editorial nasiha_must_order taking priority, and
 * nasiha_tag_overrides applied. Complaint themes are NOT rendered publicly.
 */
function EnrichmentBlock({ item }) {
  const s = item?.ai_enriched_summary
  if (!s && (!Array.isArray(item?.nasiha_must_order) || item.nasiha_must_order.length === 0)) return null

  const [tagCounts, setTagCounts] = useState(null)
  useEffect(() => {
    let cancelled = false
    fetchTagCounts(supabase).then(m => { if (!cancelled) setTagCounts(m) })
    return () => { cancelled = true }
  }, [])

  const mustOrder = Array.isArray(item.nasiha_must_order) ? item.nasiha_must_order : []
  const claudeDishes = Array.isArray(s?.known_for_dishes) ? s.known_for_dishes : []
  // Dedup: don't show a Claude dish if it's already in must_order (case-insensitive)
  const mustOrderLower = new Set(mustOrder.map(d => (d || '').toLowerCase()))
  const claudeDishesFiltered = claudeDishes.filter(d => !mustOrderLower.has((d || '').toLowerCase()))

  const occasions = effectiveOccasionTags(item)
  const occasionsCapped = rankTagsByRarity(occasions, tagCounts || new Map(), 4)
  const minor = Array.isArray(s?.minor_tags) ? s.minor_tags : []
  const praise = Array.isArray(s?.praise_themes) ? s.praise_themes : []

  return (
    <>
      {/* What it's known for — must_order chips first, then Claude's known_for_dishes */}
      {(mustOrder.length > 0 || claudeDishesFiltered.length > 0) && (
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 10 }}>What it's known for</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {mustOrder.map(d => (
              <span key={'must-' + d} style={{
                background: '#FFF3CD', color: '#9A6D00', border: '1.5px solid #F4C430',
                fontSize: 12, fontWeight: 800, padding: '5px 10px', borderRadius: 999,
              }}>★ {d} · must order</span>
            ))}
            {claudeDishesFiltered.map(d => (
              <span key={'kfd-' + d} style={{
                background: '#F7F3EE', color: '#3A4A5A',
                fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 999,
              }}>{d}</span>
            ))}
          </div>
        </div>
      )}

      {/* Vibe */}
      {s?.vibe && (
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 8 }}>Vibe</div>
          <div style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 1.5 }}>{s.vibe}</div>
        </div>
      )}

      {/* Signature strength — styled callout */}
      {s?.signature_strength && (
        <div style={{
          ...card, padding: 16,
          background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEFD5 100%)',
          border: '1px solid rgba(194,65,12,0.25)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: colors.brand, marginBottom: 6, letterSpacing: 0.2 }}>SIGNATURE STRENGTH</div>
          <div style={{ fontSize: 14, color: '#5A2C0C', lineHeight: 1.5 }}>{s.signature_strength}</div>
        </div>
      )}

      {/* Occasion tags — capped at top 4 by rarity */}
      {occasionsCapped.length > 0 && (
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 10 }}>Good for</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {occasionsCapped.map(t => {
              const m = tagMeta(t)
              return (
                <span key={t} style={{
                  background: '#E0F7F5', color: '#0F766E',
                  fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 999,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <span>{m.emoji}</span>{m.label}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Minor tags — small text chips below */}
      {minor.length > 0 && (
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Details</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {minor.map((t, i) => (
              <span key={i} style={{
                background: 'transparent', color: '#6A7A8A',
                fontSize: 11, padding: '3px 8px', borderRadius: 6,
                border: '1px solid rgba(0,0,0,0.08)',
              }}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* Praise themes — what reviewers consistently like */}
      {praise.length > 0 && (
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: colors.textPrimary, marginBottom: 10 }}>What reviewers consistently praise</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: colors.textPrimary, fontSize: 13, lineHeight: 1.6 }}>
            {praise.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}
      {/* complaint_themes intentionally NOT rendered publicly — internal-only signal for chat. */}
    </>
  )
}
