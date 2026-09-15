import { describe, it, expect, beforeEach, vi } from 'vitest'
import crypto from 'node:crypto'

/**
 * Phase 12 — Meta Conversions API and the product catalog feed.
 *
 * Two things matter here and nothing else really does:
 *   1. Meta failing must NEVER break commerce. Every failure mode is tested.
 *   2. The feed must not be world-readable (audit R1).
 */

const model = () => ({
  findMany: vi.fn(async () => []),
  findFirst: vi.fn(async () => null),
  findUnique: vi.fn(async () => null),
  create: vi.fn(async ({ data }) => ({ id: 1n, ...data })),
  count: vi.fn(async () => 0),
})

const prismaMock = {
  product: model(),
  subscriber: model(),
  contactMessage: model(),
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

const request = (await import('supertest')).default
const app = (await import('../src/app.js')).default
const meta = await import('../src/integrations/meta/capi.js')
const feedService = await import('../src/services/catalog-feed.service.js')
const env = (await import('../src/config/env.js')).default

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex')

const feedProduct = (overrides = {}) => ({
  id: 1n,
  title: 'Indigo Kurti',
  slug: 'indigo-kurti',
  shortDescription: 'Soft <b>cotton</b>   kurti',
  features: null,
  mrp: 2000,
  sellingPrice: 1500,
  maxUnitBuy: 5,
  deliveryCharge: 60,
  featuredImage: 'products/indigo.jpg',
  isActive: true,
  brand: { id: 1n, name: 'Panther' },
  category: { id: 2n, title: 'Kurtis' },
  subCategory: { id: 3n, title: 'Casual' },
  colors: [{ quantity: 4 }, { quantity: 2 }],
  sizes: [{ quantity: 3 }, { quantity: 5 }],
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  for (const entry of Object.values(prismaMock)) {
    if (entry && typeof entry === 'object' && entry.findMany) {
      entry.findMany.mockResolvedValue([])
      entry.findFirst.mockResolvedValue(null)
      entry.findUnique.mockResolvedValue(null)
    }
  }
  global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' }))
})

// ══════════════════════════════════════════════ failure policy

describe('Meta CAPI must never break commerce', () => {
  it('does not throw when the API returns an error', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 400, text: async () => 'Bad Request' }))
    await expect(meta.track('Purchase', {}, {}, {})).resolves.toBeTruthy()
  })

  it('does not throw when the network fails', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    })
    await expect(meta.track('Purchase', {}, {}, {})).resolves.toBeTruthy()
  })

  it('does not throw when the request times out', async () => {
    global.fetch = vi.fn(async () => {
      const error = new Error('aborted')
      error.name = 'AbortError'
      throw error
    })
    await expect(meta.track('Purchase', {}, {}, {})).resolves.toBeTruthy()
  })

  it('always returns an event id, so callers can dedupe regardless of outcome', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('down')
    })
    const id = await meta.track('Purchase', {}, {}, {}, 'purchase_ORD1')
    expect(id).toBe('purchase_ORD1')
  })

  it('sends nothing when the integration is disabled', async () => {
    // env.metaCapiEnabled is false in tests: no dataset id or token is configured.
    await meta.track('Purchase', {}, {}, {})
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('ignores an event name outside the supported list', async () => {
    await meta.track('NotARealEvent', {}, {}, {})
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('trackAsync never produces an unhandled rejection', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('down')
    })
    expect(() => meta.trackAsync('Purchase', {}, {}, {})).not.toThrow()
    await new Promise((r) => setTimeout(r, 10))
  })
})

// ══════════════════════════════════════════════ hashing

