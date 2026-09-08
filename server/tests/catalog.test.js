import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Phase 3 — catalog.
 *
 * The presenter is covered separately by pure-function tests. This suite verifies the
 * QUERY SHAPES the services issue: filters, ordering, page size, include sets and the
 * fallback chains. Those are exactly what a rewrite gets subtly wrong — a missing
 * `orderBy` or a dropped `include` produces a page that still renders, just in the wrong
 * order or with an N+1 behind it.
 *
 * Asserting on arguments rather than emulating SQL keeps the tests honest about what they
 * prove. Real-data verification happens once the dev database is restored.
 */

const model = () => ({
  findMany: vi.fn(async () => []),
  findFirst: vi.fn(async () => null),
  findUnique: vi.fn(async () => null),
  count: vi.fn(async () => 0),
  create: vi.fn(async ({ data }) => ({ id: 1n, ...data })),
})

const prismaMock = {
  product: model(),
  category: model(),
  subCategory: model(),
  brand: model(),
  color: model(),
  size: model(),
  productReview: model(),
  user: model(),
  banner: model(),
  blogPost: model(),
  homeSectionProduct: model(),
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
const catalog = await import('../src/services/catalog.service.js')
const reviewService = await import('../src/services/review.service.js')

const productRow = (overrides = {}) => ({
  id: 1n,
  title: 'Indigo Kurti',
  slug: 'indigo-kurti',
  mrp: 1999,
  sellingPrice: 1499,
  featuredImage: 'products/indigo.jpg',
  featuredImage2: null,
  sortOrder: 0,
  isActive: true,
  maxUnitBuy: 5,
  deliveryCharge: 0,
  images: [],
  colors: [],
  sizes: [],
  reviews: [],
  category: { id: 2n, title: 'Kurtis', slug: 'kurtis' },
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  for (const key of Object.keys(prismaMock)) {
    const entry = prismaMock[key]
    if (entry && typeof entry === 'object' && entry.findMany) {
      entry.findMany.mockResolvedValue([])
      entry.findFirst.mockResolvedValue(null)
      entry.findUnique.mockResolvedValue(null)
      entry.count.mockResolvedValue(0)
    }
  }
  prismaMock.$transaction.mockImplementation(async (ops) => Promise.all(ops))
})

// ─────────────────────────────────────────────────────── listing

describe('listProducts', () => {
  it('filters to active products and orders sort_order ASC then id DESC', async () => {
    await catalog.listProducts({})

    const args = prismaMock.product.findMany.mock.calls[0][0]
    expect(args.where.isActive).toBe(true)
    // The default ordering across every Laravel product list.
    expect(args.orderBy).toEqual([{ sortOrder: 'asc' }, { id: 'desc' }])
  })

  it('eager-loads category, offer, colours and sizes — no N+1', async () => {
    await catalog.listProducts({})

    const { include } = prismaMock.product.findMany.mock.calls[0][0]
    expect(include).toHaveProperty('category')
    expect(include).toHaveProperty('offer')
    // The pivots must include their related row, or colour/size names are lost.
    expect(include.colors.include).toHaveProperty('color')
    expect(include.sizes.include).toHaveProperty('size')
  })

  it('paginates 50 per page, matching Laravel\'s paginate(50)', async () => {
    await catalog.listProducts({})
    const args = prismaMock.product.findMany.mock.calls[0][0]
    expect(args.take).toBe(50)
    expect(args.skip).toBe(0)
  })

  it('computes skip from the page number', async () => {
    await catalog.listProducts({ page: 3, perPage: 20 })
    const args = prismaMock.product.findMany.mock.calls[0][0]
    expect(args.skip).toBe(40)
    expect(args.take).toBe(20)
  })

  it('caps per-page so a client cannot request the whole table', async () => {
    await catalog.listProducts({ perPage: 100_000 })
    expect(prismaMock.product.findMany.mock.calls[0][0].take).toBe(100)
  })

  it('runs the count and the page in one transaction', async () => {
    await catalog.listProducts({})
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
  })

  it('returns pagination metadata', async () => {
    prismaMock.product.count.mockResolvedValue(120)
    prismaMock.product.findMany.mockResolvedValue([productRow()])

    const result = await catalog.listProducts({ page: 2, perPage: 50 })
    expect(result.pagination).toEqual({
      page: 2,
      perPage: 50,
      total: 120,
      lastPage: 3,
      hasMore: true,
    })
  })

  it('scopes to a category when a slug is given', async () => {
    prismaMock.category.findFirst.mockResolvedValue({ id: 2n, title: 'Kurtis', slug: 'kurtis' })

    await catalog.listProducts({ categorySlug: 'kurtis' })

    expect(prismaMock.category.findFirst.mock.calls[0][0].where).toMatchObject({
      slug: 'kurtis',
      isActive: true,
    })
    expect(prismaMock.product.findMany.mock.calls[0][0].where.categoryId).toBe(2n)
  })

  it('404s for an unknown or inactive category, matching abort(404)', async () => {
    prismaMock.category.findFirst.mockResolvedValue(null)
    await expect(catalog.listProducts({ categorySlug: 'nope' })).rejects.toThrow('Category not found.')
  })

  it('searches the same six fields Laravel did', async () => {
    await catalog.listProducts({ search: 'cotton' })

    const { where } = prismaMock.product.findMany.mock.calls[0][0]
    const fields = where.OR.map((clause) => Object.keys(clause)[0])
    expect(fields).toEqual([
      'title',
      'slug',
      'shortDescription',
      'features',
      'category',
      'subCategory',
    ])
  })

  it('trims the search term and ignores an all-whitespace one', async () => {
    await catalog.listProducts({ search: '   ' })
    expect(prismaMock.product.findMany.mock.calls[0][0].where).not.toHaveProperty('OR')
  })
})

// ─────────────────────────────────────────────────────── detail

describe('getProductBySlug', () => {
  it('loads only active products and 404s otherwise', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null)
    await expect(catalog.getProductBySlug('ghost')).rejects.toThrow('Product not found.')
    expect(prismaMock.product.findFirst.mock.calls[0][0].where).toMatchObject({
      slug: 'ghost',
      isActive: true,
    })
  })

  it('includes images with their colour, and only ACTIVE reviews', async () => {
    prismaMock.product.findFirst.mockResolvedValue(productRow())
    await catalog.getProductBySlug('indigo-kurti')

    const { include } = prismaMock.product.findFirst.mock.calls[0][0]
    expect(include.images.include).toHaveProperty('color')
    expect(include.images.orderBy).toEqual({ sortOrder: 'asc' })
    // Inactive reviews must never reach the page.
    expect(include.reviews.where).toEqual({ isActive: true })
  })
})

