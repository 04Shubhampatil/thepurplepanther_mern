import * as catalog from '../services/catalog.service.js'
import * as reviewService from '../services/review.service.js'
import { ok, created, asyncHandler } from '../utils/api-response.js'
import { productListQuerySchema, searchQuerySchema, idsQuerySchema } from '../validators/catalog.validator.js'

/**
 * Catalog endpoints.
 *
 * Query strings are parsed here rather than by middleware because Express 5 makes
 * `req.query` a getter — the validate middleware stores parsed query data on
 * `req.validated` instead of replacing it, and these handlers read it directly.
 */

/** GET /products — powers /shop, /collection and /{categorySlug}. */
export const index = asyncHandler(async (req, res) => {
  const params = productListQuerySchema.parse(req.query)
  const result = await catalog.listProducts({
    categorySlug: params.category,
    search: params.search,
    page: params.page,
    perPage: params.perPage,
  })
  return ok(res, result, 'Products')
})

/**
 * GET /products/:slug
 *
 * Related and recently-viewed products ship with the detail payload so the page renders
 * in one round trip, as the Blade page did.
 *
 * `recent` is supplied by the client. Laravel kept recently-viewed in the PHP session;
 * React owns it now (localStorage) because it is per-device UI state with no business
 * meaning — it never affects pricing, stock or any server decision.
 */
export const show = asyncHandler(async (req, res) => {
  const product = await catalog.getProductBySlug(req.params.slug)

  const { ids } = idsQuerySchema.parse(req.query)
  const recentIds = ids.filter((id) => String(id) !== String(product.id)).slice(0, 8)

  const [related, recentlyViewed] = await Promise.all([
    catalog.getRelatedProducts(product),
    recentIds.length ? catalog.getProductsByIds(recentIds) : Promise.resolve([]),
  ])

  return ok(res, { product, related, recentlyViewed }, 'Product')
})

/** GET /search — type-ahead. Returns empty below 2 characters without querying. */
export const search = asyncHandler(async (req, res) => {
  const { query, limit } = searchQuerySchema.parse(req.query)
  const result = await catalog.searchProducts(query, limit)

  // TODO(phase 12): Meta `Search` event, deduplicated per session as Laravel did.

  return ok(res, result, 'Search results')
})

/** POST /products/:slug/reviews — public; see review.service.js for the parity notes. */
export const storeReview = asyncHandler(async (req, res) => {
  const review = await reviewService.createProductReview({
    slug: req.params.slug,
    rating: req.body.rating,
    comment: req.body.comment,
    reviewerName: req.body.reviewer_name,
    reviewerEmail: req.body.reviewer_email,
    userId: req.user?.id ?? null,
  })

  return created(
    res,
    { id: review.id },
    'Thank you! Your review has been submitted.',
  )
})

export default { index, show, search, storeReview }
