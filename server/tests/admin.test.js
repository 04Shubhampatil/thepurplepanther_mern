import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Phase 13 — admin panel.
 *
 * Two things carry the weight here:
 *   1. AUTHORISATION. Every admin endpoint must reject anonymous and customer callers.
 *      Hiding buttons in React is not a control (brief §31).
 *   2. The destructive operations: pivot sync must not zero live stock, the status machine
 *      must not allow illegal transitions, and an admin must not be able to lock
 *      themselves out.
 */

const model = () => ({
  findMany: vi.fn(async () => []),
  findFirst: vi.fn(async () => null),
  findUnique: vi.fn(async () => null),
  count: vi.fn(async () => 0),
  create: vi.fn(async ({ data }) => ({ id: 900n, ...data })),
  createMany: vi.fn(async () => ({ count: 1 })),
  update: vi.fn(async ({ where, data }) => ({ id: where.id, ...data })),
  updateMany: vi.fn(async () => ({ count: 1 })),
  delete: vi.fn(async () => ({})),
  deleteMany: vi.fn(async () => ({ count: 1 })),
  aggregate: vi.fn(async () => ({ _sum: { payableAmount: 0 } })),
  groupBy: vi.fn(async () => []),
  upsert: vi.fn(async ({ create }) => ({ id: 1n, ...create })),
})

const prismaMock = {
  product: model(),
  productColor: model(),
  productSize: model(),
  productImage: model(),
  productReview: model(),
  category: model(),
  subCategory: model(),
  brand: model(),
  color: model(),
  size: model(),
  offer: model(),
  newsType: model(),
  blogPost: model(),
  banner: model(),
  bannerImage: model(),
  homeSectionProduct: model(),
  coupon: model(),
  couponRedemption: model(),
  order: model(),
  orderItem: model(),
  orderStatusLog: model(),
  user: model(),
  subscriber: model(),
  contactMessage: model(),
  page: model(),
  shippingSetting: model(),
  $transaction: vi.fn(async (arg) => (typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg))),
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
const catalogAdmin = await import('../src/services/admin/catalog-admin.service.js')
const orderAdmin = await import('../src/services/admin/order-admin.service.js')
const miscAdmin = await import('../src/services/admin/misc-admin.service.js')
const { signAuthToken, AUTH_COOKIE } = await import('../src/utils/auth-token.js')

const ADMIN = { id: 1n, name: 'Site Admin', email: 'admin@example.com', role: 'admin', isActive: true }
const CUSTOMER = { id: 2n, name: 'Asha', email: 'asha@example.com', role: 'customer', isActive: true }

const cookieFor = (user) => `${AUTH_COOKIE}=${signAuthToken(user)}`

beforeEach(() => {
  vi.clearAllMocks()
  sentEmails.length = 0

  for (const entry of Object.values(prismaMock)) {
    if (entry && typeof entry === 'object' && entry.findMany) {
      entry.findMany.mockResolvedValue([])
      entry.findFirst.mockResolvedValue(null)
      entry.findUnique.mockResolvedValue(null)
      entry.count.mockResolvedValue(0)
      entry.groupBy.mockResolvedValue([])
      entry.aggregate.mockResolvedValue({ _sum: { payableAmount: 0 } })
    }
  }

  prismaMock.user.findUnique.mockResolvedValue(ADMIN)
  prismaMock.$transaction.mockImplementation(async (arg) =>
    typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg),
  )
})

// ══════════════════════════════════════════════ authorisation

describe('admin authorisation', () => {
  const endpoints = [
    ['get', '/api/v1/admin/dashboard'],
    ['get', '/api/v1/admin/products'],
    ['post', '/api/v1/admin/products/bulk'],
    ['get', '/api/v1/admin/orders'],
    ['get', '/api/v1/admin/users'],
    ['get', '/api/v1/admin/coupons'],
    ['get', '/api/v1/admin/banners'],
    ['get', '/api/v1/admin/contacts'],
    ['get', '/api/v1/admin/settings/shipping'],
    ['get', '/api/v1/admin/categories'],
  ]

  it.each(endpoints)('%s %s rejects an anonymous request with 401', async (method, url) => {
    const res = await request(app)[method](url).send({})
    expect(res.status).toBe(401)
  })

  it.each(endpoints)('%s %s rejects a signed-in CUSTOMER with 403', async (method, url) => {
    prismaMock.user.findUnique.mockResolvedValue(CUSTOMER)
    const res = await request(app)[method](url).set('Cookie', cookieFor(CUSTOMER)).send({})
    expect(res.status).toBe(403)
  })

  it('allows an admin through', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard').set('Cookie', cookieFor(ADMIN))
    expect(res.status).toBe(200)
  })

  it('leaves /admin/auth reachable while signed out', async () => {
    // Admins must be able to log in.
    const res = await request(app).post('/api/v1/admin/auth/login').send({})
    expect(res.status).toBe(422) // validation, not 401
  })

  it('never returns a password hash from the user list', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: 2n, name: 'Asha', email: 'a@b.com' }])
    const res = await request(app).get('/api/v1/admin/users').set('Cookie', cookieFor(ADMIN))

    expect(prismaMock.user.findMany.mock.calls[0][0].select).not.toHaveProperty('password')
    expect(JSON.stringify(res.body)).not.toContain('$2b$')
  })
})

