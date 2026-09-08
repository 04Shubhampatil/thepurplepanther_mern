import { describe, it, expect } from 'vitest'
import { RESERVED_SEGMENTS, isReservedSegment } from './index.jsx'

/**
 * Route guard tests.
 *
 * The reserved-segment list is the React equivalent of Laravel's negative lookahead on the
 * clean-category route:
 *
 *   Route::get('/{categorySlug}', ...)->where('categorySlug', '^(?!shop|collection|...).*$')
 *
 * A missing entry turns a working page into a category lookup that 404s. That is silent,
 * site-breaking, and exactly the kind of thing a rewrite loses — so the list is pinned
 * here against the original.
 */

/** Verbatim from routes/web.php, in the order Laravel declared them. */
const LARAVEL_EXCLUSIONS = [
  'shop',
  'collection',
  'product',
  'cart',
  'checkout',
  'order',
  'search',
  'blog',
  'about',
  'support',
  'login',
  'signup',
  'admin',
  'account',
  'newsletter',
  'forgot-password',
  'reset-password',
  'check-email',
  'logout',
  'cart-api',
  'account-api',
  'storage',
  'frontend',
  'css',
  'js',
  'images',
  'vendor',
  'build',
]

describe('clean category URLs', () => {
  it('reserves every segment Laravel excluded', () => {
    for (const segment of LARAVEL_EXCLUSIONS) {
      expect(RESERVED_SEGMENTS, `"${segment}" is missing from RESERVED_SEGMENTS`).toContain(segment)
    }
  })

  it('treats each reserved segment as reserved', () => {
    for (const segment of LARAVEL_EXCLUSIONS) {
      expect(isReservedSegment(segment)).toBe(true)
    }
  })

  it('is case-insensitive, so /CART is not read as a category', () => {
    expect(isReservedSegment('CART')).toBe(true)
    expect(isReservedSegment('Admin')).toBe(true)
  })

  it('additionally reserves segments this app introduces', () => {
    // `api` is the new backend namespace; `beyond-ordinary` is a real page whose slug
    // could otherwise collide with a category of the same name.
    expect(isReservedSegment('api')).toBe(true)
    expect(isReservedSegment('beyond-ordinary')).toBe(true)
  })

  it('does NOT reserve real category slugs', () => {
    for (const slug of ['accessories', 'shirts', 'kurtis', 'dresses', 'new-in']) {
      expect(isReservedSegment(slug)).toBe(false)
    }
  })

  it('has no duplicates', () => {
    expect(new Set(RESERVED_SEGMENTS).size).toBe(RESERVED_SEGMENTS.length)
  })
})
