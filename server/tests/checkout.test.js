import { describe, it, expect, beforeEach, vi } from 'vitest'
import crypto from 'node:crypto'

/**
 * Phases 9 + 10 — checkout and Razorpay.
 *
 * The security boundary of the entire application is `verifyPaymentSignature`: it is the
 * only thing standing between a forged callback and an order marked paid. It is tested
 * against REAL HMAC signatures computed with the test secret, not mocked.
 *
 * Razorpay's HTTP API is stubbed via fetch; everything else runs the real code path.
 */

const model = () => ({
  findMany: vi.fn(async () => []),
  findFirst: vi.fn(async () => null),
  findUnique: vi.fn(async () => null),
  count: vi.fn(async () => 0),
  create: vi.fn(async ({ data }) => ({ id: 500n, ...data })),
  createMany: vi.fn(async () => ({ count: 1 })),
  update: vi.fn(async ({ where, data }) => ({ id: where.id, ...data, items: [], user: null })),
  updateMany: vi.fn(async () => ({ count: 0 })),
  delete: vi.fn(async () => ({})),
  deleteMany: vi.fn(async () => ({ count: 0 })),
  aggregate: vi.fn(async () => ({ _sum: { quantity: 0 } })),
})

const prismaMock = {
  order: model(),
  orderItem: model(),
  orderStatusLog: model(),
  cartItem: model(),
  product: model(),
  user: model(),
  userAddress: model(),
  coupon: model(),
  couponRedemption: model(),
  shippingSetting: model(),
  $transaction: vi.fn(async (arg) =>
    typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg),
  ),
  $queryRaw: vi.fn(async () => [{ 1: 1 }]),
  $disconnect: vi.fn(),
  $on: vi.fn(),
}

vi.mock('../src/config/database.js', () => ({
  default: prismaMock,
  prisma: prismaMock,
  connectDatabase: vi.fn(),
  disconnectDatabase: vi.fn(),
}))

const sentEmails = []
vi.mock('../src/integrations/email/mailer.js', () => ({
  send: vi.fn(async (m) => {
    sentEmails.push(m)
    return true
  }),
  sendAsync: vi.fn((m) => sentEmails.push(m)),
  adminRecipient: () => 'admin@example.com',
  default: {},
}))

const request = (await import('supertest')).default
const app = (await import('../src/app.js')).default
const checkout = await import('../src/services/checkout.service.js')
const payment = await import('../src/services/payment.service.js')
const env = (await import('../src/config/env.js')).default

// ── helpers ────────────────────────────────────────────────────────────────

const sign = (orderId, paymentId, secret = env.RAZORPAY_KEY_SECRET) =>
  crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')

const product = (overrides = {}) => ({
  id: 1n,
  categoryId: 2n,
  title: 'Indigo Kurti',
  slug: 'indigo-kurti',
  mrp: 2000,
  sellingPrice: 1000,
  maxUnitBuy: 5,
  featuredImage: 'products/indigo.jpg',
  isActive: true,
  accessoryPackages: null,
  category: { id: 2n, slug: 'kurtis', title: 'Kurtis' },
  offer: null,
  colors: [],
  sizes: [],
  ...overrides,
})

const pendingOrder = (overrides = {}) => ({
  id: 500n,
  orderNumber: 'ORDabc123xyz456',
  userId: 1n,
  razorpayOrderId: 'order_RZP123',
  paymentStatus: 'pending',
  status: 'pending',
  orderedAt: new Date(),
  payableAmount: 1060,
  subtotal: 1000,
  discountAmount: 0,
  deliveryCharge: 60,
  couponId: null,
  couponCode: null,
  shippingName: 'Asha Menon',
  shippingEmail: 'asha@example.com',
  shippingPhone: '9876543210',
  items: [],
  user: null,
  ...overrides,
})