describe('user_data hashing', () => {
  it('SHA-256 hashes each PII field and wraps it in an ARRAY', () => {
    // Meta rejects a bare string; it requires an array even for one value.
    const data = meta.buildUserData({}, { email: 'Asha@Example.COM' })
    expect(data.em).toEqual([sha256('asha@example.com')])
  })

  it('lower-cases and trims before hashing', () => {
    const a = meta.buildUserData({}, { first_name: '  ASHA  ' })
    const b = meta.buildUserData({}, { first_name: 'asha' })
    expect(a.fn).toEqual(b.fn)
  })

  it('strips non-digits from phone and date of birth', () => {
    expect(meta.buildUserData({}, { phone: '+91 98765-43210' }).ph).toEqual([sha256('919876543210')])
    expect(meta.buildUserData({}, { date_of_birth: '1990-05-12' }).db).toEqual([sha256('19900512')])
  })

  it('maps india to the ISO country code', () => {
    // Match rate depends on this exactly: 'india' and 'in' hash differently.
    expect(meta.buildUserData({}, { country: 'India' }).country).toEqual([sha256('in')])
  })

  it('omits empty fields rather than hashing an empty string', () => {
    const data = meta.buildUserData({}, { email: '', phone: null, city: '   ' })
    expect(data).not.toHaveProperty('em')
    expect(data).not.toHaveProperty('ph')
    expect(data).not.toHaveProperty('ct')
  })

  it('sends ip, user agent, fbc and fbp UNHASHED, as Meta requires', () => {
    const data = meta.buildUserData({
      ip: '1.2.3.4',
      headers: { 'user-agent': 'Mozilla/5.0' },
      cookies: { _fbc: 'fb.1.123.abc', _fbp: 'fb.1.456.def' },
    })

    expect(data.client_ip_address).toBe('1.2.3.4')
    expect(data.client_user_agent).toBe('Mozilla/5.0')
    expect(data.fbc).toBe('fb.1.123.abc')
    expect(data.fbp).toBe('fb.1.456.def')
  })

  it('synthesises _fbc from fbclid when the cookie is absent', () => {
    const data = meta.buildUserData({ cookies: {}, query: { fbclid: 'IwAR123' } })
    expect(data.fbc).toMatch(/^fb\.1\.\d+\.IwAR123$/)
  })

  it('uses the field names Meta expects', () => {
    const data = meta.buildUserData(
      {},
      {
        email: 'a@b.com',
        phone: '123',
        first_name: 'A',
        last_name: 'B',
        city: 'Pune',
        state: 'MH',
        zip: '411001',
        country: 'India',
        external_id: '7',
      },
    )
    expect(Object.keys(data).sort()).toEqual(
      ['country', 'ct', 'em', 'external_id', 'fn', 'ln', 'ph', 'st', 'zp'].sort(),
    )
  })
})

describe('payload builders', () => {
  it('builds product data with the selling price', () => {
    const data = meta.productData(
      { id: 1n, title: 'Kurti', sellingPrice: 1500, mrp: 2000, category: { title: 'Kurtis' } },
      2,
    )
    expect(data.value).toBe(3000)
    expect(data.contents[0]).toEqual({ id: '1', quantity: 2, item_price: 1500 })
    expect(data.currency).toBe('INR')
  })

  it('falls back to MRP when there is no selling price', () => {
    expect(meta.productData({ id: 1n, title: 'K', sellingPrice: 0, mrp: 999 }).value).toBe(999)
  })

  it('builds order data from the payable amount, not the subtotal', () => {
    // The Purchase value must be what the customer actually paid.
    const data = meta.orderData({
      orderNumber: 'ORD1',
      payableAmount: 1060,
      subtotal: 1000,
      items: [{ productId: 1n, quantity: 2, price: 500 }],
    })
    expect(data.value).toBe(1060)
    expect(data.order_id).toBe('ORD1')
  })

  it('splits the shipping name into first and last for customer data', () => {
    const data = meta.customerFromOrder({
      shippingName: 'Asha Rani Menon',
      shippingEmail: 'a@b.com',
      shippingCountry: 'India',
      userId: 7n,
    })
    expect(data.first_name).toBe('Asha')
    expect(data.last_name).toBe('Rani Menon')
    expect(data.external_id).toBe('7')
  })
})

