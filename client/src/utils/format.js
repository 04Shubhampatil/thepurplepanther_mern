/**
 * Display helpers.
 *
 * NOTE: there is deliberately no currency formatter here. Money is formatted by the server
 * and rendered through <Money formatted={...} />, so there is exactly one implementation
 * and it cannot drift from what checkout charges.
 */

export function formatDate(value, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', options)
}

export const truncate = (text, length = 120) => {
  const value = String(text ?? '')
  return value.length <= length ? value : `${value.slice(0, length).trimEnd()}…`
}

/** Strips tags from CMS HTML for use in meta descriptions. */
export const stripTags = (html) => String(html ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