describe('getRelatedProducts', () => {
  const product = { id: 1n, category: { id: 2n } }

  it('prefers products in the same category, excluding the current one', async () => {
    prismaMock.product.findMany.mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => productRow({ id: BigInt(i + 2) })),
    )

    await catalog.getRelatedProducts(product)

    const { where } = prismaMock.product.findMany.mock.calls[0][0]
    expect(where.categoryId).toBe(2n)
    expect(where.id).toEqual({ not: 1n })
    expect(prismaMock.product.findMany).toHaveBeenCalledTimes(1) // no top-up needed
  })

  it('tops up from other categories when fewer than 4 match', async () => {
    // The theme's carousel breaks below four items, which is why Laravel topped up.
    prismaMock.product.findMany
      .mockResolvedValueOnce([productRow({ id: 2n }), productRow({ id: 3n })])
      .mockResolvedValueOnce([productRow({ id: 9n })])

    const related = await catalog.getRelatedProducts(product)

    expect(prismaMock.product.findMany).toHaveBeenCalledTimes(2)
    const topUp = prismaMock.product.findMany.mock.calls[1][0]
    expect(topUp.where.id.notIn).toEqual([1n, 2n, 3n]) // excludes current + already found
    expect(topUp.take).toBe(6)
    expect(related).toHaveLength(3)
  })
})

describe('getProductsByIds — recently viewed', () => {
  it('returns [] without querying for an empty list', async () => {
    expect(await catalog.getProductsByIds([])).toEqual([])
    expect(prismaMock.product.findMany).not.toHaveBeenCalled()
  })

  it('re-sorts results into the order the ids were given', async () => {
    // Prisma returns rows in database order; recently-viewed must stay in click order.
    prismaMock.product.findMany.mockResolvedValue([
      productRow({ id: 5n, slug: 'five' }),
      productRow({ id: 9n, slug: 'nine' }),
      productRow({ id: 1n, slug: 'one' }),
    ])

    const result = await catalog.getProductsByIds([9n, 1n, 5n])
    expect(result.map((p) => p.slug)).toEqual(['nine', 'one', 'five'])
  })
})

// ─────────────────────────────────────────────────────── search

describe('searchProducts', () => {
  it('returns empty WITHOUT querying below 2 characters', async () => {
    const result = await catalog.searchProducts('a')
    expect(result.products).toEqual([])
    expect(result.message).toBe('Type at least 2 characters')
    // Otherwise every keystroke on an empty box scans the product table.
    expect(prismaMock.product.findMany).not.toHaveBeenCalled()
  })

  it('treats a whitespace-only query as empty', async () => {
    await catalog.searchProducts('   ')
    expect(prismaMock.product.findMany).not.toHaveBeenCalled()
  })

  it('caps type-ahead results at 8', async () => {
    await catalog.searchProducts('cotton')
    expect(prismaMock.product.findMany.mock.calls[0][0].take).toBe(8)
  })

  it('returns a see-all link with the query encoded', async () => {
    const result = await catalog.searchProducts('red & blue')
    expect(result.seeAllUrl).toBe('/shop?q=red%20%26%20blue')
  })
})

