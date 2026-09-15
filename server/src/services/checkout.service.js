import crypto from 'node:crypto'
import prisma from '../config/database.js'
import logger from '../config/logger.js'
import { BusinessError, ForbiddenError, NotFoundError } from '../utils/api-error.js'
import { toNumber, toDecimal } from '../utils/money.js'
import { hashPassword } from '../utils/password.js'
import { ROLES, LOGIN_PROVIDERS } from '../constants/roles.js'
import { ORDER_STATUSES, PAYMENT_STATUSES } from '../constants/order-statuses.js'
import * as cart from './cart.service.js'
import * as promotions from './promotion.service.js'
import * as payment from './payment.service.js'
import { sendAsync } from '../integrations/email/mailer.js'
import {
  orderPlacedCustomerMail,
  orderPlacedAdminMail,
} from '../integrations/email/templates/order-emails.js'

/**
 * Checkout — port of App\Services\CheckoutService.
 *
 * The flow, unchanged:
 *   cart -> validate -> inventory -> coupon -> shipping -> order (pending)
 *        -> Razorpay order -> [customer pays] -> verify signature -> complete
 *
 * The order row is created BEFORE payment, in `pending`, and only promoted to `paid` by a
 * verified signature. That is what makes the flow recoverable: an abandoned payment leaves
 * a pending row rather than losing the order entirely.
 */

/** Order::generateOrderNumber — 'ORD' + 9 shuffled alphanumerics + 3 digits, retried on collision. */
export async function generateOrderNumber(attempts = 10) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'

  for (let i = 0; i < attempts; i += 1) {
    const bytes = crypto.randomBytes(9)
    let suffix = ''
    for (let j = 0; j < 9; j += 1) suffix += alphabet[bytes[j] % alphabet.length]
    const number = `ORD${suffix}${crypto.randomInt(100, 1000)}`

    const clash = await prisma.order.findUnique({ where: { orderNumber: number }, select: { id: true } })
    if (!clash) return number
  }

  throw new BusinessError('Could not generate an order number. Please try again.')
}

/**
 * CheckoutService::upsertAddress — checkout overwrites the customer's default address
 * rather than accumulating a new row per order.
 */
