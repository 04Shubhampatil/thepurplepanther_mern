import { Router } from 'express'
import * as productController from '../controllers/product.controller.js'
import * as catalogController from '../controllers/catalog.controller.js'
import { validate } from '../middleware/validate.middleware.js'
import { attachUser } from '../middleware/auth.middleware.js'
import { createReviewSchema } from '../validators/catalog.validator.js'

/**
 * Public catalog routes.
 *
 * ROUTE ORDER MATTERS. `/products/:slug` is a wildcard, so any literal path under
 * `/products` must be declared BEFORE it or it is swallowed and read as a slug. This is
 * the same hazard Laravel worked around by registering `products/check-title` and
 * `products/sub-categories` ahead of `Route::resource('products')` — see
 * docs/route-mapping.md §8.
 */
const router = Router()

// -- taxonomy (no wildcards) ------------------------------------------------
router.get('/categories', catalogController.categories)
router.get('/sub-categories', catalogController.subCategories)
router.get('/brands', catalogController.brands)
router.get('/colors', catalogController.colors)
router.get('/sizes', catalogController.sizes)
router.get('/home', catalogController.home)
router.get('/search', productController.search)

// -- products ---------------------------------------------------------------
router.get('/products', productController.index)

// Literal paths under /products would go HERE, above the wildcard.

router.get('/products/:slug', productController.show)

// `attachUser` so a signed-in customer's review is linked to their account without
// requiring authentication — guests may review, exactly as in Laravel.
router.post(
  '/products/:slug/reviews',
  attachUser,
  validate(createReviewSchema),
  productController.storeReview,
)

export default router
