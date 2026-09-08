import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Phases 6 + 8 — wishlist and account.
 *
 * Ported from AccountController. The emphasis here is AUTHORISATION: every mutation takes
 * a row id from the URL, so each one is tested against another customer's row. A missing
 * ownership check is the classic IDOR, and it would be invisible in normal use.
 */

const model = () => ({
  findMany: vi.fn(async () => []),
  findFirst: vi.fn(async () => null),
  findUnique: vi.fn(async () => null),
  count: vi.fn(async () => 0),
  create: vi.fn(async ({ data }) => ({ id: 100n, ...data })),
  update: vi.fn(async ({ where, data }) => ({ id: where.id, ...data })),
  updateMany: vi.fn(async () => ({ count: 0 })),
  delete: vi.fn(async () => ({})),
  deleteMany: vi.fn(async () => ({ count: 0 })),
})

const prismaMock = {
  user: model(),
  userAddress: model(),
  wishlist: model(),
  productReview: model(),
  order: model(),
  product: model(),
  cartItem: model(),
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

const request = (await import('supertest')).default
const app = (await import('../src/app.js')).default
const account = await import('../src/services/account.service.js')
const { signAuthToken, AUTH_COOKIE } = await import('../src/utils/auth-token.js')
const { hashPassword } = await import('../src/utils/password.js')
const { nextOptions, canTransition, normaliseStatus, statusLabel } = await import(
  '../src/constants/order-statuses.js'
)

const CUSTOMER = {
  id: 1n,
  name: 'Asha Menon',
  email: 'asha@example.com',
  phone: '9876543210',
  role: 'customer',
  isActive: true,
  loginProvider: 'email',
  marketingOptIn: true,
  birthDate: null,
  avatar: null,
  password: '$2b$10$abcdefghijklmnopqrstuvABCDEFGHIJKLMNOPQRSTUVWXYZ012345',
}

const authCookie = (user = CUSTOMER) => `${AUTH_COOKIE}=${signAuthToken(user)}`

beforeEach(() => {
  vi.clearAllMocks()
  for (const entry of Object.values(prismaMock)) {
    if (entry && typeof entry === 'object' && entry.findMany) {
      entry.findMany.mockResolvedValue([])
      entry.findFirst.mockResolvedValue(null)
      entry.findUnique.mockResolvedValue(null)
      entry.count.mockResolvedValue(0)
    }
  }
  // requireAuth reloads the user from the database on every request.
  prismaMock.user.findUnique.mockResolvedValue(CUSTOMER)
  prismaMock.$transaction.mockImplementation(async (arg) =>
    typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg),
  )
})

// ─────────────────────────────────────────────── authorisation

describe('account is closed to anonymous and admin callers', () => {
  const routes = [
    ['get', '/api/v1/account/overview'],
    ['get', '/api/v1/account/addresses'],
    ['post', '/api/v1/account/addresses'],
    ['patch', '/api/v1/account/profile'],
    ['get', '/api/v1/account/wishlist'],
    ['post', '/api/v1/account/wishlist'],
    ['get', '/api/v1/account/orders'],
    ['get', '/api/v1/account/reviews'],
  ]

  it.each(routes)('%s %s requires authentication', async (method, url) => {
    const res = await request(app)[method](url).send({})
    expect(res.status).toBe(401)
  })

  it('rejects an ADMIN from the customer account area', async () => {
    const admin = { ...CUSTOMER, id: 9n, role: 'admin' }
    prismaMock.user.findUnique.mockResolvedValue(admin)

    const res = await request(app)
      .get('/api/v1/account/overview')
      .set('Cookie', authCookie(admin))

    expect(res.status).toBe(403)
  })
})

