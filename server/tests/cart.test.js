import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Phase 5 + 7 — cart, shipping and promotions.
 *
 * Phase 7 is pulled forward because CartService::summary() depends on PromotionService and
 * ShippingService — the same dependency Laravel's constructor declared. They are one
 * cluster and cannot be verified apart.
 *
 * This is the highest-value suite in the migration: these rules decide what customers are
 * charged. Every expectation traces to a line in CartService.php, PromotionService.php or
 * ShippingService.php.
 */

const model = () => ({
  findMany: vi.fn(async () => []),
  findFirst: vi.fn(async () => null),
  findUnique: vi.fn(async () => null),
  count: vi.fn(async () => 0),
  create: vi.fn(async ({ data }) => ({ id: 1n, ...data })),
  update: vi.fn(async ({ data }) => ({ id: 1n, ...data })),
  delete: vi.fn(async () => ({})),
  deleteMany: vi.fn(async () => ({ count: 0 })),
  aggregate: vi.fn(async () => ({ _sum: { quantity: 0 } })),
})

const prismaMock = {
  product: model(),
  cartItem: model(),
  coupon: model(),
  couponRedemption: model(),
  order: model(),
  shippingSetting: model(),
  user: model(),
  $transaction: vi.fn(async (ops) => Promise.all(ops)),
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
const cart = await import('../src/services/cart.service.js')
const promotions = await import('../src/services/promotion.service.js')
const shipping = await import('../src/services/shipping.service.js')

// ── fixtures ───────────────────────────────────────────────────────────────

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

const withVariants = () =>
  product({
    colors: [
      { colorId: 3n, quantity: 4, color: { id: 3n, name: 'Red' } },
      { colorId: 4n, quantity: 0, color: { id: 4n, name: 'Blue' } },
    ],
    sizes: [
      { sizeId: 9n, quantity: 2, size: { id: 9n, name: 'M' } },
      { sizeId: 10n, quantity: 7, size: { id: 10n, name: 'L' } },
    ],
  })

const accessory = (packages) =>
  product({
    id: 5n,
    slug: 'silk-scarf',
    category: { id: 8n, slug: 'accessories', title: 'Accessories' },
    accessoryPackages: JSON.stringify(packages),
  })

const coupon = (overrides = {}) => ({
  id: 11n,
  code: 'SAVE10',
  offerType: 'coupon',
  discountType: 'percent',
  discountPercent: 10,
  discountAmount: null,
  maxDiscountStatus: false,
  maxDiscountAmount: null,
  minCartStatus: false,
  minCartAmount: null,
  appliesTo: 'all',
  categoryIds: null,
  productIds: null,
  minQuantity: null,
  bogoBuyQuantity: null,
  bogoGetQuantity: null,
  newCustomersOnly: false,
  membersOnly: false,
  freeShipping: false,
  startsAt: null,
  endsAt: null,
  usageLimit: null,
  usedCount: 0,
  maxUsePerUser: false,
  isActive: true,
  isPublic: true,
  ...overrides,
})

const line = (overrides = {}) => ({
  productId: 1n,
  categoryId: 2n,
  quantity: 1,
  unitPrice: 1000,
  lineTotal: 1000,
  ...overrides,
})

const guest = (lines = [], couponCode = null) => ({ lines, coupon: couponCode })

beforeEach(() => {
  vi.clearAllMocks()
  for (const entry of Object.values(prismaMock)) {
    if (entry && typeof entry === 'object' && entry.findMany) {
      entry.findMany.mockResolvedValue([])
      entry.findFirst.mockResolvedValue(null)
      entry.count.mockResolvedValue(0)
      entry.aggregate.mockResolvedValue({ _sum: { quantity: 0 } })
    }
  }
  prismaMock.shippingSetting.findFirst.mockResolvedValue({
    id: 1n,
    freeShippingThreshold: 899,
    flatShippingRate: 60,
  })
  prismaMock.$transaction.mockImplementation(async (ops) => Promise.all(ops))
})

// ─────────────────────────────────────────────── line identity

describe('lineKey — cart identity', () => {
  it('separates the same product by colour, size and package', () => {
    const a = cart.lineKey(1, 'Red', 'M', null)
    const b = cart.lineKey(1, 'Blue', 'M', null)
    const c = cart.lineKey(1, 'Red', 'L', null)
    const d = cart.lineKey(1, 'Red', 'M', 'pair')
    expect(new Set([a, b, c, d]).size).toBe(4)
  })

  it('is case-insensitive, so "Red" and "red" are one line', () => {
    expect(cart.lineKey(1, 'Red', 'M', null)).toBe(cart.lineKey(1, 'red', 'm', null))
  })

  it('treats null and empty as the same absent variant', () => {
    expect(cart.lineKey(1, null, null, null)).toBe(cart.lineKey(1, '', '', ''))
  })
})

describe('normalizeVariant', () => {
  it('nulls the placeholder values the storefront submits', () => {
    // '' / '?' / 'Select' come from unset <select> elements. Treating them as real variant
    // names creates lines the customer can never match again to update or remove.
    for (const placeholder of ['', '   ', '?', 'Select', 'SELECT', 'select']) {
      expect(cart.normalizeVariant(placeholder, placeholder)).toEqual([null, null])
    }
  })

  it('trims but preserves real values and their case', () => {
    expect(cart.normalizeVariant('  Red  ', ' M ')).toEqual(['Red', 'M'])
  })
})

// ─────────────────────────────────────────────── stock limits

describe('maximumQuantity', () => {
  it('is capped by max_unit_buy when there are no variants', () => {
    expect(cart.maximumQuantity(product({ maxUnitBuy: 3 }), null, null)).toBe(3)
  })

  it('falls back to 99 when max_unit_buy is falsy', () => {
    expect(cart.maximumQuantity(product({ maxUnitBuy: 0 }), null, null)).toBe(99)
  })

  it('takes the MINIMUM of max_unit_buy, colour stock and size stock', () => {
    // max_unit_buy 5, Red 4, M 2 -> 2
    expect(cart.maximumQuantity(withVariants(), 'Red', 'M')).toBe(2)
  })

  it('matches variant names case-insensitively', () => {
    expect(cart.maximumQuantity(withVariants(), 'red', 'm')).toBe(2)
  })

  it('reports 0 for an out-of-stock colour', () => {
    expect(cart.maximumQuantity(withVariants(), 'Blue', 'L')).toBe(0)
  })

  it('ignores a variant dimension that was not selected', () => {
    // Only a size given: colour stock must not constrain it. max_unit_buy 5 vs L 7 -> 5
    expect(cart.maximumQuantity(withVariants(), null, 'L')).toBe(5)
  })
})

// ─────────────────────────────────────────────── adding

describe('addItem', () => {
  it('defaults to the first colour (UPPER-CASED) and first size', () => {
    // Upper-casing matters: colour gallery keys are upper-cased too, so a lower-cased
    // default would fail to match its gallery on the product page.
    prismaMock.product.findFirst.mockResolvedValue(withVariants())

    return cart.addItem(null, guest(), { productId: 1 }).then(({ guestCart }) => {
      expect(guestCart.lines[0].color).toBe('RED')
      expect(guestCart.lines[0].size).toBe('M')
    })
  })

  it('ACCUMULATES onto an existing line rather than duplicating it', async () => {
    prismaMock.product.findFirst.mockResolvedValue(product())
    const first = await cart.addItem(null, guest(), { productId: 1, quantity: 2 })
    const second = await cart.addItem(null, first.guestCart, { productId: 1, quantity: 1 })

    expect(second.guestCart.lines).toHaveLength(1)
    expect(second.guestCart.lines[0].quantity).toBe(3)
  })

  it('validates the ACCUMULATED total against stock, not just the increment', async () => {
    // Two adds of 2 against a max of 3 must fail on the second — checking only the
    // increment would let a customer walk past the stock limit.
    prismaMock.product.findFirst.mockResolvedValue(product({ maxUnitBuy: 3 }))
    const first = await cart.addItem(null, guest(), { productId: 1, quantity: 2 })

    await expect(
      cart.addItem(null, first.guestCart, { productId: 1, quantity: 2 }),
    ).rejects.toThrow('Only 3 item(s) are available for this product option.')
  })

  it('refuses an out-of-stock variant', async () => {
    prismaMock.product.findFirst.mockResolvedValue(withVariants())
    await expect(
      cart.addItem(null, guest(), { productId: 1, color: 'Blue', size: 'L' }),
    ).rejects.toThrow('This product option is out of stock.')
  })

  it('keeps different variants as separate lines', async () => {
    prismaMock.product.findFirst.mockResolvedValue(withVariants())
    const first = await cart.addItem(null, guest(), { productId: 1, color: 'Red', size: 'M' })
    const second = await cart.addItem(null, first.guestCart, { productId: 1, color: 'Red', size: 'L' })

    expect(second.guestCart.lines).toHaveLength(2)
  })

  it('404s for an inactive or unknown product', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null)
    await expect(cart.addItem(null, guest(), { productId: 999 })).rejects.toThrow(
      'This product is no longer available.',
    )
  })

  it('writes the resolved package price to the database line, never a client value', async () => {
    prismaMock.product.findFirst.mockResolvedValue(
      accessory([{ key: 'pair', label: 'Pair', mrp: 900, price: 700 }]),
    )
    prismaMock.cartItem.findFirst.mockResolvedValue(null)

    await cart.addItem({ id: 1n }, null, { productId: 5, packageKey: 'pair' })

    const { data } = prismaMock.cartItem.create.mock.calls[0][0]
    expect(data.packageKey).toBe('pair')
    expect(data.packageLabel).toBe('Pair')
    expect(Number(data.packagePrice)).toBe(700)
  })
})