// ══════════════════════════════════════════════ pivot sync

describe('product variant sync — must not destroy stock', () => {
  beforeEach(() => {
    prismaMock.product.findFirst.mockResolvedValue(null) // title is free
    prismaMock.product.findUnique.mockResolvedValue({
      id: 5n,
      title: 'Kurti',
      images: [],
      colors: [],
      sizes: [],
    })
  })

  it('UPDATES an existing pivot rather than recreating it', async () => {
    // A delete-all + recreate pass would zero product_color.quantity on every save — the
    // per-variant stock the cart reads.
    prismaMock.productColor.findMany.mockResolvedValue([{ id: 10n, colorId: 3n, quantity: 4 }])

    await catalogAdmin.updateProduct(5n, {
      title: 'Kurti',
      category_id: 2,
      mrp: 100,
      colors: [{ id: 3, quantity: 7 }],
    })

    expect(prismaMock.productColor.deleteMany).not.toHaveBeenCalled()
    expect(prismaMock.productColor.update.mock.calls[0][0]).toMatchObject({
      where: { id: 10n },
      data: { quantity: 7 },
    })
  })

  it('leaves an unchanged pivot completely untouched', async () => {
    prismaMock.productColor.findMany.mockResolvedValue([{ id: 10n, colorId: 3n, quantity: 4 }])

    await catalogAdmin.updateProduct(5n, {
      title: 'Kurti',
      category_id: 2,
      mrp: 100,
      colors: [{ id: 3, quantity: 4 }],
    })

    expect(prismaMock.productColor.update).not.toHaveBeenCalled()
    expect(prismaMock.productColor.delete).not.toHaveBeenCalled()
  })

  it('deletes only the pivots the admin removed', async () => {
    prismaMock.productColor.findMany.mockResolvedValue([
      { id: 10n, colorId: 3n, quantity: 4 },
      { id: 11n, colorId: 4n, quantity: 2 },
    ])

    await catalogAdmin.updateProduct(5n, {
      title: 'Kurti',
      category_id: 2,
      mrp: 100,
      colors: [{ id: 3, quantity: 4 }],
    })

    expect(prismaMock.productColor.delete).toHaveBeenCalledTimes(1)
    expect(prismaMock.productColor.delete.mock.calls[0][0].where.id).toBe(11n)
  })

  it('creates pivots that are new', async () => {
    prismaMock.productColor.findMany.mockResolvedValue([])

    await catalogAdmin.updateProduct(5n, {
      title: 'Kurti',
      category_id: 2,
      mrp: 100,
      colors: [{ id: 9, quantity: 3 }],
    })

    expect(prismaMock.productColor.create.mock.calls[0][0].data).toMatchObject({
      colorId: 9n,
      quantity: 3,
    })
  })

  it('does not touch pivots at all when the field is absent', async () => {
    // Editing only a product's description must not disturb its stock.
    await catalogAdmin.updateProduct(5n, { title: 'Kurti', category_id: 2, mrp: 100 })

    expect(prismaMock.productColor.findMany).not.toHaveBeenCalled()
    expect(prismaMock.productSize.findMany).not.toHaveBeenCalled()
  })

  it('rejects a duplicate product title', async () => {
    // products.title carries a UNIQUE constraint.
    prismaMock.product.findFirst.mockResolvedValue({ id: 99n })

    await expect(
      catalogAdmin.createProduct({ title: 'Kurti', category_id: 2, mrp: 100 }),
    ).rejects.toThrow('This product title already exists. Duplicate name not allowed.')
  })

  it('excludes the product itself when checking its own title', async () => {
    await catalogAdmin.isTitleAvailable('Kurti', 5n)
    expect(prismaMock.product.findFirst.mock.calls[0][0].where.NOT).toEqual({ id: 5n })
  })
})