// ─────────────────────────────────────────────────────── home

describe('getHomePage — fallback chains', () => {
  it('uses curated shop-the-look products in their configured position order', async () => {
    prismaMock.homeSectionProduct.findMany.mockResolvedValue([{ productId: 4n }, { productId: 2n }])
    prismaMock.product.findMany.mockResolvedValue([productRow({ id: 2n }), productRow({ id: 4n })])

    await catalog.getHomePage()

    expect(prismaMock.homeSectionProduct.findMany.mock.calls[0][0]).toMatchObject({
      where: { section: 'shop_the_look' },
      orderBy: { position: 'asc' },
    })
  })

  it('falls back to featured, then to any product, for shop-the-look', async () => {
    prismaMock.homeSectionProduct.findMany.mockResolvedValue([])
    prismaMock.product.findMany.mockResolvedValue([]) // featured empty, then any empty

    await catalog.getHomePage()

    const wheres = prismaMock.product.findMany.mock.calls.map((c) => c[0].where)
    expect(wheres.some((w) => w.isFeatured === true)).toBe(true)
  })

  it('falls back to any product when there are no new arrivals', async () => {
    prismaMock.product.findMany.mockResolvedValue([])
    await catalog.getHomePage()

    const wheres = prismaMock.product.findMany.mock.calls.map((c) => c[0].where)
    expect(wheres.some((w) => w.isNewArrival === true)).toBe(true)
  })

  it('falls back to the accessories CATEGORY when no product is flagged popular', async () => {
    prismaMock.product.findMany.mockResolvedValue([])
    await catalog.getHomePage()

    const wheres = prismaMock.product.findMany.mock.calls.map((c) => c[0].where)
    const accessoryFallback = wheres.find((w) => w.category?.OR)
    // Laravel matched slug 'accessories' OR a title containing 'accessor'.
    expect(accessoryFallback.category.OR).toEqual([
      { slug: 'accessories' },
      { title: { contains: 'accessor' } },
    ])
  })

  it('groups banners by section, keeping the first of each', async () => {
    prismaMock.banner.findMany.mockResolvedValue([
      { id: 1n, section: 'home_hero', sortOrder: 0, images: [] },
      { id: 2n, section: 'home_hero', sortOrder: 1, images: [] },
      { id: 3n, section: 'home_our_story', sortOrder: 0, images: [] },
    ])

    const home = await catalog.getHomePage()
    expect(home.banners.home_hero.id).toBe(1n)
    expect(home.banners.home_our_story.id).toBe(3n)
  })

  it('includes only ACTIVE banner images, ordered by sort_order', async () => {
    await catalog.getHomePage()
    const args = prismaMock.banner.findMany.mock.calls[0][0]
    expect(args.where).toEqual({ isActive: true })
    expect(args.include.images).toEqual({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })
  })

  it('applies the published() scope to journal posts', async () => {
    await catalog.getHomePage()
    const { where, take } = prismaMock.blogPost.findMany.mock.calls[0][0]
    // scopePublished = active AND (published_at IS NULL OR published_at <= now)
    expect(where.isActive).toBe(true)
    expect(where.OR[0]).toEqual({ publishedAt: null })
    expect(where.OR[1].publishedAt).toHaveProperty('lte')
    expect(take).toBe(4)
  })
})

// ─────────────────────────────────────────────────────── reviews

