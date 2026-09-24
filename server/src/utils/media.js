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

/**
 * The house default icons for Product Highlights, by position.
 *
 * Highlights follow the same four beats on nearly every product — what it is made of, how
 * it fits, how it feels, what it is for — so a product with no uploaded icons now shows
 * this set instead of four copies of one generic mark. They are THEME files, not uploads,
 * so they are the same on every product and survive a product being edited or deleted.
 *
 * An uploaded icon always wins; these only fill the gap.
 */
const DEFAULT_HIGHLIGHT_ICONS = [
  'frontend/images/highlights/fabric.jpg',
  'frontend/images/highlights/fit.jpg',
  'frontend/images/highlights/feel.jpg',
  'frontend/images/highlights/made-for.jpg',
]

/**
 * Matches Product::highlightIconUrl, with the position-aware default above.
 *
 * `index` is the highlight's place in the list. Beyond the fourth the set repeats rather
 * than falling back to the old generic mark, so a fifth highlight still gets a drawn icon.
 */
export function highlightIconUrl(path, index = 0) {
  if (path) return mediaUrl(path, DEFAULT_HIGHLIGHT_ICONS[0])

  const position = Number.isInteger(index) && index >= 0 ? index : 0
  return asset(DEFAULT_HIGHLIGHT_ICONS[position % DEFAULT_HIGHLIGHT_ICONS.length])
}

/** Matches User::getAvatarUrlAttribute — the ui-avatars fallback is part of the UI. */
export function avatarUrl(path, name = '') {
  if (path) return mediaUrl(path)
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=e91e63&color=fff`
}

export default { mediaUrl, productImageUrl, highlightIconUrl, avatarUrl }
