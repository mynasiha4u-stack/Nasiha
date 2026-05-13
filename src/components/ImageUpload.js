import React, { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { colors } from '../theme'

/**
 * Image upload with drag/drop + click to pick.
 * Uploads to Supabase Storage bucket 'listing-images'.
 * Returns the public URL via onChange.
 *
 * Bucket setup needed (one-time, in Supabase dashboard):
 *   1. Storage → New bucket → name 'listing-images' → public bucket
 *   2. Policies: anon SELECT, authenticated INSERT
 */
export default function ImageUpload({ value, onChange, disabled }) {
  const { user } = useAuth()
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const handleFile = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (jpg, png, webp, gif).')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.')
      return
    }
    setError('')
    setUploading(true)
    try {
      // Filename: <userid>/<timestamp>-<original>
      const ext = file.name.split('.').pop()
      const safeName = `${user.id}/${Date.now()}.${ext}`
      const { data, error: uploadError } = await supabase.storage
        .from('listing-images')
        .upload(safeName, file, { cacheControl: '3600', upsert: false })

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`)
        return
      }
      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('listing-images')
        .getPublicUrl(data.path)
      onChange(publicUrl)
    } catch (e) {
      setError(`Unexpected error: ${e.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const removeImage = () => {
    onChange('')
  }

  return (
    <div>
      {value ? (
        // Preview with remove
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 6 }}>
          <img src={value} alt="Preview" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }} />
          <button type="button" onClick={removeImage} style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(0,0,0,0.7)', color: 'white',
            border: 'none', borderRadius: 999,
            padding: '5px 12px', fontSize: 11, fontWeight: 700,
            cursor: 'pointer',
          }}>Remove</button>
        </div>
      ) : (
        // Drop zone
        <div
          onClick={() => !disabled && !uploading && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragOver ? colors.brand : 'rgba(0,0,0,0.18)'}`,
            background: dragOver ? '#FFF0E0' : 'white',
            borderRadius: 12,
            padding: '32px 16px',
            textAlign: 'center',
            cursor: disabled || uploading ? 'not-allowed' : 'pointer',
            transition: 'all 150ms',
            marginBottom: 6,
          }}
        >
          {uploading ? (
            <>
              <div style={{ fontSize: 32, marginBottom: 6 }}>⏳</div>
              <div style={{ fontSize: 13, color: '#3A4A5A' }}>Uploading...</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1C2B3A' }}>Tap to add a photo</div>
              <div style={{ fontSize: 11, color: '#6A7A8A', marginTop: 3 }}>or drag and drop · max 5 MB</div>
            </>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => handleFile(e.target.files?.[0])}
        style={{ display: 'none' }}
      />
      {error && <div style={{ fontSize: 11, color: '#9A3A3A', fontWeight: 600, marginBottom: 4 }}>{error}</div>}
    </div>
  )
}