// ══════════════════════════════════════════════ order status machine

describe('order status transitions', () => {
  const order = (status) => ({
    id: 7n,
    orderNumber: 'ORD1',
    status,
    paymentStatus: 'paid',
    items: [],
    statusLogs: [],
    user: null,
    shippingEmail: 'a@b.com',
    shippingName: 'Asha',
  })

  it('allows a legal forward transition and logs it', async () => {
    prismaMock.order.findUnique.mockResolvedValue(order('placed'))
    prismaMock.order.update.mockResolvedValue(order('packed'))

    await orderAdmin.updateStatus(7n, { status: 'packed' })

    expect(prismaMock.order.update.mock.calls[0][0].data.status).toBe('packed')
    expect(prismaMock.orderStatusLog.create.mock.calls[0][0].data).toMatchObject({
      status: 'packed',
      description: 'Your Order has been packed.',
    })
  })

  it('REFUSES to walk a status backwards', async () => {
    prismaMock.order.findUnique.mockResolvedValue(order('shipped'))

    await expect(orderAdmin.updateStatus(7n, { status: 'packed' })).rejects.toThrow(
      'Cannot change status from Shipped to Packed.',
    )
    expect(prismaMock.order.update).not.toHaveBeenCalled()
  })

  it('REFUSES to change a delivered or cancelled order', async () => {
    for (const terminal of ['delivered', 'cancelled']) {
      prismaMock.order.findUnique.mockResolvedValue(order(terminal))
      await expect(orderAdmin.updateStatus(7n, { status: 'shipped' })).rejects.toThrow(
        /Cannot change status/,
      )
    }
  })

  it('allows cancelling from any non-terminal state', async () => {
    for (const from of ['placed', 'packed', 'shipped']) {
      vi.clearAllMocks()
      prismaMock.order.findUnique.mockResolvedValue(order(from))
      prismaMock.order.update.mockResolvedValue(order('cancelled'))
      prismaMock.$transaction.mockImplementation(async (arg) =>
        typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg),
      )

      await expect(orderAdmin.updateStatus(7n, { status: 'cancelled' })).resolves.toBeTruthy()
    }
  })

  it('cascades the status to order items', async () => {
    prismaMock.order.findUnique.mockResolvedValue(order('placed'))
    prismaMock.order.update.mockResolvedValue(order('shipped'))

    await orderAdmin.updateStatus(7n, { status: 'shipped' })

    expect(prismaMock.orderItem.updateMany.mock.calls[0][0]).toMatchObject({
      where: { orderId: 7n },
      data: { status: 'shipped' },
    })
  })

  it('emails the customer on a status change', async () => {
    prismaMock.order.findUnique.mockResolvedValue(order('placed'))
    prismaMock.order.update.mockResolvedValue(order('shipped'))

    await orderAdmin.updateStatus(7n, { status: 'shipped' })

    expect(sentEmails).toHaveLength(1)
    expect(sentEmails[0].subject).toBe('Order ORD1 — Shipped')
  })

  it('emails when the delivery date changes', async () => {
    prismaMock.order.findUnique.mockResolvedValue(order('placed'))
    prismaMock.order.update.mockResolvedValue({
      ...order('placed'),
      expectedDeliveryDate: new Date('2026-10-01'),
    })

    await orderAdmin.updateDeliveryDate(7n, '2026-10-01')
    expect(sentEmails[0].subject).toBe('Expected delivery update — ORD1')
  })

  it('offers only legal next options', async () => {
    prismaMock.order.findUnique.mockResolvedValue(order('shipped'))
    const payload = await orderAdmin.statusPayload(7n)
    expect(payload.options.map((o) => o.value)).toEqual(['delivered', 'cancelled'])
  })
})

