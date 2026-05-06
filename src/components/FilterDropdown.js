import React, { useState, useRef, useEffect } from 'react'
import { colors } from '../theme'

/**
 * Inline multi-select filter dropdown.
 * Button shows count or "All". Tap to open dropdown below.
 *
 * Props:
 *   label       - "Halal Type", "Category", "Cuisine" (used for "All Halal Types" placeholder)
 *   options     - [{ key, label }] (excluding "all" — that's handled implicitly by clearing the set)
 *   selected    - Set of selected keys (empty = all)
 *   onChange    - (newSet) => void
 *   accentColor - color when active
 */
export default function FilterDropdown({ label, options, selected, onChange, accentColor }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const isActive = selected.size > 0
  const buttonLabel = selected.size === 0
    ? `All ${label}${label.endsWith('s') ? '' : 's'}`
    : selected.size === 1
      ? options.find(o => o.key === [...selected][0])?.label || label
      : `${label} (${selected.size})`

  const toggle = (key) => {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange(next)
  }

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          padding: '9px 10px',
          borderRadius: 10,
          border: '1px solid rgba(0,0,0,0.12)',
          background: isActive ? (accentColor || colors.brand) : 'white',
          color: isActive ? 'white' : '#1C2B3A',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{buttonLabel}</span>
        <span style={{ fontSize: 9, opacity: 0.7 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'white', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)',
          boxShadow: '0 6px 22px rgba(0,0,0,0.15)',
          zIndex: 100,
          maxHeight: 320, overflowY: 'auto',
          minWidth: 200,
        }}>
          {/* "All" / Clear option */}
          <button onClick={() => { onChange(new Set()); setOpen(false) }} style={{
            width: '100%', textAlign: 'left',
            padding: '10px 14px', fontSize: 13, fontWeight: 600,
            background: selected.size === 0 ? '#FFF3EB' : 'white',
            color: selected.size === 0 ? colors.brand : '#1C2B3A',
            border: 'none', borderBottom: '1px solid rgba(0,0,0,0.06)',
            cursor: 'pointer',
          }}>
            All {label}{label.endsWith('s') ? '' : 's'}
          </button>

          {options.map(opt => {
            const checked = selected.has(opt.key)
            return (
              <button key={opt.key} onClick={() => toggle(opt.key)} style={{
                width: '100%', textAlign: 'left',
                padding: '10px 14px', fontSize: 13, fontWeight: checked ? 700 : 500,
                background: checked ? '#FFF3EB' : 'white',
                color: checked ? colors.brand : '#1C2B3A',
                border: 'none',
                borderBottom: '1px solid rgba(0,0,0,0.04)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{
                  width: 16, height: 16, borderRadius: 4,
                  border: `2px solid ${checked ? colors.brand : '#bbb'}`,
                  background: checked ? colors.brand : 'white',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: 'white', fontWeight: 800,
                  flexShrink: 0,
                }}>{checked ? '✓' : ''}</span>
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