describe('ownership — IDOR guards', () => {
  const OTHER = 999n

  it('refuses to update another customer\'s address', async () => {
    prismaMock.userAddress.findUnique.mockResolvedValue({ id: 5n, userId: OTHER, label: 'Home' })

    const res = await request(app)
      .patch('/api/v1/account/addresses/5')
      .set('Cookie', authCookie())
      .send({ name: 'X', address_line1: 'Y', city: 'C', pincode: '1', country: 'India' })

    expect(res.status).toBe(403)
    expect(prismaMock.userAddress.update).not.toHaveBeenCalled()
  })

  it('refuses to delete another customer\'s address', async () => {
    prismaMock.userAddress.findUnique.mockResolvedValue({ id: 5n, userId: OTHER })

    const res = await request(app)
      .delete('/api/v1/account/addresses/5')
      .set('Cookie', authCookie())

    expect(res.status).toBe(403)
    expect(prismaMock.userAddress.delete).not.toHaveBeenCalled()
  })

  it('refuses to make another customer\'s address default', async () => {
    prismaMock.userAddress.findUnique.mockResolvedValue({ id: 5n, userId: OTHER })

    const res = await request(app)
      .post('/api/v1/account/addresses/5/default')
      .set('Cookie', authCookie())

    expect(res.status).toBe(403)
    expect(prismaMock.userAddress.updateMany).not.toHaveBeenCalled()
  })

  it('refuses to delete another customer\'s wishlist item', async () => {
    prismaMock.wishlist.findUnique.mockResolvedValue({ id: 5n, userId: OTHER })

    const res = await request(app)
      .delete('/api/v1/account/wishlist/5')
      .set('Cookie', authCookie())

    expect(res.status).toBe(403)
    expect(prismaMock.wishlist.delete).not.toHaveBeenCalled()
  })

  it('refuses to delete another customer\'s review', async () => {
    prismaMock.productReview.findUnique.mockResolvedValue({ id: 5n, userId: OTHER })

    const res = await request(app)
      .delete('/api/v1/account/reviews/5')
      .set('Cookie', authCookie())

    expect(res.status).toBe(403)
    expect(prismaMock.productReview.delete).not.toHaveBeenCalled()
  })

  it('404s rather than 403s for a row that does not exist', async () => {
    const res = await request(app)
      .delete('/api/v1/account/addresses/12345')
      .set('Cookie', authCookie())
    expect(res.status).toBe(404)
  })
})

// ─────────────────────────────────────────────── profile

describe('updateProfile', () => {
  it('joins first and last name into `name`', async () => {
    await account.updateProfile(CUSTOMER, {
      first_name: 'Asha',
      last_name: 'Rani Menon',
      email: 'asha@example.com',
    })
    expect(prismaMock.user.update.mock.calls[0][0].data.name).toBe('Asha Rani Menon')
  })

  it('trims cleanly when there is no last name', async () => {
    await account.updateProfile(CUSTOMER, { first_name: 'Asha', email: 'asha@example.com' })
    expect(prismaMock.user.update.mock.calls[0][0].data.name).toBe('Asha')
  })

  it('rejects an email already taken by someone else', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 7n })
    await expect(
      account.updateProfile(CUSTOMER, { first_name: 'A', email: 'taken@example.com' }),
    ).rejects.toThrow('This email is already registered.')
  })

  it('allows keeping your own email', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null) // excluded by NOT: { id }
    await expect(
      account.updateProfile(CUSTOMER, { first_name: 'A', email: 'asha@example.com' }),
    ).resolves.toBeTruthy()

    expect(prismaMock.user.findFirst.mock.calls[0][0].where.NOT).toEqual({ id: 1n })
  })

  it('requires the CURRENT password to set a new one', async () => {
    // Without this a hijacked session could change the password and lock the owner out.
    const user = { ...CUSTOMER, password: await hashPassword('correct-current') }

    await expect(
      account.updateProfile(user, {
        first_name: 'A',
        email: 'asha@example.com',
        current_password: 'wrong',
        new_password: 'newpassword',
      }),
    ).rejects.toThrow('Current password is incorrect.')

    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('changes the password when the current one is correct, storing a hash', async () => {
    const user = { ...CUSTOMER, password: await hashPassword('correct-current') }

    await account.updateProfile(user, {
      first_name: 'A',
      email: 'asha@example.com',
      current_password: 'correct-current',
      new_password: 'brandnew1',
    })

    const { data } = prismaMock.user.update.mock.calls[0][0]
    expect(data.password).toMatch(/^\$2b\$10\$/)
    expect(data.password).not.toBe('brandnew1')
  })

  it('does not touch the password when none is supplied', async () => {
    await account.updateProfile(CUSTOMER, { first_name: 'A', email: 'asha@example.com' })
    expect(prismaMock.user.update.mock.calls[0][0].data).not.toHaveProperty('password')
  })

  it('leaves marketing_opt_in alone when the field is absent', async () => {
    await account.updateProfile(CUSTOMER, { first_name: 'A', email: 'asha@example.com' })
    expect(prismaMock.user.update.mock.calls[0][0].data).not.toHaveProperty('marketingOptIn')
  })

  it('rejects a mismatched confirmation over HTTP', async () => {
    const res = await request(app)
      .patch('/api/v1/account/profile')
      .set('Cookie', authCookie())
      .send({
        first_name: 'A',
        email: 'asha@example.com',
        current_password: 'x',
        new_password: 'abcdef',
        new_password_confirmation: 'different',
      })

    expect(res.status).toBe(422)
    expect(JSON.stringify(res.body.errors)).toContain('New passwords do not match.')
  })

  it('rejects a future birth date', async () => {
    const res = await request(app)
      .patch('/api/v1/account/profile')
      .set('Cookie', authCookie())
      .send({ first_name: 'A', email: 'asha@example.com', birth_date: '2099-01-01' })

    expect(res.status).toBe(422)
  })
})

