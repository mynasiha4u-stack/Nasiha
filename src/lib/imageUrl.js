// Shared image URL helpers. Use these everywhere — don't reinvent or duplicate.

/**
 * True only for URLs that look like an actual image (not an Instagram/Facebook
 * link or other site URL stored in image_url field).
 *
 * Returns false for null, non-strings, social media links, and unknown URLs
 * — we don't risk a broken <img> tag or background that won't load.
 */
export function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false
  const lower = url.toLowerCase().trim()
  if (!lower.startsWith('http')) return false
  // Common image extensions
  if (/\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|#|$)/i.test(lower)) return true
  // Known image-hosting paths (Supabase storage, common CDNs)
  if (lower.includes('supabase.co/storage') || lower.includes('cloudinary.com') || lower.includes('imgur.com')) return true
  // Skip Instagram/Facebook/site URLs that aren't images
  if (/instagram\.com|facebook\.com|twitter\.com|x\.com|tiktok\.com|youtube\.com|linkedin\.com/.test(lower)) return false
  return false
}
