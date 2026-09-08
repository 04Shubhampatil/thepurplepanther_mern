import env from '../config/env.js'
import { cookieOptions } from '../utils/auth-token.js'

/**
 * Guest cart transport.
 *
 * Laravel kept the guest cart and the applied coupon code in the PHP session. The Node
 * equivalent is a SIGNED, HTTP-only cookie carrying the same state.
 *
 * WHY A COOKIE IS SAFE HERE. The payload holds only product ids, quantities and variant
 * keys — no prices, no discounts, no totals. Every price is re-resolved from the database
 * on read, coupons are re-validated on every cart read, and quantities are checked against
 * live stock on every mutation and again before an order is created. So the worst a forged
 * cookie achieves is asking for a cart the server will independently price and validate.
 *
 * WHY NOT `cart_items`. That table's `user_id` is NOT NULL with a foreign key to `users`,
 * so guest rows cannot be stored without either inventing placeholder users or altering
 * the schema — and schema changes are out of scope for this migration.
 *
 * Size: ~50 bytes per line, against a 4KB cookie limit. MAX_LINES caps it well short.
 */

export const GUEST_CART_COOKIE = 'pp_cart'
const MAX_LINES = 40
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000 // 30 days

const EMPTY = { lines: [], coupon: null }

/** Parse and sanitise the cookie. Any malformed value degrades to an empty cart. */
function parseGuestCart(raw) {
  if (!raw) return { ...EMPTY }

  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY }

    const lines = Array.isArray(parsed.lines) ? parsed.lines : []

    return {
      lines: lines
        .filter((line) => line && /^\d+$/.test(String(line.productId)))
        .map((line) => ({
          productId: String(line.productId),
          // Clamped so a forged cookie cannot request an absurd quantity; the real
          // per-variant stock check still runs in the service.
          quantity: Math.min(99, Math.max(1, Number.parseInt(line.quantity, 10) || 1)),
          color: line.color == null ? null : String(line.color).slice(0, 80),
          size: line.size == null ? null : String(line.size).slice(0, 40),
          packageKey: line.packageKey == null ? null : String(line.packageKey).slice(0, 50),
        }))
        .slice(0, MAX_LINES),
      coupon: typeof parsed.coupon === 'string' ? parsed.coupon.slice(0, 50) : null,
    }
  } catch {
    return { ...EMPTY }
  }
}

/** Attaches `req.guestCart`. Signed cookies are preferred; unsigned are ignored. */
export function attachGuestCart(req, res, next) {
  req.guestCart = parseGuestCart(req.signedCookies?.[GUEST_CART_COOKIE])
  next()
}

/**
 * Persist guest cart state. A no-op for signed-in users, whose cart lives in the database
 * — but the coupon code is cookie-held for BOTH, matching Laravel, where the applied code
 * was session state regardless of authentication.
 */
export function writeGuestCart(res, guestCart) {
  const payload = {
    lines: (guestCart?.lines ?? []).slice(0, MAX_LINES),
    coupon: guestCart?.coupon ?? null,
  }

  if (payload.lines.length === 0 && !payload.coupon) {
    res.clearCookie(GUEST_CART_COOKIE, { ...cookieOptions(), signed: true, maxAge: undefined })
    return
  }

  res.cookie(GUEST_CART_COOKIE, JSON.stringify(payload), {
    ...cookieOptions(COOKIE_MAX_AGE),
    signed: true,
  })
}

export function clearGuestCartCookie(res) {
  res.clearCookie(GUEST_CART_COOKIE, { ...cookieOptions(), signed: true, maxAge: undefined })
}

export { EMPTY as EMPTY_GUEST_CART, env }
export default { attachGuestCart, writeGuestCart, clearGuestCartCookie, GUEST_CART_COOKIE }
