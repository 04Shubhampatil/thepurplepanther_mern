import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Phase 4 — CMS: blog, banners, pages, support.
 *
 * Ported from FrontendController::blog / blogSingle / support. As with the catalog suite,
 * these assert the query shapes and the selection rules rather than emulating SQL.
 */

const model = () => ({
  findMany: vi.fn(async () => []),
  findFirst: vi.fn(async () => null),
  findUnique: vi.fn(async () => null),
  count: vi.fn(async () => 0),
})

const prismaMock = {
  blogPost: model(),
  newsType: model(),
  banner: model(),
  page: model(),
  product: model(),
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
const cms = await import('../src/services/cms.service.js')

const post = (overrides = {}) => ({
  id: 1n,
  title: 'On Handloom',
  slug: 'on-handloom',
  image: 'blog-posts/one.jpg',
  bannerImage: null,
  authorName: 'Admin',
  excerpt: 'A short piece',
  content: '<p>Full body</p>',
  commentsCount: 0,
  isFeatured: false,
  isActive: true,
  newsTypeId: 3n,
  publishedAt: new Date('2026-01-01'),
  newsType: { id: 3n, title: 'Craft', slug: 'craft' },
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  for (const entry of Object.values(prismaMock)) {
    if (entry && typeof entry === 'object' && entry.findMany) {
      entry.findMany.mockResolvedValue([])
      entry.findFirst.mockResolvedValue(null)
      entry.count.mockResolvedValue(0)
    }
  }
  prismaMock.$transaction.mockImplementation(async (ops) => Promise.all(ops))
})

// ─────────────────────────────────────────────────────── published scope

describe('published scope', () => {
  it('treats a post with NO publish date as published, not a draft', async () => {
    // BlogPost::scopePublished = active AND (published_at IS NULL OR published_at <= now).
    // Reading the NULL branch as "draft" would silently hide posts.
    await cms.listBlogPosts({})

    const { where } = prismaMock.blogPost.findFirst.mock.calls[0][0]
    expect(where.isActive).toBe(true)
    expect(where.OR[0]).toEqual({ publishedAt: null })
    expect(where.OR[1].publishedAt).toHaveProperty('lte')
  })

  it('applies the same scope to detail lookups', async () => {
    prismaMock.blogPost.findFirst.mockResolvedValue(post())
    await cms.getBlogPostBySlug('on-handloom')

    const { where } = prismaMock.blogPost.findFirst.mock.calls[0][0]
    expect(where.slug).toBe('on-handloom')
    expect(where.isActive).toBe(true)
    expect(where.OR).toHaveLength(2)
  })
})

// ─────────────────────────────────────────────────────── blog index

describe('listBlogPosts', () => {
  it('paginates 9 per page, matching Laravel\'s paginate(9)', async () => {
    await cms.listBlogPosts({})
    const listCall = prismaMock.blogPost.findMany.mock.calls.at(-1)[0]
    expect(listCall.take).toBe(9)
  })

  it('prefers a FEATURED post, falling back to the most recent', async () => {
    prismaMock.blogPost.findFirst
      .mockResolvedValueOnce(null) // no featured
      .mockResolvedValueOnce(post({ id: 5n })) // fallback

    await cms.listBlogPosts({})

    expect(prismaMock.blogPost.findFirst.mock.calls[0][0].where.isFeatured).toBe(true)
    expect(prismaMock.blogPost.findFirst.mock.calls[1][0].orderBy).toEqual({ publishedAt: 'desc' })
  })

  it('EXCLUDES the featured post from the paginated list', async () => {
    // Otherwise it renders twice on the page.
    prismaMock.blogPost.findFirst.mockResolvedValue(post({ id: 5n }))
    await cms.listBlogPosts({})

    const listCall = prismaMock.blogPost.findMany.mock.calls.at(-1)[0]
    expect(listCall.where.id).toEqual({ not: 5n })
  })

  it('does not add an exclusion when there is no featured post', async () => {
    prismaMock.blogPost.findFirst.mockResolvedValue(null)
    await cms.listBlogPosts({})

    const listCall = prismaMock.blogPost.findMany.mock.calls.at(-1)[0]
    expect(listCall.where).not.toHaveProperty('id')
  })

  it('filters by news type when ?type= resolves', async () => {
    prismaMock.newsType.findFirst.mockResolvedValue({ id: 3n, title: 'Craft', slug: 'craft' })
    await cms.listBlogPosts({ typeSlug: 'craft' })

    const listCall = prismaMock.blogPost.findMany.mock.calls.at(-1)[0]
    expect(listCall.where.newsTypeId).toBe(3n)
  })

  it('falls through to ALL posts for an unknown type rather than 404ing', async () => {
    // Laravel's `when($activeType, ...)` simply skipped the filter.
    prismaMock.newsType.findFirst.mockResolvedValue(null)
    const result = await cms.listBlogPosts({ typeSlug: 'nonexistent' })

    expect(result.activeType).toBeNull()
    const listCall = prismaMock.blogPost.findMany.mock.calls.at(-1)[0]
    expect(listCall.where).not.toHaveProperty('newsTypeId')
  })

  it('orders by sort_order then published_at DESC', async () => {
    await cms.listBlogPosts({})
    const listCall = prismaMock.blogPost.findMany.mock.calls.at(-1)[0]
    expect(listCall.orderBy).toEqual([{ sortOrder: 'asc' }, { publishedAt: 'desc' }])
  })

  it('loads the journal page banner', async () => {
    await cms.listBlogPosts({})
    expect(prismaMock.banner.findFirst.mock.calls[0][0].where).toMatchObject({
      section: 'journal_page_banner',
      isActive: true,
    })
  })

  it('omits full post bodies from list payloads', async () => {
    // A 9-post page should not ship nine full article bodies.
    prismaMock.blogPost.findMany.mockResolvedValue([post()])
    prismaMock.blogPost.count.mockResolvedValue(1)

    const result = await cms.listBlogPosts({})
    expect(result.posts[0]).not.toHaveProperty('content')
    expect(result.posts[0].excerpt).toBe('A short piece')
  })
})

// ─────────────────────────────────────────────────────── blog detail

describe('getBlogPostBySlug', () => {
  it('404s for an unknown or unpublished post', async () => {
    prismaMock.blogPost.findFirst.mockResolvedValue(null)
    await expect(cms.getBlogPostBySlug('ghost')).rejects.toThrow('Post not found.')
  })

  it('returns 2 related posts from the same news type, excluding itself', async () => {
    prismaMock.blogPost.findFirst.mockResolvedValue(post({ id: 5n, newsTypeId: 3n }))
    await cms.getBlogPostBySlug('on-handloom')

    const related = prismaMock.blogPost.findMany.mock.calls[0][0]
    expect(related.where.id).toEqual({ not: 5n })
    expect(related.where.newsTypeId).toBe(3n)
    expect(related.take).toBe(2)
  })

  it('navigates prev/next by ID, not by publish date', async () => {
    // Preserved from Laravel even though it can disagree with the list ordering.
    prismaMock.blogPost.findFirst.mockResolvedValue(post({ id: 5n }))
    await cms.getBlogPostBySlug('on-handloom')

    const calls = prismaMock.blogPost.findFirst.mock.calls
    const prev = calls.find((c) => c[0].where?.id?.lt !== undefined)[0]
    const next = calls.find((c) => c[0].where?.id?.gt !== undefined)[0]

    expect(prev.where.id).toEqual({ lt: 5n })
    expect(prev.orderBy).toEqual({ id: 'desc' })
    expect(next.where.id).toEqual({ gt: 5n })
    expect(next.orderBy).toEqual({ id: 'asc' })
  })

  it('includes the full body on detail', async () => {
    prismaMock.blogPost.findFirst.mockResolvedValue(post())
    const result = await cms.getBlogPostBySlug('on-handloom')
    expect(result.post.content).toBe('<p>Full body</p>')
  })

  it('resolves the post image against the media base with the Laravel fallback', async () => {
    prismaMock.blogPost.findFirst.mockResolvedValue(post({ image: null }))
    const result = await cms.getBlogPostBySlug('on-handloom')
    expect(result.post.image).toContain('frontend/images/blogs/blog-1.jpg')
  })
})

// ─────────────────────────────────────────────────────── banners

describe('banners', () => {
  it('loads only ACTIVE images, ordered by sort_order', async () => {
    await cms.getBannerBySection('home_hero')
    const args = prismaMock.banner.findFirst.mock.calls[0][0]
    expect(args.include.images).toEqual({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })
  })

  it('keeps the FIRST banner per section when several exist', async () => {
    prismaMock.banner.findMany.mockResolvedValue([
      { id: 1n, section: 'global_top_strip', images: [] },
      { id: 2n, section: 'global_top_strip', images: [] },
    ])
    const grouped = await cms.getBannersBySections(['global_top_strip'])
    expect(grouped.global_top_strip.id).toBe(1n)
  })

  it('resolves image paths against the media base', async () => {
    prismaMock.banner.findFirst.mockResolvedValue({
      id: 1n,
      section: 'home_hero',
      images: [{ id: 1n, image: 'banners/hero.jpg', mobileImage: null }],
    })
    const banner = await cms.getBannerBySection('home_hero')
    expect(banner.images[0].image).toBe('http://localhost:5000/storage/banners/hero.jpg')
  })
})

// ─────────────────────────────────────────────────────── pages

describe('site pages', () => {
  it('404s for a slug outside the SitePages allow-list without querying', async () => {
    await expect(cms.getSitePage('made-up')).rejects.toThrow('Page not found.')
    expect(prismaMock.page.findFirst).not.toHaveBeenCalled()
  })

  it('serves the four allowed CMS pages', async () => {
    prismaMock.page.findFirst.mockResolvedValue({
      id: 1n,
      slug: 'about-us',
      title: 'About Us',
      content: '<p>Hello</p>',
    })
    const page = await cms.getSitePage('about-us')
    expect(page.title).toBe('About Us')
  })

  it('404s when the row is missing or inactive', async () => {
    prismaMock.page.findFirst.mockResolvedValue(null)
    await expect(cms.getSitePage('privacy')).rejects.toThrow('Page not found.')
  })
})

describe('support pages', () => {
  it('resolves every allowed slug to its title', () => {
    expect(cms.getSupportPage('faqs')).toEqual({ slug: 'faqs', title: 'FAQs' })
    expect(cms.getSupportPage('returns')).toEqual({ slug: 'returns', title: 'Returns & Exchanges' })
    expect(cms.getSupportPage('size-guide')).toEqual({ slug: 'size-guide', title: 'Size Guide' })
  })

  it('defaults to faqs', () => {
    expect(cms.getSupportPage().slug).toBe('faqs')
  })

  it('404s outside the allow-list, matching abort(404)', () => {
    expect(() => cms.getSupportPage('nope')).toThrow('Page not found.')
  })
})

// ─────────────────────────────────────────────────────── HTTP

describe('CMS endpoints', () => {
  it('GET /blog returns posts with pagination', async () => {
    prismaMock.blogPost.count.mockResolvedValue(1)
    prismaMock.blogPost.findMany.mockResolvedValue([post()])

    const res = await request(app).get('/api/v1/blog')
    expect(res.status).toBe(200)
    expect(res.body.data.pagination.perPage).toBe(9)
    expect(res.body.data).toHaveProperty('newsTypes')
    expect(res.body.data).toHaveProperty('journalBanner')
  })

  it('GET /blog/:slug 404s cleanly', async () => {
    prismaMock.blogPost.findFirst.mockResolvedValue(null)
    const res = await request(app).get('/api/v1/blog/ghost')
    expect(res.status).toBe(404)
    expect(res.body.message).toBe('Post not found.')
  })

  it('does not read "support" as a CMS page slug', async () => {
    // Route-order regression guard: /pages/support is declared before /pages/:slug.
    const res = await request(app).get('/api/v1/pages/support')
    expect(res.status).toBe(200)
    expect(res.body.data.pages).toHaveLength(9)
    expect(prismaMock.page.findFirst).not.toHaveBeenCalled()
  })

  it('GET /pages/support/:page validates against the allow-list', async () => {
    const good = await request(app).get('/api/v1/pages/support/size-guide')
    expect(good.status).toBe(200)
    expect(good.body.data.title).toBe('Size Guide')

    const bad = await request(app).get('/api/v1/pages/support/not-a-page')
    expect(bad.status).toBe(404)
  })

  it('GET /pages lists the four CMS pages', async () => {
    const res = await request(app).get('/api/v1/pages')
    expect(res.body.data.pages.map((p) => p.slug)).toEqual([
      'about-us',
      'terms-of-use',
      'privacy',
      'refund-return-policy',
    ])
  })

  it('GET /banners ignores unknown section keys instead of erroring', async () => {
    const res = await request(app).get('/api/v1/banners?sections=home_hero,made_up')
    expect(res.status).toBe(200)
    expect(prismaMock.banner.findMany.mock.calls[0][0].where.section).toEqual({
      in: ['home_hero'],
    })
  })

  it('GET /news-types returns active types', async () => {
    prismaMock.newsType.findMany.mockResolvedValue([{ id: 1n, title: 'Craft', slug: 'craft' }])
    const res = await request(app).get('/api/v1/news-types')
    expect(res.body.data.newsTypes[0].slug).toBe('craft')
    expect(prismaMock.newsType.findMany.mock.calls[0][0].where).toEqual({ isActive: true })
  })
})
