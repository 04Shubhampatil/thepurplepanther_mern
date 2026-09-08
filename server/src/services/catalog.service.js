import prisma from '../config/database.js'
import { NotFoundError } from '../utils/api-error.js'
import { presentProductCard, presentProductDetail } from '../utils/product-presenter.js'
import { presentBanner } from './cms.service.js'

/**
 * Catalog reads — products, categories and search.
 *
 * Ported from FrontendController::home / collection / search / shopSingle.
 *
 * PERFORMANCE. Laravel eager-loaded with `with([...])` on every list query; the Prisma
 * equivalent is an explicit `include`. Every list here includes exactly what the presenter
 * touches, so no lazy N+1 can occur — there is no lazy loading to fall back on, so a
 * missing include is a crash in tests rather than a silent per-row query in production.
 */

/** Include set for card payloads. Mirrors `with(['category', 'colors', 'sizes'])`. */
const CARD_INCLUDE = {
  category: { select: { id: true, title: true, slug: true } },
  offer: { select: { id: true, title: true, discountPercent: true } },
  colors: { include: { color: { select: { id: true, name: true, code: true } } } },
  sizes: { include: { size: { select: { id: true, name: true } } } },
}

/** Laravel's default ordering for every product list: sort_order ASC, then id DESC. */
const PRODUCT_ORDER = [{ sortOrder: 'asc' }, { id: 'desc' }]

const ACTIVE = { isActive: true }

/**
 * FrontendController::applyProductSearch — a LIKE across five product columns plus the
 * category and sub-category names. MySQL's default collation is case-insensitive, so
 * `contains` reproduces it.
 */
function searchFilter(term) {
  return {
    OR: [
      { title: { contains: term } },
      { slug: { contains: term } },
      { shortDescription: { contains: term } },
      { features: { contains: term } },
      { category: { OR: [{ title: { contains: term } }, { slug: { contains: term } }] } },
      { subCategory: { OR: [{ title: { contains: term } }, { slug: { contains: term } }] } },
    ],
  }
}

// ─────────────────────────────────────────────────────── listing

/**
 * Product listing for /shop, /collection and /{categorySlug}.
 *
 * @param {{categorySlug?: string|null, search?: string, page?: number, perPage?: number}} options
 * @throws NotFoundError when a category slug is supplied but no active category matches —
 *         matching Laravel's abort(404).
 */
export async function listProducts({ categorySlug = null, search = '', page = 1, perPage = 50 } = {}) {
  let activeCategory = null

  if (categorySlug) {
    activeCategory = await prisma.category.findFirst({
      where: { slug: categorySlug, ...ACTIVE },
      select: { id: true, title: true, slug: true, shortDescription: true, image: true },
    })
    if (!activeCategory) throw new NotFoundError('Category not found.')
  }

  const term = String(search ?? '').trim()
  const where = {
    ...ACTIVE,
    ...(activeCategory ? { categoryId: activeCategory.id } : {}),
    ...(term !== '' ? searchFilter(term) : {}),
  }

  const take = Math.min(Math.max(1, perPage), 100)
  const currentPage = Math.max(1, page)

  // One round trip for the page and its total, rather than two sequential queries.
  const [total, rows] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: CARD_INCLUDE,
      orderBy: PRODUCT_ORDER,
      skip: (currentPage - 1) * take,
      take,
    }),
  ])

  return {
    products: rows.map(presentProductCard),
    activeCategory,
    search: term,
    pagination: {
      page: currentPage,
      perPage: take,
      total,
      lastPage: Math.max(1, Math.ceil(total / take)),
      hasMore: currentPage * take < total,
    },
  }
}

/** All active categories, ordered as the storefront nav expects. */
export async function listCategories() {
  return prisma.category.findMany({
    where: ACTIVE,
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    select: {
      id: true,
      title: true,
      slug: true,
      image: true,
      shortDescription: true,
      hasColor: true,
      hasSize: true,
      showOnHome: true,
    },
  })
}

export async function listSubCategories(categoryId = null) {
  return prisma.subCategory.findMany({
    where: { ...ACTIVE, ...(categoryId ? { categoryId: BigInt(categoryId) } : {}) },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    select: { id: true, categoryId: true, title: true, slug: true, image: true },
  })
}

export async function listBrands() {
  return prisma.brand.findMany({
    where: ACTIVE,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, slug: true, image: true },
  })
}

export async function listColors() {
  return prisma.color.findMany({
    where: ACTIVE,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, code: true },
  })
}

export async function listSizes() {
  return prisma.size.findMany({
    where: ACTIVE,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true },
  })
}

// ─────────────────────────────────────────────────────── detail

/** Full detail include: everything presentProductDetail reads. */
const DETAIL_INCLUDE = {
  ...CARD_INCLUDE,
  subCategory: { select: { id: true, title: true, slug: true } },
  brand: { select: { id: true, name: true } },
  images: {
    include: { color: { select: { id: true, name: true } } },
    orderBy: { sortOrder: 'asc' },
  },
  reviews: { where: ACTIVE, orderBy: { id: 'desc' } },
}

export async function getProductBySlug(slug) {
  const product = await prisma.product.findFirst({
    where: { slug, ...ACTIVE },
    include: DETAIL_INCLUDE,
  })
  if (!product) throw new NotFoundError('Product not found.')
  return presentProductDetail(product)
}

/**
 * Related products — same category first, topped up from anywhere when fewer than 4.
 *
 * The top-up rule is not cosmetic: the theme's related-products carousel breaks its
 * layout below four items, which is why Laravel had the same fallback.
 */