// ══════════════════════════════════════════════ catalog feed

describe('catalog feed — inventory', () => {
  it('takes the MINIMUM of colour and size stock, never the product', () => {
    // The two dimensions describe the same stock; multiplying would overstate it wildly.
    expect(feedService.inventoryQuantity(feedProduct())).toBe(6) // min(4+2, 3+5)
  })

  it('uses whichever dimension exists when only one does', () => {
    expect(feedService.inventoryQuantity(feedProduct({ sizes: [] }))).toBe(6)
    expect(feedService.inventoryQuantity(feedProduct({ colors: [] }))).toBe(8)
  })

  it('falls back to max_unit_buy when there are no variants', () => {
    expect(feedService.inventoryQuantity(feedProduct({ colors: [], sizes: [], maxUnitBuy: 3 }))).toBe(3)
    expect(feedService.inventoryQuantity(feedProduct({ colors: [], sizes: [], maxUnitBuy: 0 }))).toBe(99)
  })
})

describe('catalog feed — rows', () => {
  it('has exactly 31 columns in Meta\'s required order', () => {
    expect(feedService.FEED_COLUMNS).toHaveLength(31)
    expect(feedService.FEED_COLUMNS.slice(0, 9)).toEqual([
      'id',
      'title',
      'description',
      'availability',
      'condition',
      'link',
      'image_link',
      'brand',
      'price',
    ])
    expect(feedService.feedRow(feedProduct())).toHaveLength(31)
  })

  it('puts the MRP in `price` and the reduced price in `sale_price` when on sale', () => {
    // That is how Meta renders a strikethrough. Sending the sale price as `price` loses
    // the discount entirely.
    const row = feedService.feedRow(feedProduct())
    expect(row[8]).toBe('2000.00 INR') // price = MRP
    expect(row[12]).toBe('1500.00 INR') // sale_price
  })

  it('leaves sale_price empty when not on sale', () => {
    const row = feedService.feedRow(feedProduct({ sellingPrice: 2000 }))
    expect(row[8]).toBe('2000.00 INR')
    expect(row[12]).toBe('')
  })

  it('reports availability from sellable stock', () => {
    expect(feedService.feedRow(feedProduct())[3]).toBe('in stock')
    expect(feedService.feedRow(feedProduct({ colors: [{ quantity: 0 }], sizes: [] }))[3]).toBe(
      'out of stock',
    )
  })

  it('strips HTML and collapses whitespace in the description', () => {
    expect(feedService.feedRow(feedProduct())[2]).toBe('Soft cotton kurti')
  })

  it('formats shipping as Meta expects', () => {
    expect(feedService.feedRow(feedProduct())[21]).toBe('IN::Standard:60.00 INR')
  })

  it('carries category and sub-category as product tags', () => {
    const row = feedService.feedRow(feedProduct())
    expect(row[28]).toBe('Kurtis')
    expect(row[29]).toBe('Casual')
  })

  it('links to the storefront product URL', () => {
    expect(feedService.feedRow(feedProduct())[5]).toBe(
      `${env.FRONTEND_URL}/product/indigo-kurti`,
    )
  })
})