describe('order deletion', () => {
  it('REFUSES to delete a paid order', async () => {
    // Deleting one destroys the financial record and orphans the Razorpay payment.
    prismaMock.order.findUnique.mockResolvedValue({
      id: 7n,
      orderNumber: 'ORD1',
      paymentStatus: 'paid',
      status: 'placed',
      items: [],
      statusLogs: [],
    })

    await expect(orderAdmin.deleteOrder(7n)).rejects.toThrow('A paid order cannot be deleted')
    expect(prismaMock.order.delete).not.toHaveBeenCalled()
  })

  it('allows deleting an abandoned pending order', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 7n,
      orderNumber: 'ORD1',
      paymentStatus: 'pending',
      status: 'pending',
      items: [],
      statusLogs: [],
    })

    await orderAdmin.deleteOrder(7n)
    expect(prismaMock.order.delete).toHaveBeenCalled()
  })

  it('skips paid orders in a bulk delete and reports which', async () => {
    prismaMock.order.findUnique
      .mockResolvedValueOnce({ id: 1n, orderNumber: 'ORD1', paymentStatus: 'paid' })
      .mockResolvedValueOnce({ id: 2n, orderNumber: 'ORD2', paymentStatus: 'pending' })

    const message = await orderAdmin.bulkOrderAction('delete', [1n, 2n])

    expect(message).toContain('1 order(s) deleted')
    expect(message).toContain('ORD1')
    expect(prismaMock.order.delete).toHaveBeenCalledTimes(1)
  })
})

// ══════════════════════════════════════════════ admin self-protection

describe('an admin cannot lock themselves out', () => {
  it('refuses to delete their own account', async () => {
    await expect(miscAdmin.deleteUser(1n, 1n)).rejects.toThrow('You cannot delete your own account.')
    expect(prismaMock.user.delete).not.toHaveBeenCalled()
  })

  it('refuses to deactivate their own account', async () => {
    await expect(miscAdmin.toggleUser(1n, 1n)).rejects.toThrow(
      'You cannot deactivate your own account.',
    )
  })

  it('excludes self from a bulk user action', async () => {
    await miscAdmin.bulkUserAction('disable', [1n, 2n, 3n], 1n)
    expect(prismaMock.user.updateMany.mock.calls[0][0].where.id.in).toEqual([2n, 3n])
  })

  it('lets an admin act on OTHER accounts', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 2n, isActive: true })
    prismaMock.user.update.mockResolvedValue({ id: 2n, isActive: false })

    await expect(miscAdmin.toggleUser(2n, 1n)).resolves.toBe(false)
  })

  it('does not require the current password when an admin resets someone else\'s', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 2n, email: 'a@b.com', role: 'customer' })
    prismaMock.user.findFirst.mockResolvedValue(null)

    await miscAdmin.updateUser(2n, { name: 'Asha', password: 'newpassword' })
    expect(prismaMock.user.update.mock.calls[0][0].data.password).toMatch(/^\$2b\$10\$/)
  })

  it('refuses to edit a non-customer through the customer screens', async () => {
    // `ensureCustomer` — UserController 404s anything that is not a customer, so the
    // customer form cannot be pointed at an administrator's row.
    prismaMock.user.findUnique.mockResolvedValue({ id: 1n, email: 'a@b.com', role: 'admin' })

    await expect(miscAdmin.updateUser(1n, { name: 'Nope' })).rejects.toThrow('User not found.')
  })

  it('always creates a CUSTOMER, whatever role the request asks for', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue({ id: 5n })

    await miscAdmin.createUser({
      name: 'Asha',
      email: 'Asha@Example.com',
      password: 'secret123',
      role: 'admin',
    })

    const data = prismaMock.user.create.mock.calls.at(-1)[0].data
    expect(data.role).toBe('customer')
    expect(data.platform).toBe('Web')
    expect(data.email).toBe('asha@example.com')
  })
})

// ══════════════════════════════════════════════ coupons & settings