// ─────────────────────────────────────────────── packages

describe('accessory packages', () => {
  it('applies ONLY to the accessories category', async () => {
    // A package key on a non-accessory product must be ignored, not priced.
    prismaMock.product.findFirst.mockResolvedValue(product())
    const { guestCart } = await cart.addItem(null, guest(), { productId: 1, packageKey: 'pair' })
    expect(guestCart.lines[0].packageKey).toBeNull()
  })

  it('prices from the product row, ignoring anything the client sends', async () => {
    const row = accessory([{ key: 'pair', label: 'Pair', mrp: 900, price: 700 }])
    prismaMock.product.findFirst.mockResolvedValue(row)
    prismaMock.product.findMany.mockResolvedValue([row])

    const { guestCart } = await cart.addItem(null, guest(), { productId: 5, packageKey: 'pair' })
    const lines = await cart.getLines(null, guestCart)

    expect(lines[0].unitPrice).toBe(700) // not sellingPrice (1000)
    expect(lines[0].mrp).toBe(900)
  })

  it('falls back to the FIRST package for an unknown key', async () => {
    const row = accessory([
      { key: 'single', label: 'Single', price: 400 },
      { key: 'pair', label: 'Pair', price: 700 },
    ])
    prismaMock.product.findFirst.mockResolvedValue(row)
    prismaMock.product.findMany.mockResolvedValue([row])

    const { guestCart } = await cart.addItem(null, guest(), { productId: 5, packageKey: 'made-up' })
    const lines = await cart.getLines(null, guestCart)
    expect(lines[0].unitPrice).toBe(400)
  })

  it('honours the STORED package price for an authenticated line', async () => {
    // So repricing a package in admin does not silently change a cart in progress.
    prismaMock.cartItem.findMany.mockResolvedValue([
      {
        id: 1n,
        quantity: 1,
        color: null,
        size: null,
        packageKey: 'pair',
        packageLabel: 'Pair',
        packagePrice: 650, // stored at add time
        product: accessory([{ key: 'pair', label: 'Pair', mrp: 900, price: 700 }]), // now 700
      },
    ])

    const lines = await cart.getLines({ id: 1n }, null)
    expect(lines[0].unitPrice).toBe(650)
  })
})