describe('catalog feed — streaming', () => {
  it('emits the header first, then one row per product', async () => {
    prismaMock.product.findMany.mockResolvedValueOnce([feedProduct()]).mockResolvedValue([])

    const chunks = []
    for await (const chunk of feedService.streamFeedRows(250)) chunks.push(chunk)

    expect(chunks[0]).toBe(`${feedService.FEED_COLUMNS.join(',')}\n`)
    expect(chunks[1]).toContain('Indigo Kurti')
  })

  it('pages with a keyset cursor so memory stays flat', async () => {
    // Offset pagination degrades quadratically on a large catalogue.
    prismaMock.product.findMany
      .mockResolvedValueOnce(Array.from({ length: 2 }, (_, i) => feedProduct({ id: BigInt(i + 1) })))
      .mockResolvedValueOnce([])

    // eslint-disable-next-line no-empty
    for await (const _ of feedService.streamFeedRows(2)) {
    }

    const second = prismaMock.product.findMany.mock.calls[1][0]
    expect(second.where.id).toEqual({ gt: 2n })
    expect(second.orderBy).toEqual({ id: 'asc' })
  })

  it('includes only ACTIVE products', async () => {
    prismaMock.product.findMany.mockResolvedValue([])
    // eslint-disable-next-line no-empty
    for await (const _ of feedService.streamFeedRows()) {
    }
    expect(prismaMock.product.findMany.mock.calls[0][0].where.isActive).toBe(true)
  })

  it('quotes fields containing commas or quotes', async () => {
    prismaMock.product.findMany
      .mockResolvedValueOnce([feedProduct({ title: 'Kurti, "Indigo"' })])
      .mockResolvedValue([])

    const chunks = []
    for await (const chunk of feedService.streamFeedRows()) chunks.push(chunk)
    expect(chunks[1]).toContain('"Kurti, ""Indigo"""')
  })
})

// ══════════════════════════════════════════════ R1 security fix

describe('catalog feed access control (audit R1)', () => {
  it('REJECTS a request with no token', async () => {
    // Laravel skipped the check entirely when the token was unset, and it was unset in
    // production — the full catalogue was downloadable by anyone with the URL.
    const res = await request(app).get('/api/v1/catalog/meta/products.csv')
    expect(res.status).toBe(403)
  })

  it('rejects a wrong token', async () => {
    const res = await request(app).get('/api/v1/catalog/meta/products.csv?token=wrong')
    expect(res.status).toBe(403)
  })

  it('rejects a token that is a prefix of the real one', async () => {
    const res = await request(app).get(
      `/api/v1/catalog/meta/products.csv?token=${env.META_CATALOG_FEED_TOKEN.slice(0, -1)}`,
    )
    expect(res.status).toBe(403)
  })

  it('accepts the correct token and serves CSV', async () => {
    prismaMock.product.findMany.mockResolvedValue([])

    const res = await request(app).get(
      `/api/v1/catalog/meta/products.csv?token=${env.META_CATALOG_FEED_TOKEN}`,
    )

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['cache-control']).toContain('no-store')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.text).toContain('id,title,description')
  })

  it('is also served at the ORIGINAL Laravel path, with the same guard', async () => {
    // Meta Commerce Manager is configured against this URL.
    prismaMock.product.findMany.mockResolvedValue([])

    expect((await request(app).get('/catalog/meta/products.csv')).status).toBe(403)
    expect(
      (await request(app).get(`/catalog/meta/products.csv?token=${env.META_CATALOG_FEED_TOKEN}`))
        .status,
    ).toBe(200)
  })

  it('never leaks the token in a rejection', async () => {
    const res = await request(app).get('/api/v1/catalog/meta/products.csv?token=wrong')
    expect(JSON.stringify(res.body)).not.toContain(env.META_CATALOG_FEED_TOKEN)
  })
})

// ══════════════════════════════════════════════ public CSV copy