const VALID_BODY = {
  first_name: 'Asha',
  last_name: 'Menon',
  email: 'asha@example.com',
  phone: '9876543210',
  address_line1: '12 Laburnum Road',
  city: 'Pune',
  state: 'Maharashtra',
  pincode: '411001',
}

beforeEach(() => {
  vi.clearAllMocks()
  sentEmails.length = 0

  for (const entry of Object.values(prismaMock)) {
    if (entry && typeof entry === 'object' && entry.findMany) {
      entry.findMany.mockResolvedValue([])
      entry.findFirst.mockResolvedValue(null)
      entry.findUnique.mockResolvedValue(null)
      entry.count.mockResolvedValue(0)
    }
  }

  prismaMock.shippingSetting.findFirst.mockResolvedValue({
    id: 1n,
    freeShippingThreshold: 899,
    flatShippingRate: 60,
  })
  prismaMock.$transaction.mockImplementation(async (arg) =>
    typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg),
  )

  // Razorpay order creation succeeds by default.
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ id: 'order_RZP123', amount: 106_000, currency: 'INR' }),
  }))
})

// ══════════════════════════════════════════════ signature verification

describe('verifyPaymentSignature — the security boundary', () => {
  const orderId = 'order_RZP123'
  const paymentId = 'pay_ABC456'

  it('accepts a signature computed with the real secret', () => {
    expect(
      payment.verifyPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        signature: sign(orderId, paymentId),
      }),
    ).toBe(true)
  })

  it('rejects a signature made with the WRONG secret', () => {
    expect(
      payment.verifyPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        signature: sign(orderId, paymentId, 'attacker-secret'),
      }),
    ).toBe(false)
  })

  it('rejects a signature for a different order or payment id', () => {
    const valid = sign(orderId, paymentId)
    expect(
      payment.verifyPaymentSignature({
        razorpayOrderId: 'order_OTHER',
        razorpayPaymentId: paymentId,
        signature: valid,
      }),
    ).toBe(false)
    expect(
      payment.verifyPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: 'pay_OTHER',
        signature: valid,
      }),
    ).toBe(false)
  })

  it('binds the two ids together in the exact Laravel order', () => {
    // hash_hmac('sha256', order_id . '|' . payment_id, secret). Swapping the operands
    // still produces a valid-looking hash, so this must be pinned.
    const swapped = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${paymentId}|${orderId}`)
      .digest('hex')

    expect(
      payment.verifyPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        signature: swapped,
      }),
    ).toBe(false)
  })

  it('returns false — never throws — for missing or malformed input', () => {
    for (const signature of ['', null, undefined, 'garbage', 'a'.repeat(64)]) {
      expect(() =>
        payment.verifyPaymentSignature({
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          signature,
        }),
      ).not.toThrow()
      expect(
        payment.verifyPaymentSignature({
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          signature,
        }),
      ).toBe(false)
    }
  })

  it('rejects when either id is absent', () => {
    expect(
      payment.verifyPaymentSignature({ razorpayOrderId: '', razorpayPaymentId: paymentId, signature: 'x' }),
    ).toBe(false)
    expect(
      payment.verifyPaymentSignature({ razorpayOrderId: orderId, razorpayPaymentId: '', signature: 'x' }),
    ).toBe(false)
  })
})

describe('createRazorpayOrder', () => {
  it('sends the amount in PAISE', async () => {
    // Sending rupees would undercharge by 100x.
    await payment.createRazorpayOrder({ id: 1n, orderNumber: 'ORD1', payableAmount: 1060.5 })

    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.amount).toBe(106_050)
    expect(body.currency).toBe('INR')
    expect(body.payment_capture).toBe(1)
  })

  it('truncates the receipt to Razorpay\'s 40-character limit', async () => {
    await payment.createRazorpayOrder({
      id: 1n,
      orderNumber: 'ORD' + 'x'.repeat(60),
      payableAmount: 500,
    })
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).receipt).toHaveLength(40)
  })

  it('authenticates with basic auth and never puts the secret in the body', async () => {
    await payment.createRazorpayOrder({ id: 1n, orderNumber: 'ORD1', payableAmount: 500 })

    const [, init] = global.fetch.mock.calls[0]
    expect(init.headers.Authorization).toMatch(/^Basic /)
    expect(init.body).not.toContain(env.RAZORPAY_KEY_SECRET)
  })

  it('refuses an amount below the 100-paise minimum', async () => {
    await expect(
      payment.createRazorpayOrder({ id: 1n, orderNumber: 'ORD1', payableAmount: 0.5 }),
    ).rejects.toThrow('Order amount is too low for payment.')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('surfaces a clear message on 401', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { description: 'Auth failed' } }),
    }))

    await expect(
      payment.createRazorpayOrder({ id: 1n, orderNumber: 'ORD1', payableAmount: 500 }),
    ).rejects.toThrow(/RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET/)
  })

  it('passes through Razorpay\'s own error description', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: { description: 'Amount exceeds maximum' } }),
    }))

    await expect(
      payment.createRazorpayOrder({ id: 1n, orderNumber: 'ORD1', payableAmount: 500 }),
    ).rejects.toThrow('Amount exceeds maximum Please try again.')
  })

  it('does not leak the secret to the client on failure', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))

    await expect(
      payment.createRazorpayOrder({ id: 1n, orderNumber: 'ORD1', payableAmount: 500 }),
    ).rejects.toThrow(/^(?!.*KEY_SECRET.*=)/)
  })

  it('exposes only the PUBLIC key id in the checkout payload', () => {
    const payload = payment.checkoutPayload(
      { orderNumber: 'ORD1', shippingName: 'A', shippingEmail: 'a@b.com', shippingPhone: '1' },
      { id: 'order_RZP123', amount: 106_000, currency: 'INR' },
    )

    expect(payload.key).toBe(env.RAZORPAY_KEY_ID)
    expect(JSON.stringify(payload)).not.toContain(env.RAZORPAY_KEY_SECRET)
  })
})

// ══════════════════════════════════════════════ order creation

describe('createPendingOrder', () => {
  const guestCart = { lines: [{ productId: '1', quantity: 1 }], coupon: null }

  beforeEach(() => {
    prismaMock.product.findMany.mockResolvedValue([product()])
    prismaMock.product.findFirst.mockResolvedValue(product())
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue({
      id: 1n,
      name: 'Asha Menon',
      email: 'asha@example.com',
      role: 'customer',
    })
    prismaMock.cartItem.findMany.mockResolvedValue([
      { id: 1n, quantity: 1, color: null, size: null, packageKey: null, packagePrice: null, product: product() },
    ])
    prismaMock.order.findUnique.mockResolvedValue(null) // order number is unique
    prismaMock.order.update.mockResolvedValue(pendingOrder())
  })

  it('refuses an empty cart', async () => {
    prismaMock.product.findMany.mockResolvedValue([])
    prismaMock.cartItem.findMany.mockResolvedValue([])

    await expect(
      checkout.createPendingOrder({ user: null, guestCart: { lines: [], coupon: null }, data: VALID_BODY }),
    ).rejects.toThrow('Your cart is empty.')
  })

  it('creates the order as PENDING, not placed', async () => {
    // Only a verified signature may promote an order to paid.
    await checkout.createPendingOrder({ user: null, guestCart, data: VALID_BODY })

    const { data } = prismaMock.order.create.mock.calls[0][0]
    expect(data.status).toBe('pending')
    expect(data.paymentStatus).toBe('pending')
  })

  it('computes totals server-side and ignores any client-supplied amount', async () => {
    // Priced below the ₹899 threshold so shipping is actually charged and the whole
    // pipeline is exercised, not just the subtotal.
    const cheap = product({ sellingPrice: 500 })
    prismaMock.product.findMany.mockResolvedValue([cheap])
    prismaMock.product.findFirst.mockResolvedValue(cheap)
    prismaMock.cartItem.findMany.mockResolvedValue([
      { id: 1n, quantity: 1, color: null, size: null, packageKey: null, packagePrice: null, product: cheap },
    ])

    await checkout.createPendingOrder({
      user: null,
      guestCart,
      data: { ...VALID_BODY, payable_amount: 1, subtotal: 1, total: 1 },
    })

    const { data } = prismaMock.order.create.mock.calls[0][0]
    expect(Number(data.subtotal)).toBe(500)
    expect(Number(data.deliveryCharge)).toBe(60)
    expect(Number(data.payableAmount)).toBe(560)
  })

  it('gives free shipping above the threshold', async () => {
    await checkout.createPendingOrder({ user: null, guestCart, data: VALID_BODY })

    const { data } = prismaMock.order.create.mock.calls[0][0]
    expect(Number(data.subtotal)).toBe(1000)
    expect(Number(data.deliveryCharge)).toBe(0)
    expect(Number(data.payableAmount)).toBe(1000)
  })

  it('forces the country to India regardless of what was submitted', async () => {
    await checkout.createPendingOrder({
      user: null,
      guestCart,
      data: { ...VALID_BODY, country: 'Australia' },
    })
    expect(prismaMock.order.create.mock.calls[0][0].data.shippingCountry).toBe('India')
  })

  it('writes order items with mrp = unit price and saving = 0 (audit R5)', async () => {
    // A known quirk of the source. Reproduced deliberately for data consistency; changing
    // it is tracked as deferred improvement I4.
    await checkout.createPendingOrder({ user: null, guestCart, data: VALID_BODY })

    const [item] = prismaMock.orderItem.createMany.mock.calls[0][0].data
    expect(Number(item.price)).toBe(1000)
    expect(Number(item.mrp)).toBe(1000) // not the product's 2000
    expect(Number(item.saving)).toBe(0)
    expect(item.status).toBe('placed')
  })

  it('writes an "Awaiting payment" status log', async () => {
    await checkout.createPendingOrder({ user: null, guestCart, data: VALID_BODY })
    expect(prismaMock.orderStatusLog.create.mock.calls[0][0].data).toMatchObject({
      status: 'pending',
      title: 'Awaiting payment',
    })
  })

  it('re-checks inventory before creating the order', async () => {
    // A cart can sit for days while stock moves, so the check runs at the last possible
    // moment — after the guest cart has been merged, against the rows the order will be
    // built from.
    const soldOut = product({ colors: [{ colorId: 3n, quantity: 0, color: { id: 3n, name: 'Red' } }] })
    prismaMock.product.findFirst.mockResolvedValue(soldOut)
    prismaMock.product.findMany.mockResolvedValue([soldOut])
    prismaMock.cartItem.findMany.mockResolvedValue([
      { id: 1n, quantity: 1, color: 'Red', size: null, packageKey: null, packagePrice: null, product: soldOut },
    ])

    await expect(
      checkout.createPendingOrder({
        user: null,
        guestCart: { lines: [{ productId: '1', quantity: 1, color: 'Red' }], coupon: null },
        data: VALID_BODY,
      }),
    ).rejects.toThrow(/out of stock/)

    expect(prismaMock.order.create).not.toHaveBeenCalled()
  })

  it('creates a guest account with a hashed random password', async () => {
    const { guestPassword } = await checkout.createPendingOrder({
      user: null,
      guestCart,
      data: VALID_BODY,
    })

    expect(guestPassword).toHaveLength(10)
    const { data } = prismaMock.user.create.mock.calls[0][0]
    expect(data.password).toMatch(/^\$2b\$10\$/)
    expect(data.password).not.toContain(guestPassword)
    expect(data.role).toBe('customer')
  })

  it('ALLOWS guest checkout when the email already has an account — the order is filed under it, guest checkout is never blocked', async () => {
    // The client requirement: a returning customer who does not remember their password
    // must still be able to complete a purchase without logging in.
    prismaMock.user.findUnique.mockResolvedValue({ id: 42n, name: 'Asha Menon', email: 'asha@example.com' })

    const { guestPassword, user: resolvedUser } = await checkout.createPendingOrder({
      user: null,
      guestCart,
      data: VALID_BODY,
    })

    expect(prismaMock.order.create).toHaveBeenCalled()
    // orders.user_id is NOT NULL — the order is filed under the matching account.
    expect(prismaMock.order.create.mock.calls[0][0].data.userId).toBe(42n)
    expect(resolvedUser.id).toBe(42n)
    // No account was created, and nothing was done that would sign the browser into it
    // (checkout.controller.js only calls setAuthCookie when guestPassword is set).
    expect(prismaMock.user.create).not.toHaveBeenCalled()
    expect(guestPassword).toBeNull()
  })

  it('does NOT overwrite the existing account\'s saved address when an unauthenticated guest reuses its email', async () => {
    // Typing someone else's email at checkout must place an order, never mutate their
    // account — including their saved default address.
    prismaMock.user.findUnique.mockResolvedValue({ id: 42n, name: 'Asha Menon', email: 'asha@example.com' })

    await checkout.createPendingOrder({ user: null, guestCart, data: VALID_BODY })

    expect(prismaMock.userAddress.create).not.toHaveBeenCalled()
    expect(prismaMock.userAddress.update).not.toHaveBeenCalled()
    expect(prismaMock.userAddress.updateMany).not.toHaveBeenCalled()

    // Nothing in the account is touched: no phone backfill either.
    expect(prismaMock.user.update).not.toHaveBeenCalled()

    // The guest's cookie cart is priced on its own — it must never be folded into the
    // matching account's persisted cart (mergeGuestCartIntoUser is skipped because
    // guestPassword stays null for this path).
    expect(prismaMock.cartItem.create).not.toHaveBeenCalled()
    expect(prismaMock.cartItem.update).not.toHaveBeenCalled()
  })

  it('still creates a fresh guest account (and saves its address) for a genuinely new email', async () => {
    // Unchanged Laravel behaviour: only a brand-new email creates an account.
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.userAddress.findFirst.mockResolvedValue(null)

    await checkout.createPendingOrder({ user: null, guestCart, data: VALID_BODY })

    expect(prismaMock.user.create).toHaveBeenCalled()
    expect(prismaMock.userAddress.create).toHaveBeenCalled()
  })

  it('stores the Razorpay order id after the transaction commits', async () => {
    await checkout.createPendingOrder({ user: null, guestCart, data: VALID_BODY })
    expect(prismaMock.order.update.mock.calls[0][0].data.razorpayOrderId).toBe('order_RZP123')
  })

  it('leaves the order pending when Razorpay fails, rather than losing it', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))

    await expect(
      checkout.createPendingOrder({ user: null, guestCart, data: VALID_BODY }),
    ).rejects.toThrow()

    // The row exists and can be retried or reconciled.
    expect(prismaMock.order.create).toHaveBeenCalled()
  })

  it('overwrites the default address instead of accumulating one per order', async () => {
    prismaMock.userAddress.findFirst.mockResolvedValue({ id: 3n, userId: 1n })
    await checkout.createPendingOrder({ user: null, guestCart, data: VALID_BODY })

    expect(prismaMock.userAddress.update).toHaveBeenCalled()
    expect(prismaMock.userAddress.create).not.toHaveBeenCalled()
  })
})

describe('generateOrderNumber', () => {
  it('matches the ORD + 9 + 3 format', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null)
    const number = await checkout.generateOrderNumber()
    expect(number).toMatch(/^ORD[a-z0-9]{9}\d{3}$/)
  })

  it('retries on collision', async () => {
    prismaMock.order.findUnique
      .mockResolvedValueOnce({ id: 1n })
      .mockResolvedValueOnce({ id: 2n })
      .mockResolvedValueOnce(null)

    await checkout.generateOrderNumber()
    expect(prismaMock.order.findUnique).toHaveBeenCalledTimes(3)
  })

  it('gives up rather than looping forever', async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: 1n })
    await expect(checkout.generateOrderNumber(3)).rejects.toThrow('Could not generate an order number')
  })
})

// ══════════════════════════════════════════════ verification

describe('verifyAndComplete', () => {
  const paymentId = 'pay_ABC456'
  const razorpayOrderId = 'order_RZP123'

  const validPayload = () => ({
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: sign(razorpayOrderId, paymentId),
  })

  beforeEach(() => {
    prismaMock.order.findUnique.mockResolvedValue(pendingOrder())
    prismaMock.order.update.mockResolvedValue(
      pendingOrder({ paymentStatus: 'paid', status: 'placed', paymentId }),
    )
  })

  it('marks the order paid on a valid signature', async () => {
    const { order, alreadyPaid } = await checkout.verifyAndComplete({
      orderId: 500n,
      payload: validPayload(),
      user: null,
    })

    expect(alreadyPaid).toBe(false)
    const { data } = prismaMock.order.update.mock.calls[0][0]
    expect(data.paymentStatus).toBe('paid')
    expect(data.status).toBe('placed')
    expect(data.paymentId).toBe(paymentId)
    expect(order.paymentStatus).toBe('paid')
  })

  it('REFUSES an invalid signature and leaves the order pending', async () => {
    await expect(
      checkout.verifyAndComplete({
        orderId: 500n,
        payload: { ...validPayload(), razorpay_signature: 'forged' },
        user: null,
      }),
    ).rejects.toThrow('Payment signature verification failed.')

    expect(prismaMock.order.update).not.toHaveBeenCalled()
    expect(sentEmails).toHaveLength(0)
  })

  it('rejects a signature valid for a DIFFERENT Razorpay order', async () => {
    // Replay protection: a genuine signature from another order must not complete this one.
    const otherOrderId = 'order_OTHER'
    await expect(
      checkout.verifyAndComplete({
        orderId: 500n,
        payload: {
          razorpay_order_id: otherOrderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: sign(otherOrderId, paymentId),
        },
        user: null,
      }),
    ).rejects.toThrow('Razorpay order mismatch.')
  })

  it('is IDEMPOTENT for an already-paid order', async () => {
    // Razorpay can deliver a result twice and customers refresh. A second completion must
    // not double-count the coupon, re-clear the cart or send another email.
    prismaMock.order.findUnique.mockResolvedValue(pendingOrder({ paymentStatus: 'paid' }))

    const { alreadyPaid } = await checkout.verifyAndComplete({
      orderId: 500n,
      payload: validPayload(),
      user: null,
    })

    expect(alreadyPaid).toBe(true)
    expect(prismaMock.order.update).not.toHaveBeenCalled()
    expect(prismaMock.couponRedemption.create).not.toHaveBeenCalled()
    expect(prismaMock.cartItem.deleteMany).not.toHaveBeenCalled()
    expect(sentEmails).toHaveLength(0)
  })

  it('blocks a signed-in customer from completing someone else\'s order', async () => {
    await expect(
      checkout.verifyAndComplete({
        orderId: 500n,
        payload: validPayload(),
        user: { id: 999n, role: 'customer' },
      }),
    ).rejects.toThrow('Unauthorized order.')
  })

  it('records the coupon redemption inside the same transaction', async () => {
    prismaMock.order.findUnique.mockResolvedValue(
      pendingOrder({ couponId: 11n, couponCode: 'SAVE10', discountAmount: 100 }),
    )
    prismaMock.order.update.mockResolvedValue(
      pendingOrder({ couponId: 11n, couponCode: 'SAVE10', discountAmount: 100, paymentStatus: 'paid' }),
    )

    await checkout.verifyAndComplete({ orderId: 500n, payload: validPayload(), user: null })

    expect(prismaMock.couponRedemption.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.coupon.update.mock.calls[0][0].data).toEqual({ usedCount: { increment: 1 } })
  })

  it('clears the cart only AFTER payment is confirmed', async () => {
    // Clearing at order creation would lose the cart when payment fails.
    await checkout.verifyAndComplete({ orderId: 500n, payload: validPayload(), user: null })
    expect(prismaMock.cartItem.deleteMany.mock.calls[0][0].where.userId).toBe(1n)
  })

  it('writes a "Payment received" status log carrying the payment id', async () => {
    await checkout.verifyAndComplete({ orderId: 500n, payload: validPayload(), user: null })

    const { data } = prismaMock.orderStatusLog.create.mock.calls[0][0]
    expect(data.title).toBe('Payment received')
    expect(data.description).toContain(paymentId)
  })

  /*
   * The only status write outside the admin panel is this one, and it must move exactly
   * one thing: a fresh `pending` order to `placed`. An order the admin had already
   * advanced while its payment was outstanding keeps the admin's status — the payment is
   * still recorded, but it does not drag fulfilment back to the start.
   */
  it('moves a PENDING order to placed on payment', async () => {
    prismaMock.order.findUnique.mockResolvedValue(pendingOrder({ status: 'pending' }))
    await checkout.verifyAndComplete({ orderId: 500n, payload: validPayload(), user: null })

    expect(prismaMock.order.update.mock.calls[0][0].data.status).toBe('placed')
    expect(prismaMock.orderStatusLog.create.mock.calls[0][0].data.status).toBe('placed')
  })

  it.each(['packed', 'shipped', 'delivered'])(
    'does NOT drag an order the admin already moved to %s back to placed',
    async (adminStatus) => {
      prismaMock.order.findUnique.mockResolvedValue(pendingOrder({ status: adminStatus }))
      await checkout.verifyAndComplete({ orderId: 500n, payload: validPayload(), user: null })

      const { data } = prismaMock.order.update.mock.calls[0][0]
      expect(data.paymentStatus).toBe('paid') // the payment is still recorded
      expect(data.status).toBe(adminStatus) // the admin's decision stands
      expect(prismaMock.orderStatusLog.create.mock.calls[0][0].data.status).toBe(adminStatus)
    },
  )

  it('sends the customer and admin emails', async () => {
    await checkout.verifyAndComplete({ orderId: 500n, payload: validPayload(), user: null })

    expect(sentEmails).toHaveLength(2)
    expect(sentEmails[0].subject).toBe('Order confirmed — ORDabc123xyz456')
    expect(sentEmails[1].subject).toBe('New order — ORDabc123xyz456')
  })

  it('includes the guest password in the confirmation email', async () => {
    // This is the ONLY place a guest learns the password for the account created during
    // checkout. Dropping it would leave them unable to sign in.
    await checkout.verifyAndComplete({
      orderId: 500n,
      payload: validPayload(),
      user: null,
      guestPassword: 'Tr0ub4dor3',
    })

    expect(sentEmails[0].text).toContain('Tr0ub4dor3')
    expect(sentEmails[0].html).toContain('Tr0ub4dor3')
  })

  it('omits the password block for a normal signed-in checkout', async () => {
    await checkout.verifyAndComplete({ orderId: 500n, payload: validPayload(), user: null })
    expect(sentEmails[0].text).not.toContain('We created an account')
  })

  it('404s for an unknown order', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null)
    await expect(
      checkout.verifyAndComplete({ orderId: 9999n, payload: validPayload(), user: null }),
    ).rejects.toThrow('Order not found.')
  })
})

// ══════════════════════════════════════════════ HTTP

describe('checkout endpoints', () => {
  it('GET /checkout refuses an empty cart', async () => {
    const res = await request(app).get('/api/v1/checkout')
    expect(res.status).toBe(422)
    expect(res.body.message).toBe('Your cart is empty.')
  })

  it('validates every required field before creating anything', async () => {
    const res = await request(app).post('/api/v1/checkout/place').send({ first_name: 'Asha' })

    expect(res.status).toBe(422)
    expect(Object.keys(res.body.errors)).toEqual(
      expect.arrayContaining(['last_name', 'email', 'phone', 'address_line1', 'city', 'state', 'pincode']),
    )
    expect(prismaMock.order.create).not.toHaveBeenCalled()
  })

  it('never accepts a claim that payment succeeded', async () => {
    // The verify schema takes only the three Razorpay identifiers and the order id.
    const res = await request(app)
      .post('/api/v1/checkout/verify')
      .send({ order_id: 500, payment_status: 'paid', status: 'placed' })

    expect(res.status).toBe(422)
    expect(Object.keys(res.body.errors)).toEqual(
      expect.arrayContaining(['razorpay_payment_id', 'razorpay_order_id', 'razorpay_signature']),
    )
  })

  it('rejects a forged verification over HTTP', async () => {
    prismaMock.order.findUnique.mockResolvedValue(pendingOrder())

    const res = await request(app).post('/api/v1/checkout/verify').send({
      order_id: 500,
      razorpay_order_id: 'order_RZP123',
      razorpay_payment_id: 'pay_ABC456',
      razorpay_signature: 'f'.repeat(64),
    })

    expect(res.status).toBe(422)
    expect(res.body.message).toBe('Payment signature verification failed.')
  })

  it('completes a genuine payment and returns the confirmation redirect', async () => {
    prismaMock.order.findUnique.mockResolvedValue(pendingOrder())
    prismaMock.order.update.mockResolvedValue(
      pendingOrder({ paymentStatus: 'paid', status: 'placed', paymentId: 'pay_ABC456' }),
    )

    const res = await request(app).post('/api/v1/checkout/verify').send({
      order_id: 500,
      razorpay_order_id: 'order_RZP123',
      razorpay_payment_id: 'pay_ABC456',
      razorpay_signature: sign('order_RZP123', 'pay_ABC456'),
    })

    expect(res.status).toBe(200)
    expect(res.body.data.redirect).toBe('/order/ORDabc123xyz456')
    expect(res.body.message).toBe('Payment successful. Order placed.')
  })

  it('never returns the Razorpay secret in any response', async () => {
    prismaMock.order.findUnique.mockResolvedValue(pendingOrder())
    prismaMock.order.update.mockResolvedValue(pendingOrder({ paymentStatus: 'paid' }))

    const res = await request(app).post('/api/v1/checkout/verify').send({
      order_id: 500,
      razorpay_order_id: 'order_RZP123',
      razorpay_payment_id: 'pay_ABC456',
      razorpay_signature: sign('order_RZP123', 'pay_ABC456'),
    })

    expect(JSON.stringify(res.body)).not.toContain(env.RAZORPAY_KEY_SECRET)
  })
})

describe('order confirmation page', () => {
  it('refuses an order that has not been paid', async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      pendingOrder({ paymentStatus: 'pending', status: 'pending', statusLogs: [] }),
    )

    const res = await request(app).get('/api/v1/orders/ORDabc123xyz456')
    expect(res.status).toBe(422)
    expect(res.body.message).toBe('Complete payment to view your order.')
  })

  it('shows a paid order', async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      pendingOrder({ paymentStatus: 'paid', status: 'placed', statusLogs: [] }),
    )

    const res = await request(app).get('/api/v1/orders/ORDabc123xyz456')
    expect(res.status).toBe(200)
    expect(res.body.data.order.number).toBe('ORDabc123xyz456')
  })

  it('shows an order that has progressed past payment', async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      pendingOrder({ paymentStatus: 'pending', status: 'shipped', statusLogs: [] }),
    )

    const res = await request(app).get('/api/v1/orders/ORDabc123xyz456')
    expect(res.status).toBe(200)
  })

  it('404s for an unknown order number', async () => {
    prismaMock.order.findFirst.mockResolvedValue(null)
    const res = await request(app).get('/api/v1/orders/NOPE')
    expect(res.status).toBe(404)
  })
})