// ─────────────────────────────────────────────── totals

describe('getSummary — the totals pipeline', () => {
  it('sums line totals into the subtotal', async () => {
    prismaMock.product.findMany.mockResolvedValue([product()])
    const summary = await cart.getSummary(null, guest([{ productId: '1', quantity: 3 }]))

    expect(summary.subtotal).toBe(3000)
    expect(summary.count).toBe(3)
    expect(summary.subtotalFormatted).toBe('₹ 3,000.00')
  })

  it('charges flat shipping below the threshold', async () => {
    prismaMock.product.findMany.mockResolvedValue([product({ sellingPrice: 500 })])
    const summary = await cart.getSummary(null, guest([{ productId: '1', quantity: 1 }]))

    expect(summary.shipping.amount).toBe(60)
    expect(summary.total).toBe(560)
  })

  it('gives free shipping at or above the threshold', async () => {
    prismaMock.product.findMany.mockResolvedValue([product({ sellingPrice: 899 })])
    const summary = await cart.getSummary(null, guest([{ productId: '1', quantity: 1 }]))

    expect(summary.shipping.isFree).toBe(true)
    expect(summary.shipping.amountFormatted).toBe('Free')
    expect(summary.total).toBe(899)
  })

  it('quotes shipping on the POST-discount subtotal', async () => {
    // ₹1000 subtotal clears the ₹899 threshold, but a ₹200 coupon drops it to ₹800 —
    // so delivery becomes chargeable. Quoting against the raw subtotal would silently
    // give free delivery and lose ₹60 on every such order.
    prismaMock.product.findMany.mockResolvedValue([product()])
    prismaMock.coupon.findFirst.mockResolvedValue(
      coupon({ discountType: 'amount', discountAmount: 200, discountPercent: null }),
    )

    const summary = await cart.getSummary(null, guest([{ productId: '1', quantity: 1 }], 'SAVE10'))

    expect(summary.discount.amount).toBe(200)
    expect(summary.shipping.amount).toBe(60)
    expect(summary.total).toBe(860) // 1000 - 200 + 60
  })

  it('lets a free-shipping coupon override a charged rate', async () => {
    prismaMock.product.findMany.mockResolvedValue([product({ sellingPrice: 500 })])
    prismaMock.coupon.findFirst.mockResolvedValue(
      coupon({ freeShipping: true, discountType: 'amount', discountAmount: 50, discountPercent: null }),
    )

    const summary = await cart.getSummary(null, guest([{ productId: '1', quantity: 1 }], 'SHIPFREE'))
    expect(summary.shipping.amount).toBe(0)
    expect(summary.total).toBe(450)
  })

  it('never produces a negative total', async () => {
    prismaMock.product.findMany.mockResolvedValue([product({ sellingPrice: 100 })])
    prismaMock.coupon.findFirst.mockResolvedValue(
      coupon({ discountType: 'amount', discountAmount: 5000, discountPercent: null, freeShipping: true }),
    )

    const summary = await cart.getSummary(null, guest([{ productId: '1', quantity: 1 }], 'BIG'))
    expect(summary.total).toBeGreaterThanOrEqual(0)
  })

  it('drops lines whose product has been deactivated', async () => {
    prismaMock.product.findMany.mockResolvedValue([]) // product no longer active
    const summary = await cart.getSummary(null, guest([{ productId: '1', quantity: 2 }]))

    expect(summary.items).toHaveLength(0)
    expect(summary.subtotal).toBe(0)
  })
})

