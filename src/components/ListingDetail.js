/**
 * ListingDetail — Standard detail page component for all categories
 * Handles: back button, sunset header, type badge, contact actions,
 * contact ribbon (phone/email/whatsapp/instagram/facebook/website),
 * location with map, description, image
 */
import React from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from './BottomNav'

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
    item.phone && { href: `tel:${item.phone}`, icon: '📞', label: 'Call' },
    item.email && { href: `mailto:${item.email}`, icon: '✉️', label: 'Email' },
    item.whatsapp && { href: `https://wa.me/${item.whatsapp.replace(/\D/g, '')}`, icon: '💬', label: 'WhatsApp', external: true },
    item.instagram && { href: item.instagram, icon: null, label: 'Instagram', external: true, ig: true },
    item.facebook && { href: item.facebook, icon: null, label: 'Facebook', external: true, fb: true },
    item.website && { href: item.website.startsWith('http') ? item.website : 'https://' + item.website, icon: '🌐', label: 'Website', external: true },
  ].filter(Boolean)

  if (contacts.length === 0) return null

  return (
    <div style={{ background: 'white', borderRadius: 16, padding: '4px 8px', marginBottom: 12, border: '1px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' }}>
      {contacts.map((c, i) => (
        <a key={i} href={c.href} target={c.external ? '_blank' : undefined} rel={c.external ? 'noreferrer' : undefined}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 8px', textDecoration: 'none', gap: 4, minWidth: 48 }}>
          {c.ig ? (
            <div style={{ width: 26, height: 26, background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 800 }}>IG</div>
          ) : c.fb ? (
            <div style={{ width: 26, height: 26, background: '#1877F2', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 15, fontWeight: 900 }}>f</div>
          ) : (
            <span style={{ fontSize: 22 }}>{c.icon}</span>
          )}
          <span style={{ fontSize: 10, color: '#555', fontWeight: 600 }}>{c.label}</span>
        </a>
      ))}
    </div>
  )
}

export function ActionButtons({ item }) {
  const buttons = [
    item.phone && { href: `tel:${item.phone}`, label: '📞 Call', primary: true },
    item.website && { href: item.website.startsWith('http') ? item.website : 'https://' + item.website, label: '🌐 Website', external: true },
    item.email && { href: `mailto:${item.email}`, label: '✉️ Email' },
  ].filter(Boolean).slice(0, 3)

  if (buttons.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
      {buttons.map((b, i) => (
        <a key={i} href={b.href} target={b.external ? '_blank' : undefined} rel={b.external ? 'noreferrer' : undefined}
          style={{ flex: 1, minWidth: 90, background: i === 0 ? '#e8943a' : 'white', border: i === 0 ? 'none' : '1px solid rgba(0,0,0,0.1)', borderRadius: 12, padding: '13px 0', color: i === 0 ? 'white' : '#1a2a3a', fontWeight: 700, fontSize: 13, textAlign: 'center', textDecoration: 'none' }}>
          {b.label}
        </a>
      ))}
    </div>
  )
}

export default function ListingDetail({ item, typeBadge, typeColor, loading, notFoundLabel = 'Not found', children }) {
  const navigate = useNavigate()

  if (loading) return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: 'rgba(26,42,58,0.4)' }}><div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>Loading...</div>
    </div>
  )

  if (!item) return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(26,42,58,0.4)' }}>{notFoundLabel}</div>
    </div>
  )

  return (
    <div style={{ maxWidth: 430, margin: '0 auto', background: '#f5f5f5', minHeight: '100vh', paddingBottom: 80 }}>

      {/* Sunset header */}
      <div style={{ background: 'linear-gradient(180deg, #7db8e8 0%, #c8e4f8 60%, #f0c090 100%)', padding: '52px 20px 20px' }}>
        <button onClick={() => navigate(-1)} style={{ fontSize: 14, color: 'rgba(26,42,58,0.65)', marginBottom: 14, display: 'block', background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
        {typeBadge && (
          <span style={{ background: typeColor?.bg || '#f0f0f0', color: typeColor?.color || '#444', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, marginBottom: 10, display: 'inline-block' }}>{typeBadge}</span>
        )}
        {item.image_url && (
          <img src={item.image_url} alt={item.name} style={{ width: '100%', borderRadius: 12, marginBottom: 12, objectFit: 'cover', maxHeight: 200 }} />
        )}
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a2a3a', lineHeight: 1.3, marginBottom: 4 }}>{item.name}</h1>
        <div style={{ fontSize: 13, color: 'rgba(26,42,58,0.6)' }}>📍 {item.location_area}{item.location_address ? ` · ${item.location_address.split(',')[0]}` : ''}</div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {/* Action buttons */}
        <ActionButtons item={item} />

        {/* Contact ribbon */}
        <ContactRibbon item={item} />

        {/* Location */}
        {item.location_address && (
          <div style={{ background: 'white', borderRadius: 16, padding: 14, marginBottom: 12, border: '1px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(26,42,58,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Location</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2a3a' }}>{item.location_address}</div>
            </div>
            <a href={`https://www.google.com/maps/search/${encodeURIComponent(item.location_address)}`} target="_blank" rel="noreferrer"
              style={{ background: '#e8943a', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, color: 'white', textDecoration: 'none', flexShrink: 0 }}>
              🗺️ Map
            </a>
          </div>
        )}

        {/* Extra content from parent */}
        {children}

        {/* Description */}
        {item.description && (
          <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, border: '1px solid rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2a3a', marginBottom: 10 }}>About</div>
            <div style={{ fontSize: 14, color: '#1a2a3a', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{cleanText(item.description)}</div>
          </div>
        )}

      </div>
      <BottomNav />
    </div>
  )
}