async function upsertAddress(tx, userId, data) {
  const fullName = `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim()
  const payload = {
    label: 'Checkout',
    name: fullName || null,
    phone: data.phone ?? null,
    addressLine1: data.address_line1 ?? '',
    addressLine2: data.address_line2 ?? null,
    city: data.city ?? '',
    state: data.state ?? '',
    pincode: data.pincode ?? '',
    country: data.country ?? 'India',
    isDefault: true,
  }

  const existing = await tx.userAddress.findFirst({
    where: { userId: BigInt(userId), isDefault: true },
  })

  if (existing) {
    await tx.userAddress.update({ where: { id: existing.id }, data: payload })
    return
  }

  await tx.userAddress.updateMany({ where: { userId: BigInt(userId) }, data: { isDefault: false } })
  await tx.userAddress.create({ data: { userId: BigInt(userId), ...payload } })
}

/**
 * A brand-new email creates a real customer account, exactly as Laravel's
 * `CheckoutService::createPendingOrder` does.
 *
 * GUEST CHECKOUT: Laravel — and this file, until now — REFUSED checkout when the entered
 * email already belonged to an account ("This email is already registered. Please log in
 * to continue checkout."). The client has asked for that block removed: a returning
 * customer who does not remember their password must still be able to buy something.
 *
 * `orders.user_id` is `NOT NULL` with a foreign key to `users` (see the guest-cart note in
 * `config/database.js` and `docs/database-mapping.md`), so an order cannot exist without
 * SOME user row — there is no schema-free way to make this a true anonymous order, and
 * redesigning that column is out of scope for this fix. Reusing the matching account is the
 * smallest change that satisfies the constraint.
 *
 * That reuse touches NOTHING about the account: no password check, no phone backfill, no
 * saved-address overwrite (see the `isNewGuestAccount` guard around `upsertAddress` below),
 * and the browser is never signed into it (`guestPassword` stays `null`, so
 * `checkout.controller.js`'s `place` never calls `setAuthCookie`). Typing someone else's
 * email at checkout must place an order against that email, never grant access to the
 * account behind it — that property must not regress.
 *
 * The order itself still records the name/phone/address exactly as typed at checkout
 * (`createPendingOrder` builds the order row from `data`, not from the resolved user), so
 * the shipping details are always the guest's own, whichever account the order is filed
 * under.
 */
async function resolveCustomer(user, data) {
  if (user) {
    // Backfill a missing phone from the checkout form, as Laravel did.
    if (!user.phone && data.phone) {
      await prisma.user.update({ where: { id: BigInt(user.id) }, data: { phone: data.phone } })
    }
    return { user, guestPassword: null, isNewGuestAccount: false }
  }

  const email = String(data.email).trim().toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return { user: existing, guestPassword: null, isNewGuestAccount: false }
  }

  // 10 characters, matching Str::random(10).
  const guestPassword = crypto.randomBytes(16).toString('base64url').slice(0, 10)
  const fullName = `${data.first_name} ${data.last_name ?? ''}`.trim()

  const created = await prisma.user.create({
    data: {
      name: fullName,
      email,
      phone: data.phone ?? null,
      password: await hashPassword(guestPassword),
      role: ROLES.CUSTOMER,
      isActive: true,
      loginProvider: LOGIN_PROVIDERS.EMAIL,
    },
  })

  return { user: created, guestPassword, isNewGuestAccount: true }
}

/**
 * Create a pending order and its Razorpay counterpart.
 *
 * @returns {{order, razorpay, guestPassword, user}}
 */
export async function createPendingOrder({ user, guestCart, data }) {
  let summary = await cart.getSummary(user, guestCart)
  if (summary.count < 1) throw new BusinessError('Your cart is empty.')

  const { user: customer, guestPassword, isNewGuestAccount } = await resolveCustomer(user, data)

  // A guest's cart lives in the cookie; fold it into the new account and re-price, so the
  // order is built from the same rows the customer will see afterwards.
  if (guestPassword) {
    await cart.mergeGuestCartIntoUser(customer, guestCart)
    summary = await cart.getSummary(customer, { lines: [], coupon: guestCart?.coupon ?? null })
    if (summary.count < 1) throw new BusinessError('Your cart is empty.')
  }

  // Re-check stock at the last possible moment. A cart can sit for days.
  await cart.assertInventoryAvailable(summary.items)

  const subtotal = summary.subtotal
  const discount = toNumber(summary.discount.amount)
  const delivery = summary.discount.freeShipping ? 0 : summary.shipping.amount
  const payable = Math.max(0, subtotal - discount + delivery)

  const fullName = `${data.first_name} ${data.last_name ?? ''}`.trim()
  const addressLine = [data.address_line1, data.address_line2].filter(Boolean).join(', ')
  const orderNumber = await generateOrderNumber()

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber,
        userId: BigInt(customer.id),
        userName: fullName || customer.name,
        userPhone: data.phone ?? customer.phone,
        userEmail: data.email ?? customer.email,
        shippingName: fullName || customer.name,
        shippingPhone: data.phone ?? customer.phone,
        shippingEmail: data.email ?? customer.email,
        shippingAddress: addressLine,
        shippingCity: data.city ?? null,
        shippingState: data.state ?? null,
        shippingPincode: data.pincode ?? null,
        // The store ships only within India; any client-supplied country is overridden.
        shippingCountry: 'India',
        orderNotes: data.notes ?? null,
        paymentMode: 'razorpay',
        paymentStatus: PAYMENT_STATUSES.PENDING,
        subtotal: toDecimal(subtotal),
        discountAmount: toDecimal(discount),
        couponCode: summary.discount.code ?? null,
        couponId: summary.discount.couponId ?? null,
        deliveryCharge: toDecimal(delivery),
        payableAmount: toDecimal(payable),
        // 'pending' until payment is verified — deliberately not a value in OrderStatuses.
        status: 'pending',
        orderedAt: new Date(),
      },
    })

    await tx.orderItem.createMany({
      data: summary.items.map((item) => {
        const unit = toNumber(item.unitPrice)
        const quantity = Number(item.quantity)
        return {
          orderId: created.id,
          productId: item.productId ? BigInt(item.productId) : null,
          productTitle: item.title ?? 'Product',
          productImage: item.image ?? null,
          color: item.color ?? null,
          size: item.size ?? null,
          packageLabel: item.packageLabel ?? null,
          price: toDecimal(unit),
          // Laravel wrote the UNIT price into `mrp` and 0 into `saving`, so per-item
          // savings are not recorded even when the product has a higher MRP. Reproduced
          // for data consistency; logged as audit R5 / deferred improvement I4.
          mrp: toDecimal(unit),
          saving: toDecimal(0),
          quantity,
          totalPrice: toDecimal(unit * quantity),
          status: ORDER_STATUSES.PLACED,
        }
      }),
    })

    await tx.orderStatusLog.create({
      data: {
        orderId: created.id,
        status: 'pending',
        title: 'Awaiting payment',
        description: 'Order created. Waiting for Razorpay payment.',
        loggedAt: new Date(),
      },
    })

    // Only touch the address book for an account the caller actually controls — a
    // signed-in customer's own account, or the fresh one just created for them. An
    // unauthenticated guest who happens to type an existing customer's email must never
    // overwrite that customer's saved default address.
    if (user || isNewGuestAccount) {
      await upsertAddress(tx, customer.id, data)
    }

    return created
  })

  // Outside the transaction: a slow external call must not hold database locks open.
  // If this throws the order stays `pending`, which is recoverable and intended.
  const razorpayOrder = await payment.createRazorpayOrder(order)

  const withRazorpay = await prisma.order.update({
    where: { id: order.id },
    data: { razorpayOrderId: razorpayOrder.id },
    include: { items: true },
  })

  return { order: withRazorpay, razorpay: razorpayOrder, guestPassword, user: customer }
}

/**
 * Verify a payment and complete the order.
 *
 * IDEMPOTENT. Razorpay can deliver a result more than once and customers refresh; an order
 * already `paid` returns immediately without re-recording the redemption, re-clearing the
 * cart, or sending a second confirmation email.
 */
export async function verifyAndComplete({ orderId, payload, user, guestPassword = null }) {
  const order = await prisma.order.findUnique({
    where: { id: BigInt(orderId) },
    include: { items: true, user: true },
  })
  if (!order) throw new NotFoundError('Order not found.')

  // A signed-in customer may only complete their own order.
  if (user && user.role !== ROLES.ADMIN && String(order.userId) !== String(user.id)) {
    throw new ForbiddenError('Unauthorized order.')
  }

  if (order.paymentStatus === PAYMENT_STATUSES.PAID) {
    return { order, alreadyPaid: true }
  }

  const razorpayOrderId = String(payload.razorpay_order_id ?? '')

  // Guard against a signature that is valid for a DIFFERENT Razorpay order being replayed
  // against this one.
  if (order.razorpayOrderId && razorpayOrderId && order.razorpayOrderId !== razorpayOrderId) {
    throw new BusinessError('Razorpay order mismatch.')
  }

  const valid = payment.verifyPaymentSignature({
    razorpayOrderId,
    razorpayPaymentId: String(payload.razorpay_payment_id ?? ''),
    signature: String(payload.razorpay_signature ?? ''),
  })
  if (!valid) throw new BusinessError('Payment signature verification failed.')

  const paymentId = String(payload.razorpay_payment_id)

  /*
   * A successful payment moves a fresh order from `pending` to `placed` — the same write
   * CheckoutService::confirmPayment makes in Laravel, and the only status change in this
   * codebase that is not an admin's. It must NOT move any other status. The source assigns
   * PLACED unconditionally, so an order an admin had already advanced while its payment
   * was still outstanding would be dragged back to `placed` the moment the payment landed,
   * erasing the admin's decision. Here the admin's status is kept; the payment is still
   * recorded as paid and logged.
   */
  const fulfilmentStatus =
    order.status === 'pending' || order.status === ORDER_STATUSES.PLACED
      ? ORDER_STATUSES.PLACED
      : order.status

  const completed = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        paymentId,
        razorpayOrderId: razorpayOrderId || order.razorpayOrderId,
        paymentMode: 'razorpay',
        paymentStatus: PAYMENT_STATUSES.PAID,
        status: fulfilmentStatus,
        orderedAt: order.orderedAt ?? new Date(),
      },
      include: { items: true, user: true },
    })

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        status: fulfilmentStatus,
        title: 'Payment received',
        description: `Payment successful via Razorpay. Payment ID: ${paymentId}`,
        loggedAt: new Date(),
      },
    })

    // Inside the transaction: the redemption row and used_count must move together, or
    // the counter drifts and usage_limit stops being enforced.
    await promotions.recordRedemption(updated, updated.userId, tx)

    // The cart is only emptied once payment is confirmed. Clearing it at order creation
    // would lose the cart if payment failed.
    await tx.cartItem.deleteMany({ where: { userId: order.userId } })

    return updated
  })

  // Email is fire-and-forget: SMTP latency must not sit on the payment-confirmation path,
  // and a mail failure must never fail a paid order. Both are logged inside the mailer.
  sendAsync(orderPlacedCustomerMail(completed, guestPassword))
  sendAsync(orderPlacedAdminMail(completed))

  logger.info(
    { orderNumber: completed.orderNumber, paymentId },
    'Order payment verified and completed',
  )

  return { order: completed, alreadyPaid: false }
}

/**
 * Data for the checkout page: the cart summary, the customer's saved details, and the
 * PUBLIC Razorpay key id.
 */
export async function getCheckoutContext(user, guestCart) {
  const summary = await cart.getSummary(user, guestCart)

  let address = null
  let checkoutUser = null

  if (user) {
    address =
      (await prisma.userAddress.findFirst({
        where: { userId: BigInt(user.id), isDefault: true },
      })) ??
      (await prisma.userAddress.findFirst({
        where: { userId: BigInt(user.id) },
        orderBy: { id: 'desc' },
      }))

    const parts = String(user.name ?? '').trim().split(/\s+/)
    checkoutUser = {
      firstName: parts[0] ?? user.name,
      lastName: parts.slice(1).join(' '),
      email: user.email,
      phone: user.phone || address?.phone || '',
    }
  }

  const { clearCoupon, ...cartPayload } = summary

  return {
    cart: cartPayload,
    checkoutUser,
    checkoutAddress: address
      ? {
          address_line1: address.addressLine1,
          address_line2: address.addressLine2,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          country: address.country || 'India',
        }
      : null,
    isLoggedIn: Boolean(user),
    razorpayKey: (await import('../config/env.js')).default.RAZORPAY_KEY_ID,
  }
}

export default {
  createPendingOrder,
  verifyAndComplete,
  getCheckoutContext,
  generateOrderNumber,
}