describe('shipping', () => {
  it('falls back to the schema defaults when the settings row is missing', async () => {
    prismaMock.shippingSetting.findFirst.mockResolvedValue(null)
    const quote = await shipping.quote(0)
    expect(quote.freeShippingThreshold).toBe(899)
    expect(quote.flatShippingRate).toBe(60)
  })

  it('treats exactly the threshold as free', async () => {
    expect((await shipping.quote(899)).isFree).toBe(true)
    expect((await shipping.quote(898.99)).isFree).toBe(false)
  })
})

// ─────────────────────────────────────────────── coupons

describe('coupon validation — order and messages', () => {
  const items = [line({ quantity: 2, unitPrice: 1000, lineTotal: 2000 })]

  it('rejects an unknown code', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(null)
    await expect(promotions.applyCode('NOPE', items)).rejects.toThrow('Invalid coupon code.')
  })

  it('rejects a coupon that has not started', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(
      coupon({ startsAt: new Date(Date.now() + 86_400_000) }),
    )
    await expect(promotions.applyCode('SAVE10', items)).rejects.toThrow(
      'This coupon is not active yet.',
    )
  })

  it('rejects an expired coupon', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(
      coupon({ endsAt: new Date(Date.now() - 86_400_000) }),
    )
    await expect(promotions.applyCode('SAVE10', items)).rejects.toThrow('This coupon has expired.')
  })

  it('rejects a coupon at its usage limit', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(coupon({ usageLimit: 5, usedCount: 5 }))
    await expect(promotions.applyCode('SAVE10', items)).rejects.toThrow(
      'This coupon has reached its usage limit.',
    )
  })

  it('requires sign-in for a members-only coupon', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(coupon({ membersOnly: true }))
    await expect(promotions.applyCode('SAVE10', items, null)).rejects.toThrow(
      'Please log in to use this member offer.',
    )
  })

  it('allows a GUEST a new-customers-only coupon', async () => {
    // Checkout creates the account after checking the email is unregistered, so there is
    // nothing to disqualify yet. Blocking guests here would break the acquisition offer.
    prismaMock.coupon.findFirst.mockResolvedValue(coupon({ newCustomersOnly: true }))
    await expect(promotions.applyCode('SAVE10', items, null)).resolves.toMatchObject({
      amount: 200,
    })
  })

  it('blocks a returning customer from a new-customers-only coupon', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(coupon({ newCustomersOnly: true }))
    prismaMock.order.findFirst.mockResolvedValue({ id: 3n })

    await expect(promotions.applyCode('SAVE10', items, { id: 1n })).rejects.toThrow(
      'This offer is only for first-time customers.',
    )
    expect(prismaMock.order.findFirst.mock.calls[0][0].where.paymentStatus).toBe('paid')
  })

  it('blocks a second use of a once-per-user coupon', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(coupon({ maxUsePerUser: true }))
    prismaMock.couponRedemption.findFirst.mockResolvedValue({ id: 1n })

    await expect(promotions.applyCode('SAVE10', items, { id: 1n })).rejects.toThrow(
      'You have already used this coupon.',
    )
  })

  it('rejects a coupon that matches nothing in the cart', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(
      coupon({ appliesTo: 'products', productIds: JSON.stringify([999]) }),
    )
    await expect(promotions.applyCode('SAVE10', items)).rejects.toThrow(
      'This coupon does not apply to items in your cart.',
    )
  })

  it('enforces a minimum quantity against ELIGIBLE items only', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(coupon({ minQuantity: 5 }))
    await expect(promotions.applyCode('SAVE10', items)).rejects.toThrow(
      'Add at least 5 eligible item(s) to use this coupon.',
    )
  })

  it('enforces a minimum cart amount against ELIGIBLE items only', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(
      coupon({ minCartStatus: true, minCartAmount: 5000 }),
    )
    await expect(promotions.applyCode('SAVE10', items)).rejects.toThrow(
      'Minimum cart amount for this coupon is ₹ 5,000.00.',
    )
  })
})

