import React from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from './BottomNav'
import { colors, headerGradient, card, radius } from '../theme'

export function cleanText(text) {
  if (!text) return ''
  const nl = '\n'
  return text
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
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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
        {typeBadge && <span style={{ background: 'rgba(28,43,58,0.1)', color: '#1C2B3A', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: radius.full, marginBottom: 10, display: 'inline-block' }}>{typeBadge}</span>}
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1C2B3A', lineHeight: 1.3, marginBottom: 6 }}>{item.name}</h1>
        <div style={{ fontSize: 13, color: 'rgba(28,43,58,0.65)' }}>📍 {item.location_area}{item.location_address ? ` · ${item.location_address.split(',')[0]}` : ''}</div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <ActionButtons item={item} />
        <ContactRibbon item={item} />
        {(item.display_lat || item.location_address) && (
          <div style={{ ...card, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              <div style={{ fontSize: 10, color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Location</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary }}>{item.location_address || item.location_area}</div>
            </div>
            <a
              href={item.display_lat && item.display_lng
                ? `https://www.google.com/maps/dir/?api=1&destination=${item.display_lat},${item.display_lng}`
                : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.location_address)}`}
              target="_blank" rel="noreferrer"
              style={{ background: colors.brand, borderRadius: radius.sm, padding: '10px 14px', fontSize: 12, fontWeight: 700, color: 'white', textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}>
              Directions
            </a>
          </div>
        )}
        {children}
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