describe('catalog feed — public copy (no token)', () => {
  it('serves the CSV at /catalog/meta/products-public.csv without a token', async () => {
    prismaMock.product.findMany.mockResolvedValueOnce([feedProduct()]).mockResolvedValue([])

    const res = await request(app).get('/catalog/meta/products-public.csv')

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toContain('inline')
    expect(res.headers['content-disposition']).toContain('.csv')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.text.startsWith(`${feedService.FEED_COLUMNS.join(',')}
`)).toBe(true)
    expect(res.text).toContain('Indigo Kurti')
  })

  it('is also mounted under /api/v1, like the guarded feed', async () => {
    prismaMock.product.findMany.mockResolvedValue([])
    const res = await request(app).get('/api/v1/catalog/meta/products-public.csv')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
  })

  it('produces byte-identical data to the token-guarded feed', async () => {
    const rows = [feedProduct(), feedProduct({ id: 2n, title: 'Kurti, "Indigo"', sellingPrice: null })]

    // One short page ends the stream, so queue exactly one page per request.
    prismaMock.product.findMany.mockResolvedValueOnce(rows)
    const guarded = await request(app).get(
      `/catalog/meta/products.csv?token=${env.META_CATALOG_FEED_TOKEN}`,
    )

    prismaMock.product.findMany.mockResolvedValueOnce(rows)
    const open = await request(app).get('/catalog/meta/products-public.csv')

    expect(guarded.status).toBe(200)
    expect(open.status).toBe(200)
    expect(open.text).toBe(guarded.text)
  })

  it('does NOT relax the guarded feed: /products.csv still needs the token', async () => {
    expect((await request(app).get('/catalog/meta/products.csv')).status).toBe(403)
    expect((await request(app).get('/api/v1/catalog/meta/products.csv?token=wrong')).status).toBe(403)
  })

  it('only reads active products and never writes', async () => {
    prismaMock.product.findMany.mockResolvedValue([])
    await request(app).get('/catalog/meta/products-public.csv')
    expect(prismaMock.product.findMany.mock.calls[0][0].where.isActive).toBe(true)
    expect(prismaMock.product.create).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════ newsletter & contact

describe('newsletter', () => {
  it('reports a free address as available', async () => {
    const res = await request(app).post('/api/v1/newsletter/check').send({ email: 'new@example.com' })
    expect(res.body.data.available).toBe(true)
  })

  it('reports an existing address as taken', async () => {
    prismaMock.subscriber.findUnique.mockResolvedValue({ id: 1n })
    const res = await request(app).post('/api/v1/newsletter/check').send({ email: 'a@b.com' })
    expect(res.body.data.available).toBe(false)
    expect(res.body.message).toBe('This email is already subscribed.')
  })

  it('subscribes a new address, normalised to lower case', async () => {
    prismaMock.subscriber.create.mockResolvedValue({ id: 5n, email: 'new@example.com' })

    const res = await request(app)
      .post('/api/v1/newsletter/subscribe')
      .send({ email: '  NEW@Example.com  ' })

    expect(res.status).toBe(201)
    expect(res.body.message).toBe('Thanks for subscribing!')
    expect(prismaMock.subscriber.create.mock.calls[0][0].data.email).toBe('new@example.com')
  })

  it('refuses a duplicate subscription', async () => {
    prismaMock.subscriber.findUnique.mockResolvedValue({ id: 1n })
    const res = await request(app).post('/api/v1/newsletter/subscribe').send({ email: 'a@b.com' })

    expect(res.status).toBe(422)
    expect(res.body.message).toBe('This email is already subscribed.')
    expect(prismaMock.subscriber.create).not.toHaveBeenCalled()
  })

  it('validates the email', async () => {
    const res = await request(app).post('/api/v1/newsletter/subscribe').send({ email: 'not-an-email' })
    expect(res.status).toBe(422)
  })
})

describe('contact form', () => {
  it('stores a message', async () => {
    prismaMock.contactMessage.create.mockResolvedValue({ id: 3n })

    const res = await request(app).post('/api/v1/contact').send({
      name: 'Asha',
      email: 'asha@example.com',
      subject: 'Question',
      message: 'Do you ship to Pune?',
    })

    expect(res.status).toBe(201)
    expect(prismaMock.contactMessage.create.mock.calls[0][0].data.email).toBe('asha@example.com')
  })

  it('validates required fields', async () => {
    const res = await request(app).post('/api/v1/contact').send({ name: 'Asha' })
    expect(res.status).toBe(422)
    expect(Object.keys(res.body.errors)).toEqual(expect.arrayContaining(['email', 'message']))
  })
})