describe('discount calculation', () => {
  it('applies a percentage to the eligible subtotal', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(coupon({ discountPercent: 25 }))
    const quote = await promotions.applyCode('SAVE10', [line({ lineTotal: 2000 })])
    expect(quote.amount).toBe(500)
  })

  it('caps a percentage at max_discount_amount when enabled', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(
      coupon({ discountPercent: 50, maxDiscountStatus: true, maxDiscountAmount: 300 }),
    )
    const quote = await promotions.applyCode('SAVE10', [line({ lineTotal: 2000 })])
    expect(quote.amount).toBe(300)
  })

  it('ignores the cap when max_discount_status is off', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(
      coupon({ discountPercent: 50, maxDiscountStatus: false, maxDiscountAmount: 300 }),
    )
    const quote = await promotions.applyCode('SAVE10', [line({ lineTotal: 2000 })])
    expect(quote.amount).toBe(1000)
  })

  it('never lets a fixed amount exceed the eligible subtotal', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(
      coupon({ discountType: 'amount', discountAmount: 5000, discountPercent: null }),
    )
    const quote = await promotions.applyCode('SAVE10', [line({ lineTotal: 800 })])
    expect(quote.amount).toBe(800)
  })

  it('scopes a category coupon to matching lines only', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(
      coupon({ appliesTo: 'categories', categoryIds: JSON.stringify([2]), discountPercent: 10 }),
    )

    const quote = await promotions.applyCode('SAVE10', [
      line({ categoryId: 2n, lineTotal: 1000 }), // eligible
      line({ categoryId: 99n, lineTotal: 5000 }), // not
    ])

    expect(quote.amount).toBe(100) // 10% of 1000, not of 6000
  })

  it('rounds to 2dp', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(coupon({ discountPercent: 33 }))
    const quote = await promotions.applyCode('SAVE10', [line({ lineTotal: 100.05 })])
    expect(quote.amount).toBe(33.02)
  })

  it('rejects a coupon that yields no discount', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(coupon({ discountPercent: 0 }))
    await expect(promotions.applyCode('SAVE10', [line()])).rejects.toThrow(
      'This coupon does not provide a discount for your cart.',
    )
  })

  it('ACCEPTS a zero discount when the coupon grants free shipping', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(coupon({ discountPercent: 0, freeShipping: true }))
    const quote = await promotions.applyCode('SHIPFREE', [line()])
    expect(quote.amount).toBe(0)
    expect(quote.freeShipping).toBe(true)
  })
})