describe('coupon administration', () => {
  it('upper-cases the code', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(null)
    await miscAdmin.createCoupon({ code: ' save10 ', discount_type: 'percent', discount_percent: 10 })
    expect(prismaMock.coupon.create.mock.calls[0][0].data.code).toBe('SAVE10')
  })

  it('rejects a duplicate code', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue({ id: 99n })
    await expect(
      miscAdmin.createCoupon({ code: 'SAVE10', discount_type: 'percent', discount_percent: 10 }),
    ).rejects.toThrow('This coupon code already exists.')
  })

  it('never lets used_count be written from the form', async () => {
    // It is derived from redemptions; editing it would break usage_limit enforcement.
    prismaMock.coupon.findUnique.mockResolvedValue({ id: 5n, code: 'SAVE10', usedCount: 3 })
    prismaMock.coupon.findFirst.mockResolvedValue(null)

    await miscAdmin.updateCoupon(5n, {
      code: 'SAVE10',
      discount_type: 'percent',
      discount_percent: 10,
      used_count: 0,
    })

    expect(prismaMock.coupon.update.mock.calls[0][0].data).not.toHaveProperty('usedCount')
  })

  it('rejects a coupon that could never discount anything', async () => {
    const res = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', cookieFor(ADMIN))
      .send({ code: 'DEAD', discount_type: 'percent', discount_percent: 0 })

    expect(res.status).toBe(422)
    // CouponController's own wording, so the admin's toast reads as it always did.
    expect(JSON.stringify(res.body.errors)).toContain('Enter discount in % OR amount')
  })

  it('rejects a coupon carrying both a percentage and an amount', async () => {
    const res = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', cookieFor(ADMIN))
      .send({ code: 'BOTH', discount_percent: 10, discount_amount: 50 })

    expect(res.status).toBe(422)
    expect(JSON.stringify(res.body.errors)).toContain('not both')
  })

  it('accepts every offer type the coupon form offers, not just coupon and bogo', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(null)
    prismaMock.coupon.create.mockResolvedValue({ id: 9n })

    const res = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', cookieFor(ADMIN))
      .field('code', 'DIWALI')
      .field('offer_type', 'seasonal')
      .field('discount_percent', '15')
      .field('max_discount_status', '0')
      .field('min_cart_status', '0')
      .attach('image', Buffer.from('x'), { filename: 'c.jpg', contentType: 'image/jpeg' })

    expect(res.status).not.toBe(422)
  })

  it('nulls the fields a BOGO coupon hides rather than keeping stale values', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(null)
    prismaMock.coupon.create.mockResolvedValue({ id: 10n })

    await miscAdmin.createCoupon({
      code: 'B1G1',
      offer_type: 'bogo',
      discount_percent: 25,
      discount_amount: 99,
      max_discount_status: true,
      max_discount_amount: 200,
      bogo_buy_quantity: 1,
      bogo_get_quantity: 1,
      applies_to: 'all',
      category_ids: [3],
    })

    const data = prismaMock.coupon.create.mock.calls.at(-1)[0].data
    expect(data.discountPercent).toBeNull()
    expect(data.discountAmount).toBeNull()
    expect(data.maxDiscountStatus).toBe(false)
    expect(data.maxDiscountAmount).toBeNull()
    // applies_to is 'all', so the category list is dropped too.
    expect(data.categoryIds).toBeNull()
  })

  it('stores a datetime-local wall clock as the digits the admin typed', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(null)
    prismaMock.coupon.create.mockResolvedValue({ id: 11n })

    await miscAdmin.createCoupon({
      code: 'TIMED',
      discount_percent: 10,
      starts_at: '2026-08-09T20:27',
    })

    const data = prismaMock.coupon.create.mock.calls.at(-1)[0].data
    expect(data.startsAt.toISOString()).toBe('2026-08-09T20:27:00.000Z')
  })

  it('rejects a BOGO coupon without buy/get quantities', async () => {
    const res = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', cookieFor(ADMIN))
      .send({ code: 'BOGO', offer_type: 'bogo' })

    expect(res.status).toBe(422)
    expect(JSON.stringify(res.body.errors)).toContain('Buy and Get quantities')
  })

  it('rejects an end date before the start date', async () => {
    const res = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Cookie', cookieFor(ADMIN))
      .send({
        code: 'X',
        discount_type: 'percent',
        discount_percent: 10,
        starts_at: '2026-06-01',
        ends_at: '2026-01-01',
      })

    expect(res.status).toBe(422)
    expect(JSON.stringify(res.body.errors)).toContain('after the start date')
  })
})

describe('home sections', () => {
  it('replaces the section atomically and renumbers positions from 1', async () => {
    // (section, position) is UNIQUE, so the old rows must go before the new ones land.
    await miscAdmin.updateHomeSection('shop_the_look', [7, 9])

    expect(prismaMock.homeSectionProduct.deleteMany.mock.calls[0][0].where).toEqual({
      section: 'shop_the_look',
    })
    expect(prismaMock.homeSectionProduct.create.mock.calls[0][0].data.position).toBe(1)
    expect(prismaMock.homeSectionProduct.create.mock.calls[1][0].data.position).toBe(2)
  })
})

