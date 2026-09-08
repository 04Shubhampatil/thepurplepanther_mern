import env from '../config/env.js'

/**
 * Port of App\Support\Media::url() and Product::resolveMediaUrl(), which are the same
 * five-branch algorithm duplicated in two places.
 *
 * Database rows are NOT rewritten by this migration: they keep bare relative paths like
 * "products/abc.jpg". Resolution stays a read-time concern, so Laravel and Node render
 * identical images during the parallel run and rollback costs nothing.
 *
 *   null/empty            -> fallback asset
 *   http:// or https://   -> unchanged
 *   "frontend/..."        -> bundled theme asset, served from APP_URL
 *   leading "/"           -> absolute path on APP_URL
 *   anything else         -> MEDIA_BASE_URL + "/" + path      (the public/storage tree)
 */

const DEFAULT_FALLBACK = 'frontend/images/shop/cart1.jpg'
const PRODUCT_FALLBACK = 'frontend/images/collection-1/collection-8.jpg'

const appUrl = () => env.APP_URL.replace(/\/+$/, '')

/** Laravel's asset() — a path relative to the application root URL. */
function asset(path) {
  return `${appUrl()}/${String(path).replace(/^\/+/, '')}`
}

export function mediaUrl(path, fallback = DEFAULT_FALLBACK) {
  if (!path) return asset(fallback)

  const value = String(path)
  if (value.startsWith('http://') || value.startsWith('https://')) return value

  const normalized = value.replace(/^\/+/, '')
  if (normalized.startsWith('frontend/')) return asset(normalized)
  if (value.startsWith('/')) return `${appUrl()}${value}`

  return `${env.mediaBaseUrl}/${normalized}`
}

/** Product images use a different fallback — matches Product::getFeaturedImageUrlAttribute. */
export function productImageUrl(path) {
  return mediaUrl(path, PRODUCT_FALLBACK)
}

/** Matches Product::highlightIconUrl. */
export function highlightIconUrl(path) {
  return path ? mediaUrl(path, 'frontend/images/icon.svg') : asset('frontend/images/icon.svg')
}

/** Matches User::getAvatarUrlAttribute — the ui-avatars fallback is part of the UI. */
export function avatarUrl(path, name = '') {
  if (path) return mediaUrl(path)
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e91e63&color=fff`
}

export default { mediaUrl, productImageUrl, highlightIconUrl, avatarUrl }
