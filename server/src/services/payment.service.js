import crypto from 'node:crypto'
import env from '../config/env.js'
import logger from '../config/logger.js'
import { BusinessError } from '../utils/api-error.js'
import { toNumber } from '../utils/money.js'

/**
 * Razorpay integration.
 *
 * Extracted from CheckoutService into its own module — the brief calls for this split, and
 * it means signature verification can be unit-tested without touching orders.
 *
 * Laravel talked to Razorpay over plain HTTP with basic auth rather than the SDK, and
 * verified signatures by hand. Both are reproduced exactly: the signature algorithm is the
 * security boundary of the whole payment flow, so it is written out rather than delegated.
 *
 * RAZORPAY_KEY_SECRET never leaves the server. React receives only the key id.
 */

const RAZORPAY_ORDERS_URL = 'https://api.razorpay.com/v1/orders'
const REQUEST_TIMEOUT_MS = 30_000

/**
 * Create a Razorpay order.
 *
 * Amount is in PAISE — `round(payable * 100)`. Sending rupees would undercharge by 100x.
 * Razorpay rejects anything under 100 paise (₹1), so that is caught locally with a clearer
 * message than the API returns.
 */
export async function createRazorpayOrder(order) {
  if (!env.razorpayConfigured) throw new BusinessError('Razorpay is not configured.')

  const amountPaise = Math.round(toNumber(order.payableAmount) * 100)
  if (amountPaise < 100) throw new BusinessError('Order amount is too low for payment.')

  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response
  try {
    response = await fetch(RAZORPAY_ORDERS_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: env.RAZORPAY_CURRENCY,
        // Razorpay caps `receipt` at 40 characters.
        receipt: String(order.orderNumber).slice(0, 40),
        payment_capture: 1,
        notes: { order_number: order.orderNumber, order_id: String(order.id) },
      }),
    })
  } catch (error) {
    logger.error({ err: error, orderNumber: order.orderNumber }, 'Razorpay request failed')
    throw new BusinessError('Could not reach the payment provider. Please try again.')
  } finally {
    clearTimeout(timeout)
  }

  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    // The key id is safe to log; the secret is never touched here.
    logger.error(
      { status: response.status, body, keyId: env.RAZORPAY_KEY_ID },
      'Razorpay order create failed',
    )

    if (response.status === 401) {
      throw new BusinessError(
        'Razorpay authentication failed. Please check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
      )
    }

    const description = body?.error?.description ?? 'Unable to start Razorpay payment.'
    throw new BusinessError(`${description} Please try again.`)
  }

  return body
}

/**
 * Verify a Razorpay payment signature.
 *
 *   expected = HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, KEY_SECRET)
 *
 * Compared with timingSafeEqual, matching PHP's hash_equals. A plain `===` leaks timing
 * information about how much of the signature matched, and this is the ONLY thing standing
 * between a forged callback and an order marked paid.
 *
 * Never throws on malformed input — returns false.
 */
export function verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, signature }) {
  if (!razorpayOrderId || !razorpayPaymentId || !signature) return false
  if (!env.RAZORPAY_KEY_SECRET) return false

  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex')

  const expectedBuffer = Buffer.from(expected, 'utf8')
  const providedBuffer = Buffer.from(String(signature), 'utf8')

  // timingSafeEqual throws on a length mismatch, which would itself leak length.
  if (expectedBuffer.length !== providedBuffer.length) return false

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer)
}

/** The checkout payload React needs. Contains the PUBLIC key id only. */
export function checkoutPayload(order, razorpayOrder) {
  return {
    key: env.RAZORPAY_KEY_ID,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency ?? env.RAZORPAY_CURRENCY,
    orderId: razorpayOrder.id,
    name: env.APP_NAME,
    description: `Order ${order.orderNumber}`,
    prefill: {
      name: order.shippingName,
      email: order.shippingEmail,
      contact: order.shippingPhone,
    },
  }
}

export default { createRazorpayOrder, verifyPaymentSignature, checkoutPayload }
