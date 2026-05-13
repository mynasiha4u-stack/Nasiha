import React from 'react'
import { useNavigate } from 'react-router-dom'
import { colors } from '../theme'

/**
 * "+ Add a listing" button to drop on any category page.
 * Pre-fills the category via the cat URL param so SubmitListing.js
 * skips the category picker.
 *
 * Usage:
 *   <AddListingButton categorySlug="restaurants" label="restaurant" />
 */
export default function AddListingButton({ categorySlug, label, style }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(`/submit?cat=${categorySlug}`)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        background: colors.brand, color: 'white', border: 'none',
        borderRadius: 999, padding: '8px 14px',
        fontSize: 12, fontWeight: 700, cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        ...style,
      }}
    >
      + Add a {label || 'listing'}
    </button>
  )
}
