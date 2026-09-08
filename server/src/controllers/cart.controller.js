import * as cart from '../services/cart.service.js'
import * as promotions from '../services/promotion.service.js'
import * as catalog from '../services/catalog.service.js'
import { ok, asyncHandler } from '../utils/api-response.js'
import { writeGuestCart } from '../middleware/guest-cart.middleware.js'
import { BusinessError } from '../utils/api-error.js'
import * as meta from '../integrations/meta/capi.js'
import prisma from '../config/database.js'

/**
 * Meta AddToCart. Fire-and-forget: the product lookup and the send are both detached, so
 * neither can delay or fail an add-to-cart.
 */
function trackAddToCart(req, productId, quantity) {
  void prisma.product
    .findFirst({ where: { id: BigInt(productId) }, include: { category: true } })
    .then((product) => {
      if (product) meta.trackAsync('AddToCart', req, meta.productData(product, quantity))
    })
    .catch(() => {})
}

/**
 * Cart endpoints.
 *
 * Every response returns the FULL recomputed summary, exactly as the Laravel JSON
 * endpoints did. The client never patches its own totals — it replaces them with the
 * server's, so the displayed price can never drift from what checkout will charge.
 */

/**
 * Build the response and persist any guest-cart change in one place, so no handler can
 * forget to write the cookie back.
 */
async function respondWithCart(req, res, guestCart, message) {
  const summary = await cart.getSummary(req.user, guestCart)

  // A coupon that no longer validates is dropped from stored state, matching
  // PromotionService::quote clearing the session key.
  const nextGuestCart = summary.clearCoupon ? { ...guestCart, coupon: null } : guestCart
  writeGuestCart(res, nextGuestCart)

  const { clearCoupon, ...payload } = summary
  return ok(res, { cart: payload, count: payload.count }, message)
}

export const index = asyncHandler(async (req, res) =>
  respondWithCart(req, res, req.guestCart, 'Cart'),
)

export const store = asyncHandler(async (req, res) => {
  const { guestCart, message } = await cart.addItem(req.user, req.guestCart, {
    productId: req.body.product_id,
    quantity: req.body.quantity ?? 1,
    color: req.body.color,
    size: req.body.size,
    packageKey: req.body.package_key,
  })

  trackAddToCart(req, req.body.product_id, Number(req.body.quantity ?? 1))

  return respondWithCart(req, res, guestCart, message)
})

export const update = asyncHandler(async (req, res) => {
  const { guestCart, message } = await cart.updateItem(req.user, req.guestCart, {
    productId: req.params.productId,
    quantity: req.body.quantity,
    color: req.body.color,
    size: req.body.size,
    packageKey: req.body.package_key,
  })
  return respondWithCart(req, res, guestCart, message)
})

export const destroy = asyncHandler(async (req, res) => {
  const { guestCart, message } = await cart.removeItem(req.user, req.guestCart, {
    productId: req.params.productId,
    color: req.body.color,
    size: req.body.size,
    packageKey: req.body.package_key,
  })
  return respondWithCart(req, res, guestCart, message)
})

/**
 * Buy Now — adds to the cart and points the client at checkout. Identical to `store`
 * apart from the redirect, matching CartController::buyNow.
 */
export const buyNow = asyncHandler(async (req, res) => {
  const { guestCart } = await cart.addItem(req.user, req.guestCart, {
    productId: req.body.product_id,
    quantity: req.body.quantity ?? 1,
    color: req.body.color,
    size: req.body.size,
    packageKey: req.body.package_key,
  })

  trackAddToCart(req, req.body.product_id, Number(req.body.quantity ?? 1))

  const summary = await cart.getSummary(req.user, guestCart)
  writeGuestCart(res, guestCart)

  const { clearCoupon, ...payload } = summary
  return ok(res, { cart: payload, count: payload.count, redirect: '/checkout' }, 'Added to cart.')
})

/**
 * Apply a coupon.
 *
 * Validated against the CURRENT cart before it is stored, so an invalid code is rejected
 * with its specific reason rather than being saved and silently ignored later.
 */
export const applyCoupon = asyncHandler(async (req, res) => {
  const items = await cart.getLines(req.user, req.guestCart)
  if (items.length === 0) throw new BusinessError('Your cart is empty.')

  await promotions.applyCode(req.body.code, items, req.user)

  const guestCart = { ...req.guestCart, coupon: String(req.body.code).trim().toUpperCase() }
  return respondWithCart(req, res, guestCart, 'Coupon applied successfully.')
})

export const removeCoupon = asyncHandler(async (req, res) =>
  respondWithCart(req, res, { ...req.guestCart, coupon: null }, 'Coupon removed.'),
)

/** Publicly advertisable coupons — gated by `coupons.is_public`. */
export const publicCoupons = asyncHandler(async (req, res) =>
  ok(res, { coupons: await promotions.listPublicCoupons() }, 'Coupons'),
)

/**
 * GET /cart/recommendations — the cart page's "YOU MAY ALSO LIKE" rail.
 *
 * Its own endpoint rather than a field on the cart summary: the summary is re-read after
 * every quantity change and by the bag drawer, and four extra products on each of those
 * would be paid for many times over for a rail that only one page renders.
 */
export const recommendations = asyncHandler(async (req, res) => {
  // The exclusion list comes from the SUMMARY, not from req.guestCart: a signed-in
  // customer's lines live in the database, and reading the cookie would recommend them
  // the things already in their bag.
  const summary = await cart.getSummary(req.user, req.guestCart)
  const productIds = [...new Set((summary.items ?? []).map((item) => item.productId))]

  const products = await catalog.getCartRecommendations(productIds)
  return ok(res, { products }, 'Recommendations')
})

export default {
  index,
  store,
  update,
  destroy,
  buyNow,
  applyCoupon,
  removeCoupon,
  publicCoupons,
  recommendations,
}