describe('BOGO', () => {
  const bogo = (overrides = {}) =>
    coupon({ offerType: 'bogo', bogoBuyQuantity: 1, bogoGetQuantity: 1, ...overrides })

  it('makes one unit free per buy+get group', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(bogo())
    // qty 4, group size 2 -> 2 free x ₹1000
    const quote = await promotions.applyCode('BOGO', [line({ quantity: 4, unitPrice: 1000 })])
    expect(quote.amount).toBe(2000)
  })

  it('ignores a partial group', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(bogo())
    // qty 3, group size 2 -> 1 free
    const quote = await promotions.applyCode('BOGO', [line({ quantity: 3, unitPrice: 1000 })])
    expect(quote.amount).toBe(1000)
  })

  it('supports buy 2 get 1', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(bogo({ bogoBuyQuantity: 2, bogoGetQuantity: 1 }))
    // qty 7, group size 3 -> 2 free
    const quote = await promotions.applyCode('BOGO', [line({ quantity: 7, unitPrice: 500 })])
    expect(quote.amount).toBe(1000)
  })

  it('computes PER LINE, so a cheap item cannot make an expensive one free', async () => {
    // This is the rule that protects margin. Grouping across the cart would let 1x ₹100
    // plus 1x ₹5000 discount the ₹5000 item. Per line: neither reaches a group of 2.
    prismaMock.coupon.findFirst.mockResolvedValue(bogo())

    await expect(
      promotions.applyCode('BOGO', [
        line({ quantity: 1, unitPrice: 100, lineTotal: 100 }),
        line({ productId: 2n, quantity: 1, unitPrice: 5000, lineTotal: 5000 }),
      ]),
    ).rejects.toThrow('Add 2 matching eligible item(s) to use this Buy X, Get Y offer.')
  })

  it('discounts each qualifying line at its OWN unit price', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(bogo())
    const quote = await promotions.applyCode('BOGO', [
      line({ quantity: 2, unitPrice: 100, lineTotal: 200 }),
      line({ productId: 2n, quantity: 2, unitPrice: 5000, lineTotal: 10000 }),
    ])
    expect(quote.amount).toBe(5100) // 100 + 5000, each from its own line
  })
})

describe('quote — re-validation on every read', () => {
  it('drops a sticky coupon when the cart empties', async () => {
    // Otherwise it silently reapplies to whatever is added next.
    const result = await promotions.quote('SAVE10', [])
    expect(result.amount).toBe(0)
    expect(result.clear).toBe(true)
  })

  it('surfaces the reason and clears, rather than throwing', async () => {
    prismaMock.coupon.findFirst.mockResolvedValue(
      coupon({ endsAt: new Date(Date.now() - 86_400_000) }),
    )
    const result = await promotions.quote('SAVE10', [line()])

    expect(result.amount).toBe(0)
    expect(result.message).toBe('This coupon has expired.')
    expect(result.clear).toBe(true)
  })
})