// ─────────────────────────────────────────────── addresses

describe('addresses', () => {
  it('makes the FIRST address default automatically', async () => {
    // Otherwise checkout has nothing to pre-fill.
    prismaMock.userAddress.count.mockResolvedValue(0)

    await account.createAddress(1n, {
      name: 'Asha',
      address_line1: '1 Road',
      city: 'Pune',
      pincode: '411001',
      country: 'India',
    })

    expect(prismaMock.userAddress.create.mock.calls[0][0].data.isDefault).toBe(true)
  })

  it('does not auto-default a second address', async () => {
    prismaMock.userAddress.count.mockResolvedValue(2)

    await account.createAddress(1n, {
      name: 'Asha',
      address_line1: '1 Road',
      city: 'Pune',
      pincode: '411001',
      country: 'India',
    })

    expect(prismaMock.userAddress.create.mock.calls[0][0].data.isDefault).toBe(false)
  })

  it('un-defaults the others when a new default is created', async () => {
    prismaMock.userAddress.count.mockResolvedValue(3)

    await account.createAddress(1n, {
      name: 'Asha',
      address_line1: '1 Road',
      city: 'Pune',
      pincode: '411001',
      country: 'India',
      is_default: true,
    })

    expect(prismaMock.userAddress.updateMany.mock.calls[0][0]).toMatchObject({
      where: { userId: 1n },
      data: { isDefault: false },
    })
  })

  it('un-defaults every OTHER address when one is promoted', async () => {
    prismaMock.userAddress.findUnique.mockResolvedValue({ id: 5n, userId: 1n, label: 'Home' })

    await account.updateAddress(1n, 5n, {
      name: 'Asha',
      address_line1: '1 Road',
      city: 'Pune',
      pincode: '411001',
      country: 'India',
      is_default: true,
    })

    expect(prismaMock.userAddress.updateMany.mock.calls[0][0].where).toEqual({
      userId: 1n,
      NOT: { id: 5n },
    })
  })

  it('preserves the existing default flag when the field is omitted', async () => {
    prismaMock.userAddress.findUnique.mockResolvedValue({
      id: 5n,
      userId: 1n,
      isDefault: true,
      label: 'Home',
    })

    await account.updateAddress(1n, 5n, {
      name: 'Asha',
      address_line1: '1 Road',
      city: 'Pune',
      pincode: '411001',
      country: 'India',
    })

    expect(prismaMock.userAddress.update.mock.calls[0][0].data.isDefault).toBe(true)
  })

  it('defaults the label to Shipping', async () => {
    prismaMock.userAddress.count.mockResolvedValue(1)
    await account.createAddress(1n, {
      name: 'Asha',
      address_line1: '1 Road',
      city: 'Pune',
      pincode: '411001',
      country: 'India',
    })
    expect(prismaMock.userAddress.create.mock.calls[0][0].data.label).toBe('Shipping')
  })

  it('validates required address fields', async () => {
    const res = await request(app)
      .post('/api/v1/account/addresses')
      .set('Cookie', authCookie())
      .send({ name: 'Asha' })

    expect(res.status).toBe(422)
    expect(Object.keys(res.body.errors)).toEqual(
      expect.arrayContaining(['address_line1', 'city', 'pincode', 'country']),
    )
  })
})

// ─────────────────────────────────────────────── wishlist

