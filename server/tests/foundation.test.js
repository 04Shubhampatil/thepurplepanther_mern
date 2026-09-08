import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { format, round2, toNumber, discountPercent } from '../src/utils/money.js'
import { mediaUrl, productImageUrl } from '../src/utils/media.js'
import { parseJsonArray, parseJsonColumn, serialize } from '../src/utils/json.js'

/**
 * Phase 1 foundation tests.
 *
 * The money and media suites are parity tests: each expectation is the literal output of
 * the corresponding Laravel helper, so a regression here is a visible pricing or broken
 * image bug in production.
 */

describe('money — parity with App\\Support\\Money', () => {
  it('formats like number_format($amount, 2) with the ₹ prefix', () => {
    expect(format(0)).toBe('₹ 0.00')
    expect(format(60)).toBe('₹ 60.00')
    expect(format(899)).toBe('₹ 899.00')
    expect(format(1234.5)).toBe('₹ 1,234.50')
    expect(format(1234.56)).toBe('₹ 1,234.56')
    expect(format(1234567.89)).toBe('₹ 1,234,567.89')
  })

  it('groups thousands western-style, matching PHP number_format', () => {
    // PHP number_format uses 3-digit grouping even for INR — not lakh/crore grouping.
    expect(format(100000)).toBe('₹ 100,000.00')
    expect(format(10000000)).toBe('₹ 10,000,000.00')
  })

  it('handles null and undefined as zero', () => {
    expect(format(null)).toBe('₹ 0.00')
    expect(format(undefined)).toBe('₹ 0.00')
  })

  it('rounds half away from zero at 2dp, like PHP round()', () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(2.675)).toBe(2.68)
    expect(round2(0.125)).toBe(0.13)
    expect(round2(10.994)).toBe(10.99)
    expect(round2(10.995)).toBe(11.0)
  })

  it('coerces Prisma Decimal-like objects', () => {
    const decimalLike = { toNumber: () => 149.5 }
    expect(toNumber(decimalLike)).toBe(149.5)
    expect(toNumber('42.75')).toBe(42.75)
    expect(toNumber(null)).toBe(0)
  })

  it('computes discount percent like Product::getDiscountPercentAttribute', () => {
    expect(discountPercent(1000, 750)).toBe(25)
    expect(discountPercent(999, 899)).toBe(10)
    expect(discountPercent(500, 500)).toBe(0) // not a discount
    expect(discountPercent(0, 100)).toBe(0) // guard against divide-by-zero
    expect(discountPercent(100, 0)).toBe(0)
  })
})

describe('media — parity with App\\Support\\Media::url', () => {
  it('returns absolute URLs unchanged', () => {
    expect(mediaUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg')
    expect(mediaUrl('http://cdn.example.com/a.jpg')).toBe('http://cdn.example.com/a.jpg')
  })

  it('serves bundled theme assets from the app URL', () => {
    expect(mediaUrl('frontend/images/logo.svg')).toBe('http://localhost:5000/frontend/images/logo.svg')
  })

  it('resolves stored relative paths against the media base', () => {
    expect(mediaUrl('products/abc.jpg')).toBe('http://localhost:5000/storage/products/abc.jpg')
    expect(mediaUrl('banners/hero.png')).toBe('http://localhost:5000/storage/banners/hero.png')
  })

  it('treats a leading slash as an app-root path', () => {
    expect(mediaUrl('/uploads/x.jpg')).toBe('http://localhost:5000/uploads/x.jpg')
  })

  it('falls back when the path is empty', () => {
    expect(mediaUrl(null)).toContain('frontend/images/shop/cart1.jpg')
    expect(productImageUrl(null)).toContain('frontend/images/collection-1/collection-8.jpg')
  })
})

describe('json — longtext columns and BigInt serialisation', () => {
  it('parses JSON-in-longtext without throwing on malformed data', () => {
    expect(parseJsonArray('[{"key":"a","price":10}]')).toEqual([{ key: 'a', price: 10 }])
    expect(parseJsonArray('not json')).toEqual([])
    expect(parseJsonArray(null)).toEqual([])
    expect(parseJsonArray('{"not":"an array"}')).toEqual([])
    expect(parseJsonColumn(null, { a: 1 })).toEqual({ a: 1 })
  })

  it('converts BigInt ids to numbers for JSON responses', () => {
    const row = { id: 67n, title: 'Shirt', nested: { productId: 12n }, list: [1n, 2n] }
    expect(serialize(row)).toEqual({ id: 67, title: 'Shirt', nested: { productId: 12 }, list: [1, 2] })
  })

  it('serialises Date to ISO and leaves primitives alone', () => {
    const d = new Date('2026-01-02T03:04:05.000Z')
    expect(serialize({ at: d, n: 1, s: 'x', b: true, z: null })).toEqual({
      at: '2026-01-02T03:04:05.000Z',
      n: 1,
      s: 'x',
      b: true,
      z: null,
    })
  })

  it('JSON.stringify does not throw on a raw BigInt after the shim', () => {
    expect(() => JSON.stringify({ id: 1n })).not.toThrow()
  })
})

describe('app — HTTP foundation', () => {
  it('exposes the public config and nothing secret', async () => {
    const res = await request(app).get('/api/v1/config')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toHaveProperty('appName')
    expect(res.body.data).toHaveProperty('mediaBaseUrl')

    const leaked = JSON.stringify(res.body)
    for (const secret of ['JWT_SECRET', 'DATABASE_URL', 'password', 'FEED_TOKEN', 'KEY_SECRET']) {
      expect(leaked).not.toContain(secret)
    }
  })

  it('answers the health check with a consistent envelope', async () => {
    const res = await request(app).get('/api/v1/health')
    // 200 when the dev database is reachable, 503 when it is not — both are valid here.
    expect([200, 503]).toContain(res.status)
    expect(res.body).toHaveProperty('success')
    expect(res.body).toHaveProperty('message')
  })

  it('never reports integration secrets, only whether they are configured', async () => {
    const res = await request(app).get('/api/v1/health')
    const integrations = res.body.data?.integrations
    if (integrations) {
      for (const value of Object.values(integrations)) {
        expect(typeof value).toBe('boolean')
      }
    }
  })

  it('returns the error envelope for an unknown route', async () => {
    const res = await request(app).get('/api/v1/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toContain('not found')
  })

  it('rejects malformed JSON with 400, not a stack trace', async () => {
    const res = await request(app)
      .post('/api/v1/config')
      .set('Content-Type', 'application/json')
      .send('{"broken":')
    expect([400, 404]).toContain(res.status)
    expect(res.body.success).toBe(false)
    expect(JSON.stringify(res.body)).not.toContain('at Object')
  })

  it('does not advertise the server implementation', async () => {
    const res = await request(app).get('/api/v1/health')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })

  it('sets helmet security headers', async () => {
    const res = await request(app).get('/api/v1/health')
    expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff')
  })
})