describe('shipping settings', () => {
  it('updates the existing single row', async () => {
    prismaMock.shippingSetting.findFirst.mockResolvedValue({ id: 1n })
    prismaMock.shippingSetting.update.mockResolvedValue({
      id: 1n,
      freeShippingThreshold: 999,
      flatShippingRate: 70,
    })

    const result = await miscAdmin.updateShippingSettings({
      free_shipping_threshold: 999,
      flat_shipping_rate: 70,
    })

    expect(result.freeShippingThreshold).toBe(999)
    expect(prismaMock.shippingSetting.create).not.toHaveBeenCalled()
  })

  it('seeds the row on first save', async () => {
    prismaMock.shippingSetting.findFirst.mockResolvedValue(null)
    prismaMock.shippingSetting.create.mockResolvedValue({
      id: 1n,
      freeShippingThreshold: 899,
      flatShippingRate: 60,
    })

    await miscAdmin.updateShippingSettings({ free_shipping_threshold: 899, flat_shipping_rate: 60 })
    expect(prismaMock.shippingSetting.create).toHaveBeenCalled()
  })

  it('rejects a negative rate', async () => {
    const res = await request(app)
      .put('/api/v1/admin/settings/shipping')
      .set('Cookie', cookieFor(ADMIN))
      .send({ free_shipping_threshold: -1, flat_shipping_rate: 60 })

    expect(res.status).toBe(422)
  })
})

describe('CMS pages', () => {
  it('rejects a slug outside the allow-list', async () => {
    await expect(miscAdmin.updateSitePage('made-up', { content: 'x' })).rejects.toThrow(
      'Page not found.',
    )
  })

  it('upserts an allowed page', async () => {
    await miscAdmin.updateSitePage('about-us', { content: '<p>Hi</p>' })
    expect(prismaMock.page.upsert.mock.calls[0][0].where).toEqual({ slug: 'about-us' })
  })
})

// ══════════════════════════════════════════════ routing & HTTP

describe('admin routing', () => {
  it('does not read literal product paths as ids', async () => {
    // check-title, form-data, sub-categories and bulk are declared before /products/:id.
    const res = await request(app)
      .get('/api/v1/admin/products/check-title?title=Kurti')
      .set('Cookie', cookieFor(ADMIN))

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('available')
  })

  it('does not read /orders/statuses as an order id', async () => {
    const res = await request(app).get('/api/v1/admin/orders/statuses').set('Cookie', cookieFor(ADMIN))
    expect(res.status).toBe(200)
    expect(res.body.data.statuses).toHaveLength(5)
  })

  it('accepts a banner update over POST as well as PATCH', async () => {
    // Laravel used POST because Hostinger's ModSecurity blocks PUT.
    prismaMock.banner.findUnique.mockResolvedValue({ id: 3n, images: [] })
    prismaMock.banner.update.mockResolvedValue({ id: 3n, images: [] })

    for (const method of ['post', 'patch']) {
      const res = await request(app)[method]('/api/v1/admin/banners/3')
        .set('Cookie', cookieFor(ADMIN))
        .send({ title: 'Hero', section: 'home_hero' })
      expect(res.status).toBe(200)
    }
  })

  it('rejects an unknown banner section', async () => {
    const res = await request(app)
      .post('/api/v1/admin/banners')
      .set('Cookie', cookieFor(ADMIN))
      .send({ title: 'Hero', section: 'not_a_section' })

    expect(res.status).toBe(422)
  })

  it('validates a bulk action before touching anything', async () => {
    const res = await request(app)
      .post('/api/v1/admin/products/bulk')
      .set('Cookie', cookieFor(ADMIN))
      .send({ action: 'destroy_everything', ids: [1] })

    expect(res.status).toBe(422)
    expect(prismaMock.product.updateMany).not.toHaveBeenCalled()
  })

  it('requires at least one id for a bulk action', async () => {
    const res = await request(app)
      .post('/api/v1/admin/products/bulk')
      .set('Cookie', cookieFor(ADMIN))
      .send({ action: 'enable', ids: [] })

    expect(res.status).toBe(422)
  })

  it('serves dashboard aggregates without loading whole tables', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard').set('Cookie', cookieFor(ADMIN))

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('revenue')
    expect(res.body.data).toHaveProperty('orders')
    // Counts and aggregates, never findMany over everything.
    expect(prismaMock.product.count).toHaveBeenCalled()
    expect(prismaMock.order.aggregate).toHaveBeenCalled()
  })

  it('shares one CRUD implementation across the simple resources', async () => {
    for (const path of ['categories', 'brands', 'colors', 'sizes', 'offers', 'news-types']) {
      const res = await request(app).get(`/api/v1/admin/${path}`).set('Cookie', cookieFor(ADMIN))
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('items')
      expect(res.body.data).toHaveProperty('pagination')
    }
  })
})