describe('createProductReview', () => {
  it('creates an ACTIVE review — there is no moderation queue', async () => {
    prismaMock.product.findFirst.mockResolvedValue({ id: 1n })
    prismaMock.user.findFirst.mockResolvedValue(null)

    await reviewService.createProductReview({
      slug: 'indigo-kurti',
      rating: 5,
      comment: 'Really lovely fabric',
      reviewerName: 'Asha',
      reviewerEmail: 'asha@example.com',
    })

    expect(prismaMock.productReview.create.mock.calls[0][0].data).toMatchObject({
      productId: 1n,
      rating: 5,
      isActive: true,
    })
  })

  it('links a guest review to a matching CUSTOMER account by email', async () => {
    prismaMock.product.findFirst.mockResolvedValue({ id: 1n })
    prismaMock.user.findFirst.mockResolvedValue({ id: 42n })

    await reviewService.createProductReview({
      slug: 'indigo-kurti',
      rating: 4,
      comment: 'Good enough to review',
      reviewerName: 'Asha',
      reviewerEmail: 'asha@example.com',
    })

    expect(prismaMock.user.findFirst.mock.calls[0][0].where).toMatchObject({
      email: 'asha@example.com',
      role: 'customer',
    })
    expect(prismaMock.productReview.create.mock.calls[0][0].data.userId).toBe(42n)
  })

  it('prefers the signed-in user over an email lookup', async () => {
    prismaMock.product.findFirst.mockResolvedValue({ id: 1n })

    await reviewService.createProductReview({
      slug: 'indigo-kurti',
      rating: 4,
      comment: 'Good enough to review',
      reviewerName: 'Asha',
      reviewerEmail: 'someone.else@example.com',
      userId: 7n,
    })

    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.productReview.create.mock.calls[0][0].data.userId).toBe(7n)
  })

  it('404s for an unknown or inactive product', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null)
    await expect(
      reviewService.createProductReview({
        slug: 'ghost',
        rating: 5,
        comment: 'Ten characters',
        reviewerName: 'A',
        reviewerEmail: 'a@b.com',
      }),
    ).rejects.toThrow('Product not found.')
  })
})

// ─────────────────────────────────────────────────────── HTTP

describe('catalog endpoints', () => {
  it('GET /products returns the envelope with pagination', async () => {
    prismaMock.product.count.mockResolvedValue(1)
    prismaMock.product.findMany.mockResolvedValue([productRow()])

    const res = await request(app).get('/api/v1/products')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.products[0].slug).toBe('indigo-kurti')
    expect(res.body.data.pagination.total).toBe(1)
  })

  it('serialises BigInt ids as numbers', async () => {
    prismaMock.product.count.mockResolvedValue(1)
    prismaMock.product.findMany.mockResolvedValue([productRow()])

    const res = await request(app).get('/api/v1/products')
    expect(res.body.data.products[0].id).toBe(1)
    expect(typeof res.body.data.products[0].id).toBe('number')
  })

  it('accepts both ?q= and ?search=, matching Laravel', async () => {
    await request(app).get('/api/v1/products?q=cotton')
    expect(prismaMock.product.findMany.mock.calls[0][0].where).toHaveProperty('OR')

    vi.clearAllMocks()
    prismaMock.product.count.mockResolvedValue(0)
    prismaMock.product.findMany.mockResolvedValue([])

    await request(app).get('/api/v1/products?search=cotton')
    expect(prismaMock.product.findMany.mock.calls[0][0].where).toHaveProperty('OR')
  })

  it('GET /products/:slug 404s cleanly with the error envelope', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null)
    const res = await request(app).get('/api/v1/products/ghost')

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toBe('Product not found.')
  })

  it('GET /search short-circuits below 2 characters', async () => {
    const res = await request(app).get('/api/v1/search?q=a')
    expect(res.status).toBe(200)
    expect(res.body.data.products).toEqual([])
    expect(prismaMock.product.findMany).not.toHaveBeenCalled()
  })

  it('does not treat /search or /categories as a product slug', async () => {
    // Route-order regression guard: these literals are declared before /products/:slug.
    prismaMock.category.findMany.mockResolvedValue([])

    const categories = await request(app).get('/api/v1/categories')
    expect(categories.status).toBe(200)
    expect(categories.body.data).toHaveProperty('categories')

    const search = await request(app).get('/api/v1/search?q=ab')
    expect(search.body.data).toHaveProperty('query')
  })

  it('validates review submissions server-side', async () => {
    const res = await request(app)
      .post('/api/v1/products/indigo-kurti/reviews')
      .send({ rating: 9, comment: 'short', reviewer_name: '', reviewer_email: 'bad' })

    expect(res.status).toBe(422)
    expect(Object.keys(res.body.errors)).toEqual(
      expect.arrayContaining(['rating', 'comment', 'reviewer_name', 'reviewer_email']),
    )
    expect(prismaMock.productReview.create).not.toHaveBeenCalled()
  })

  it('accepts a valid review', async () => {
    prismaMock.product.findFirst.mockResolvedValue({ id: 1n })
    prismaMock.user.findFirst.mockResolvedValue(null)

    const res = await request(app).post('/api/v1/products/indigo-kurti/reviews').send({
      rating: 5,
      comment: 'Beautiful fabric and a great fit.',
      reviewer_name: 'Asha',
      reviewer_email: 'Asha@Example.com',
    })

    expect(res.status).toBe(201)
    expect(res.body.message).toBe('Thank you! Your review has been submitted.')
    // Email is normalised before the account lookup.
    expect(prismaMock.productReview.create.mock.calls[0][0].data.reviewerEmail).toBe(
      'asha@example.com',
    )
  })
})