describe('recordRedemption', () => {
  it('writes the redemption AND increments used_count together', async () => {
    // Splitting these lets the counter drift from the rows, breaking usage_limit.
    await promotions.recordRedemption({
      id: 7n,
      userId: 1n,
      couponId: 11n,
      couponCode: 'SAVE10',
      discountAmount: 200,
    })

    expect(prismaMock.couponRedemption.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.coupon.update.mock.calls[0][0]).toMatchObject({
      where: { id: 11n },
      data: { usedCount: { increment: 1 } },
    })
  })

  it('does nothing when no coupon was used', async () => {
    await promotions.recordRedemption({ id: 7n, couponId: null, couponCode: null })
    expect(prismaMock.couponRedemption.create).not.toHaveBeenCalled()
    expect(prismaMock.coupon.update).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────── merge & inventory

describe('mergeGuestCartIntoUser', () => {
  it('sums quantities and caps at max_unit_buy', async () => {
    prismaMock.product.findFirst.mockResolvedValue(product({ maxUnitBuy: 4 }))
    prismaMock.cartItem.findFirst.mockResolvedValue({ id: 9n, quantity: 3 })

    await cart.mergeGuestCartIntoUser({ id: 1n }, guest([{ productId: '1', quantity: 3 }]))

    // 3 + 3 = 6, capped to 4 rather than rejected — being stricter would silently drop
    // items the customer expects to still be there after signing in.
    expect(prismaMock.cartItem.update.mock.calls[0][0].data.quantity).toBe(4)
  })

  it('skips products that are gone instead of failing the sign-in', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null)
    await expect(
      cart.mergeGuestCartIntoUser({ id: 1n }, guest([{ productId: '999', quantity: 1 }])),
    ).resolves.toBeUndefined()
    expect(prismaMock.cartItem.create).not.toHaveBeenCalled()
  })
})

describe('assertInventoryAvailable', () => {
  it('passes when stock covers every line', async () => {
    prismaMock.product.findFirst.mockResolvedValue(withVariants())
    await expect(
      cart.assertInventoryAvailable([{ productId: 1n, quantity: 2, color: 'Red', size: 'M' }]),
    ).resolves.toBeUndefined()
  })

  it('re-checks against LIVE stock, catching a cart that has gone stale', async () => {
    prismaMock.product.findFirst.mockResolvedValue(withVariants())
    await expect(
      cart.assertInventoryAvailable([{ productId: 1n, quantity: 3, color: 'Red', size: 'M' }]),
    ).rejects.toThrow('Only 2 item(s) of Indigo Kurti are available.')
  })

  it('reports an out-of-stock product by name', async () => {
    prismaMock.product.findFirst.mockResolvedValue(withVariants())
    await expect(
      cart.assertInventoryAvailable([{ productId: 1n, quantity: 1, color: 'Blue', size: null }]),
    ).rejects.toThrow('Indigo Kurti is out of stock.')
  })

  it('rejects a product that has been deactivated', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null)
    await expect(
      cart.assertInventoryAvailable([{ productId: 1n, quantity: 1 }]),
    ).rejects.toThrow('A product in your cart is no longer available.')
  })
})

// ─────────────────────────────────────────────── HTTP

