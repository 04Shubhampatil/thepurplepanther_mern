import * as checkout from '../services/checkout.service.js'
import * as accountService from '../services/account.service.js'
import * as payment from '../services/payment.service.js'
import { setAuthCookie } from '../utils/auth-token.js'
import { clearGuestCartCookie } from '../middleware/guest-cart.middleware.js'
import { ok, asyncHandler } from '../utils/api-response.js'
import { BusinessError } from '../utils/api-error.js'
import { ORDER_STATUSES, PAYMENT_STATUSES } from '../constants/order-statuses.js'
import * as meta from '../integrations/meta/capi.js'

/**
 * Checkout and payment endpoints. Public — guest checkout creates the account.
 *
 * The guest password generated during checkout is held in a short-lived signed cookie
 * between `place` and `verify`, mirroring Laravel's per-order session key. It reaches the
 * customer only in the confirmation email, and the cookie is cleared as soon as it is used.
 */

const GUEST_PASSWORD_COOKIE = 'pp_gp'

export const show = asyncHandler(async (req, res) => {
  const context = await checkout.getCheckoutContext(req.user, req.guestCart)
  if (context.cart.count < 1) throw new BusinessError('Your cart is empty.')

  meta.trackAsync('InitiateCheckout', req, meta.cartData(context.cart))

  return ok(res, context, 'Checkout')
})

/**
 * POST /checkout/place — create the pending order and the Razorpay order.
 *
 * A guest is signed in here, because the order now belongs to a real account and they must
 * be able to see it immediately afterwards.
 */
export const place = asyncHandler(async (req, res) => {
  const { order, razorpay, guestPassword, user } = await checkout.createPendingOrder({
    user: req.user,
    guestCart: req.guestCart,
    data: req.body,
  })

  if (guestPassword) {
    setAuthCookie(res, user)
    clearGuestCartCookie(res)

    res.cookie(GUEST_PASSWORD_COOKIE, guestPassword, {
      httpOnly: true,
      signed: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000, // one hour is ample to finish a payment
      path: '/',
    })
  }

  // Guest checkout created an account, so CompleteRegistration fires here too — matching
  // CheckoutController::place. Both are fire-and-forget: Meta must never delay or fail a
  // checkout.
  const customer = meta.customerFromOrder(order)
  if (guestPassword) {
    meta.trackAsync(
      'CompleteRegistration',
      req,
      { content_name: 'Checkout account', status: true },
      customer,
    )
  }
  meta.trackAsync('AddPaymentInfo', req, meta.orderData(order), customer)

  return ok(
    res,
    {
      orderId: order.id,
      orderNumber: order.orderNumber,
      razorpay: payment.checkoutPayload(order, razorpay),
    },
    'Order created.',
  )
})

/**
 * POST /checkout/verify — verify the signature and complete the order.
 *
 * The browser's word that payment succeeded is never trusted; only a valid HMAC signature
 * promotes an order to paid.
 */
export const verify = asyncHandler(async (req, res) => {
  const guestPassword = req.signedCookies?.[GUEST_PASSWORD_COOKIE] ?? null

  const { order, alreadyPaid } = await checkout.verifyAndComplete({
    orderId: req.body.order_id,
    payload: req.body,
    user: req.user,
    guestPassword,
  })

  // Single use — clear it whether or not this was the first verification.
  res.clearCookie(GUEST_PASSWORD_COOKIE, { path: '/' })
  clearGuestCartCookie(res)

  // Only on the FIRST completion, and with a deterministic event id so Meta itself
  // deduplicates a repeated callback. Emitting on every verify would inflate revenue.
  if (!alreadyPaid) {
    meta.trackAsync(
      'Purchase',
      req,
      meta.orderData(order),
      meta.customerFromOrder(order),
      `purchase_${order.orderNumber}`,
    )
  }

  return ok(
    res,
    {
      orderNumber: order.orderNumber,
      redirect: `/order/${order.orderNumber}`,
      alreadyPaid,
    },
    'Payment successful. Order placed.',
  )
})

/**
 * GET /orders/:orderNumber — the order-confirmation page.
 *
 * Only paid or post-payment orders are readable, matching FrontendController::order, which
 * redirected an unpaid order back to checkout. A signed-in customer may read only their
 * own; admins may read any.
 */
export const showOrder = asyncHandler(async (req, res) => {
  const order = await accountService.getOrderByNumber(req.params.orderNumber, req.user)

  // FrontendController::order — paid, OR already progressed past payment. `rawStatus` is
  // used rather than `statusKey`, because the display value folds `pending` into `placed`
  // and would make an unpaid order look complete.
  const isPaid =
    order.paymentStatus === PAYMENT_STATUSES.PAID ||
    [
      ORDER_STATUSES.PLACED,
      ORDER_STATUSES.PACKED,
      ORDER_STATUSES.SHIPPED,
      ORDER_STATUSES.DELIVERED,
    ].includes(order.rawStatus)

  if (!isPaid) throw new BusinessError('Complete payment to view your order.')

  return ok(res, { order }, 'Order')
})

export default { show, place, verify, showOrder }