describe('wishlist', () => {
  it('is idempotent — adding twice does not duplicate or error', async () => {
    // The table has a unique key on (user_id, product_id); firstOrCreate never errored.
    prismaMock.product.findUnique.mockResolvedValue({ id: 4n })
    prismaMock.wishlist.findFirst.mockResolvedValue({
      id: 8n,
      userId: 1n,
      productId: 4n,
      product: { id: 4n, title: 'Kurti', slug: 'kurti', isActive: true, mrp: 100, sellingPrice: 80 },
    })

    const result = await account.addToWishlist(1n, 4n)

    expect(result.created).toBe(false)
    expect(prismaMock.wishlist.create).not.toHaveBeenCalled()
  })

  it('reports `created` for a genuinely new entry, which gates the Meta event', async () => {
    prismaMock.product.findUnique.mockResolvedValue({ id: 4n })
    prismaMock.wishlist.findFirst.mockResolvedValue(null)
    prismaMock.wishlist.create.mockResolvedValue({
      id: 9n,
      userId: 1n,
      productId: 4n,
      product: { id: 4n, title: 'Kurti', slug: 'kurti', isActive: true, mrp: 100, sellingPrice: 80 },
    })

    const result = await account.addToWishlist(1n, 4n)
    expect(result.created).toBe(true)
  })

  it('404s for a product that does not exist', async () => {
    prismaMock.product.findUnique.mockResolvedValue(null)
    await expect(account.addToWishlist(1n, 999n)).rejects.toThrow('Product not found.')
  })

  it('skips rows whose product has been deleted', async () => {
    prismaMock.wishlist.findMany.mockResolvedValue([
      { id: 1n, productId: 4n, product: null },
      {
        id: 2n,
        productId: 5n,
        product: { id: 5n, title: 'Kurti', slug: 'kurti', isActive: true, mrp: 100, sellingPrice: 80 },
      },
    ])

    const wishlist = await account.listWishlist(1n)
    expect(wishlist).toHaveLength(1)
  })

  it('marks a deactivated product Unavailable rather than hiding it', async () => {
    prismaMock.wishlist.findMany.mockResolvedValue([
      {
        id: 1n,
        productId: 4n,
        product: { id: 4n, title: 'Kurti', slug: 'kurti', isActive: false, mrp: 100, sellingPrice: 80 },
      },
    ])

    const [item] = await account.listWishlist(1n)
    expect(item.availability).toBe('Unavailable')
    expect(item.discountPercent).toBe(20)
  })

  it('can remove by product id, for the product-page toggle', async () => {
    prismaMock.wishlist.findFirst.mockResolvedValue({ id: 8n, userId: 1n, productId: 4n })
    await account.removeProductFromWishlist(1n, 4n)
    expect(prismaMock.wishlist.delete.mock.calls[0][0].where.id).toBe(8n)
  })
})

// ─────────────────────────────────────────────── reviews & orders

describe('reviews', () => {
  it('matches by user_id OR reviewer_email', async () => {
    // A review left as a guest before the account existed still appears once the
    // addresses match.
    await account.listReviews(CUSTOMER)
    expect(prismaMock.productReview.findMany.mock.calls[0][0].where.OR).toEqual([
      { userId: 1n },
      { reviewerEmail: 'asha@example.com' },
    ])
  })

  it('flags email-matched reviews as not deletable', async () => {
    // Ownership is checked on user_id alone, so a NULL-user row would 403. Surfacing
    // `canDelete` lets the UI hide the control instead of offering a broken action.
    prismaMock.productReview.findMany.mockResolvedValue([
      { id: 1n, userId: null, rating: 5, product: null, createdAt: new Date() },
      { id: 2n, userId: 1n, rating: 4, product: null, createdAt: new Date() },
    ])

    const reviews = await account.listReviews(CUSTOMER)
    expect(reviews[0].canDelete).toBe(false)
    expect(reviews[1].canDelete).toBe(true)
  })
})

