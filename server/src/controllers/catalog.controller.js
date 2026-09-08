import * as catalog from '../services/catalog.service.js'
import { ok, asyncHandler } from '../utils/api-response.js'

/** Taxonomy lookups and the homepage aggregate. */

export const categories = asyncHandler(async (req, res) =>
  ok(res, { categories: await catalog.listCategories() }, 'Categories'),
)

export const subCategories = asyncHandler(async (req, res) =>
  ok(
    res,
    { subCategories: await catalog.listSubCategories(req.query.category_id ?? null) },
    'Sub-categories',
  ),
)

export const brands = asyncHandler(async (req, res) =>
  ok(res, { brands: await catalog.listBrands() }, 'Brands'),
)

export const colors = asyncHandler(async (req, res) =>
  ok(res, { colors: await catalog.listColors() }, 'Colors'),
)

export const sizes = asyncHandler(async (req, res) =>
  ok(res, { sizes: await catalog.listSizes() }, 'Sizes'),
)

/**
 * GET /home — everything the homepage needs in one request.
 *
 * The Blade page ran roughly a dozen queries per render. This keeps the same fallback
 * chains but issues the independent ones concurrently.
 */
export const home = asyncHandler(async (req, res) => ok(res, await catalog.getHomePage(), 'Home'))

export default { categories, subCategories, brands, colors, sizes, home }