describe('cart endpoints', () => {
  it('GET /cart works for a guest and returns a full summary', async () => {
    const res = await request(app).get('/api/v1/cart')
    expect(res.status).toBe(200)
    expect(res.body.data.cart).toHaveProperty('subtotal')
    expect(res.body.data.cart).toHaveProperty('shipping')
    expect(res.body.data.cart).toHaveProperty('discount')
    expect(res.body.data.cart.count).toBe(0)
  })

  it('persists a guest cart in a signed HTTP-only cookie', async () => {
    prismaMock.product.findFirst.mockResolvedValue(product())
    const res = await request(app).post('/api/v1/cart/items').send({ product_id: 1, quantity: 2 })

    expect(res.status).toBe(200)
    const cookie = (res.headers['set-cookie'] ?? []).find((c) => c.startsWith('pp_cart='))
    expect(cookie).toContain('HttpOnly')
    // Signed cookies are prefixed s%3A — the client cannot forge one.
    expect(cookie).toContain('s%3A')
  })

  it('carries the guest cart across requests', async () => {
    prismaMock.product.findFirst.mockResolvedValue(product())
    prismaMock.product.findMany.mockResolvedValue([product()])

    const agent = request.agent(app)
    await agent.post('/api/v1/cart/items').send({ product_id: 1, quantity: 2 })
    const res = await agent.get('/api/v1/cart')

    expect(res.body.data.cart.count).toBe(2)
    expect(res.body.data.cart.subtotal).toBe(2000)
  })

  it('never accepts a price from the client', async () => {
    prismaMock.product.findFirst.mockResolvedValue(product())
    prismaMock.product.findMany.mockResolvedValue([product()])

    const agent = request.agent(app)
    await agent
      .post('/api/v1/cart/items')
      .send({ product_id: 1, quantity: 1, unit_price: 1, price: 1, line_total: 1 })

    const res = await agent.get('/api/v1/cart')
    expect(res.body.data.cart.items[0].unitPrice).toBe(1000) // the catalogue price
    expect(res.body.data.cart.subtotal).toBe(1000)
  })

  it('returns 422 with the stock message when the limit is exceeded', async () => {
    prismaMock.product.findFirst.mockResolvedValue(product({ maxUnitBuy: 2 }))
    const res = await request(app).post('/api/v1/cart/items').send({ product_id: 1, quantity: 5 })

    expect(res.status).toBe(422)
    expect(res.body.message).toBe('Only 2 item(s) are available for this product option.')
  })

  it('validates the body', async () => {
    const res = await request(app).post('/api/v1/cart/items').send({ quantity: 1 })
    expect(res.status).toBe(422)
    expect(res.body.errors).toHaveProperty('product_id')
  })

  it('treats a quantity of 0 as a removal', async () => {
    prismaMock.product.findFirst.mockResolvedValue(product())
    prismaMock.product.findMany.mockResolvedValue([product()])

    const agent = request.agent(app)
    await agent.post('/api/v1/cart/items').send({ product_id: 1, quantity: 2 })
    const res = await agent.patch('/api/v1/cart/items/1').send({ quantity: 0 })

    expect(res.status).toBe(200)
    expect(res.body.data.cart.count).toBe(0)
  })

  it('does not read /coupon or /buy-now as a product id', async () => {
    // Route-order regression guard.
    const res = await request(app).delete('/api/v1/cart/coupon')
    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Coupon removed.')
  })

  it('rejects a coupon on an empty cart', async () => {
    const res = await request(app).post('/api/v1/cart/coupon').send({ code: 'SAVE10' })
    expect(res.status).toBe(422)
    expect(res.body.message).toBe('Your cart is empty.')
  })

  it('applies a coupon and reflects it in the totals', async () => {
    prismaMock.product.findFirst.mockResolvedValue(product())
    prismaMock.product.findMany.mockResolvedValue([product()])
    prismaMock.coupon.findFirst.mockResolvedValue(coupon({ discountPercent: 10 }))

    const agent = request.agent(app)
    await agent.post('/api/v1/cart/items').send({ product_id: 1, quantity: 1 })
    const res = await agent.post('/api/v1/cart/coupon').send({ code: 'save10' })

    expect(res.status).toBe(200)
    expect(res.body.data.cart.discount.amount).toBe(100)
    // 1000 - 100 = 900, which still clears the ₹899 threshold, so shipping stays free.
    expect(res.body.data.cart.shipping.isFree).toBe(true)
    expect(res.body.data.cart.total).toBe(900)
  })

  it('charges shipping once a coupon pushes the cart under the threshold', async () => {
    // The boundary case for the post-discount shipping rule: 1000 - 200 = 800 < 899.
    prismaMock.product.findFirst.mockResolvedValue(product())
    prismaMock.product.findMany.mockResolvedValue([product()])
    prismaMock.coupon.findFirst.mockResolvedValue(
      coupon({ discountType: 'amount', discountAmount: 200, discountPercent: null }),
    )

    const agent = request.agent(app)
    await agent.post('/api/v1/cart/items').send({ product_id: 1, quantity: 1 })
    const res = await agent.post('/api/v1/cart/coupon').send({ code: 'SAVE200' })

    expect(res.body.data.cart.shipping.isFree).toBe(false)
    expect(res.body.data.cart.shipping.amount).toBe(60)
    expect(res.body.data.cart.total).toBe(860)
  })

  it('reports the specific reason an invalid coupon was refused', async () => {
    prismaMock.product.findFirst.mockResolvedValue(product())
    prismaMock.product.findMany.mockResolvedValue([product()])
    prismaMock.coupon.findFirst.mockResolvedValue(null)

    const agent = request.agent(app)
    await agent.post('/api/v1/cart/items').send({ product_id: 1, quantity: 1 })
    const res = await agent.post('/api/v1/cart/coupon').send({ code: 'NOPE' })

    expect(res.status).toBe(422)
    expect(res.body.message).toBe('Invalid coupon code.')
  })

  it('buy-now adds and points at checkout', async () => {
    prismaMock.product.findFirst.mockResolvedValue(product())
    prismaMock.product.findMany.mockResolvedValue([product()])

    const res = await request(app).post('/api/v1/cart/buy-now').send({ product_id: 1, quantity: 1 })
    expect(res.status).toBe(200)
    expect(res.body.data.redirect).toBe('/checkout')
  })

  it('ignores a forged cart cookie that is not signed', async () => {
    const res = await request(app)
      .get('/api/v1/cart')
      .set('Cookie', 'pp_cart=' + encodeURIComponent(JSON.stringify({ lines: [{ productId: '1', quantity: 99 }] })))

    expect(res.body.data.cart.count).toBe(0)
  })
})