describe('order history', () => {
  it('shows only paid or progressed orders', async () => {
    // A `pending` order is one where checkout started but Razorpay never confirmed.
    // Showing those would present customers with orders they never completed.
    await account.listOrders(1n)

    const { where } = prismaMock.order.findMany.mock.calls[0][0]
    expect(where.OR[0]).toEqual({ paymentStatus: 'paid' })
    expect(where.OR[1].status.in).toEqual(['placed', 'packed', 'shipped', 'delivered'])
    expect(where.OR[1].status.in).not.toContain('pending')
  })

  it('orders by ordered_at then id, both descending', async () => {
    await account.listOrders(1n)
    expect(prismaMock.order.findMany.mock.calls[0][0].orderBy).toEqual([
      { orderedAt: 'desc' },
      { id: 'desc' },
    ])
  })

  it('displays a legacy `pending` status as Placed', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: 1n,
        orderNumber: 'PP-1',
        status: 'pending',
        paymentStatus: 'paid',
        payableAmount: 1000,
        subtotal: 940,
        discountAmount: 0,
        deliveryCharge: 60,
        orderedAt: new Date('2026-01-02'),
        items: [{ quantity: 2, price: 470, totalPrice: 940, productTitle: 'Kurti', status: 'placed' }],
      },
    ])

    const [order] = await account.listOrders(1n)
    expect(order.statusKey).toBe('placed')
    expect(order.status).toBe('Placed')
    expect(order.itemsCount).toBe(2)
    expect(order.totalFormatted).toBe('₹ 1,000.00')
  })

  it('blocks a customer from reading another customer\'s order', async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: 1n,
      orderNumber: 'PP-1',
      userId: 999n,
      status: 'placed',
      items: [],
      statusLogs: [],
    })

    await expect(account.getOrderByNumber('PP-1', CUSTOMER)).rejects.toThrow(
      'This action is unauthorized.',
    )
  })

  it('lets an admin read any order', async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: 1n,
      orderNumber: 'PP-1',
      userId: 999n,
      status: 'placed',
      payableAmount: 0,
      subtotal: 0,
      discountAmount: 0,
      deliveryCharge: 0,
      items: [],
      statusLogs: [],
    })

    await expect(
      account.getOrderByNumber('PP-1', { id: 5n, role: 'admin' }),
    ).resolves.toMatchObject({ number: 'PP-1' })
  })
})

// ─────────────────────────────────────────────── status machine

describe('order status machine', () => {
  it('moves forward only, with cancel available until terminal', () => {
    expect(Object.keys(nextOptions('placed'))).toEqual(['packed', 'shipped', 'delivered', 'cancelled'])
    expect(Object.keys(nextOptions('packed'))).toEqual(['shipped', 'delivered', 'cancelled'])
    expect(Object.keys(nextOptions('shipped'))).toEqual(['delivered', 'cancelled'])
  })

  it('treats delivered and cancelled as terminal', () => {
    expect(nextOptions('delivered')).toEqual({})
    expect(nextOptions('cancelled')).toEqual({})
    expect(canTransition('delivered', 'shipped')).toBe(false)
    expect(canTransition('cancelled', 'placed')).toBe(false)
  })

  it('never allows walking a status backwards', () => {
    expect(canTransition('shipped', 'packed')).toBe(false)
    expect(canTransition('packed', 'placed')).toBe(false)
  })

  it('folds legacy `pending` into `placed`', () => {
    expect(normaliseStatus('pending')).toBe('placed')
    expect(statusLabel('pending')).toBe('Placed')
    expect(canTransition('pending', 'packed')).toBe(true)
  })
})

// ─────────────────────────────────────────────── HTTP

describe('account endpoints', () => {
  it('GET /account/overview returns the full bootstrap', async () => {
    const res = await request(app).get('/api/v1/account/overview').set('Cookie', authCookie())

    expect(res.status).toBe(200)
    expect(res.body.data.page).toBe('overview')
    for (const key of ['customer', 'orders', 'addresses', 'wishlist', 'reviews']) {
      expect(res.body.data).toHaveProperty(key)
    }
  })

  it('never returns the password hash', async () => {
    const res = await request(app).get('/api/v1/account/overview').set('Cookie', authCookie())
    expect(JSON.stringify(res.body)).not.toContain('$2b$')
  })

  it('redirects the legacy `favorites` and `wishlists` aliases to wishlist', async () => {
    for (const alias of ['favorites', 'wishlists']) {
      const res = await request(app).get(`/api/v1/account/${alias}`).set('Cookie', authCookie())
      expect(res.status).toBe(200)
      expect(res.body.data.page).toBe('wishlist')
    }
  })

  it('404s for a page outside the allow-list', async () => {
    const res = await request(app).get('/api/v1/account/made-up').set('Cookie', authCookie())
    expect(res.status).toBe(404)
  })

  it('does not read "addresses" as an account page name', async () => {
    // Route-order regression guard: literals precede /:page.
    const res = await request(app).get('/api/v1/account/addresses').set('Cookie', authCookie())
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('addresses')
    expect(res.body.data).not.toHaveProperty('page')
  })
})