export async function getRelatedProducts(product, limit = 8) {
  const productId = BigInt(product.id)

  const sameCategory = await prisma.product.findMany({
    where: { ...ACTIVE, id: { not: productId }, ...(product.category ? { categoryId: BigInt(product.category.id) } : {}) },
    include: CARD_INCLUDE,
    orderBy: PRODUCT_ORDER,
    take: limit,
  })

  if (sameCategory.length >= 4) return sameCategory.map(presentProductCard)

  const extra = await prisma.product.findMany({
    where: {
      ...ACTIVE,
      id: { notIn: [productId, ...sameCategory.map((p) => p.id)] },
    },
    include: CARD_INCLUDE,
    orderBy: { id: 'desc' },
    take: limit - sameCategory.length,
  })

  return [...sameCategory, ...extra].map(presentProductCard)
}

/** Recently-viewed, resolved from ids and re-sorted into the order they were given. */
export async function getProductsByIds(ids = []) {
  const keys = ids.map((id) => BigInt(id)).filter(Boolean)
  if (keys.length === 0) return []

  const rows = await prisma.product.findMany({
    where: { ...ACTIVE, id: { in: keys } },
    include: CARD_INCLUDE,
  })

  const order = keys.map(String)
  return rows
    .sort((a, b) => order.indexOf(String(a.id)) - order.indexOf(String(b.id)))
    .map(presentProductCard)
}

// ─────────────────────────────────────────────────────── search

/**
 * Type-ahead search. Fewer than 2 characters returns empty WITHOUT querying, matching
 * Laravel — otherwise every keystroke on an empty box scans the product table.
 */
export async function searchProducts(query, limit = 8) {
  const term = String(query ?? '').trim()

  if (term.length < 2) {
    return { query: term, products: [], count: 0, message: 'Type at least 2 characters' }
  }

  const rows = await prisma.product.findMany({
    where: { ...ACTIVE, ...searchFilter(term) },
    include: CARD_INCLUDE,
    orderBy: PRODUCT_ORDER,
    take: limit,
  })

  const products = rows.map(presentProductCard)
  return { query: term, products, count: products.length, seeAllUrl: `/shop?q=${encodeURIComponent(term)}` }
}

// ─────────────────────────────────────────────────────── home

/**
 * Homepage payload — port of FrontendController::home.
 *
 * Each section has a fallback chain that must be preserved, because the homepage is never
 * allowed to render an empty slot:
 *   shop-the-look  : curated home_section_products -> featured -> any (2 items)
 *   new arrivals   : is_new_arrival -> any (6)
 *   accessories    : is_popular_accessory -> category slug 'accessories' OR title like
 *                    '%accessor%' (6)
 */
export async function getHomePage() {
  const [banners, curated, journalPosts] = await Promise.all([
    prisma.banner.findMany({
      where: ACTIVE,
      include: { images: { where: ACTIVE, orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    }),
    prisma.homeSectionProduct.findMany({
      where: { section: 'shop_the_look' },
      orderBy: { position: 'asc' },
      select: { productId: true },
    }),
    prisma.blogPost.findMany({
      where: { ...ACTIVE, OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }] },
      include: { newsType: { select: { id: true, title: true, slug: true } } },
      orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
      take: 4,
    }),
  ])

  // Banners are grouped by section; each section renders its first banner.
  //
  // presentBanner is REQUIRED here, not cosmetic: without it the raw `banners/x.jpg`
  // column value reaches the browser and resolves against the site origin instead of the
  // media base, so the homepage hero renders no image at all. Shared with the /banners
  // endpoint so the two cannot diverge again.
  const bannerSections = {}
  for (const banner of banners) {
    if (!bannerSections[banner.section]) bannerSections[banner.section] = presentBanner(banner)
  }

  const curatedIds = curated.map((row) => row.productId)
  let shopTheLook = curatedIds.length ? await getProductsByIds(curatedIds) : []

  if (shopTheLook.length < 2) {
    const featured = await prisma.product.findMany({
      where: { ...ACTIVE, isFeatured: true },
      include: CARD_INCLUDE,
      orderBy: PRODUCT_ORDER,
      take: 2,
    })
    shopTheLook = featured.map(presentProductCard)
  }
  if (shopTheLook.length < 2) {
    const any = await prisma.product.findMany({
      where: ACTIVE,
      include: CARD_INCLUDE,
      orderBy: PRODUCT_ORDER,
      take: 2,
    })
    shopTheLook = any.map(presentProductCard)
  }

  let newArrivals = await prisma.product.findMany({
    where: { ...ACTIVE, isNewArrival: true },
    include: CARD_INCLUDE,
    orderBy: PRODUCT_ORDER,
    take: 6,
  })
  if (newArrivals.length === 0) {
    newArrivals = await prisma.product.findMany({
      where: ACTIVE,
      include: CARD_INCLUDE,
      orderBy: PRODUCT_ORDER,
      take: 6,
    })
  }

  let popularAccessories = await prisma.product.findMany({
    where: { ...ACTIVE, isPopularAccessory: true },
    include: CARD_INCLUDE,
    orderBy: PRODUCT_ORDER,
    take: 6,
  })
  if (popularAccessories.length === 0) {
    popularAccessories = await prisma.product.findMany({
      where: {
        ...ACTIVE,
        category: { OR: [{ slug: 'accessories' }, { title: { contains: 'accessor' } }] },
      },
      include: CARD_INCLUDE,
      orderBy: PRODUCT_ORDER,
      take: 6,
    })
  }

  return {
    banners: bannerSections,
    shopTheLook,
    newArrivals: newArrivals.map(presentProductCard),
    popularAccessories: popularAccessories.map(presentProductCard),
    journalPosts,
  }
}

export default {
  listProducts,
  listCategories,
  listSubCategories,
  listBrands,
  listColors,
  listSizes,
  getProductBySlug,
  getRelatedProducts,
  getProductsByIds,
  searchProducts,
  getHomePage,
}
