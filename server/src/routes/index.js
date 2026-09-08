import { Router } from 'express'
import healthRoutes from './health.routes.js'
import authRoutes from './auth.routes.js'
import catalogRoutes from './catalog.routes.js'
import cmsRoutes from './cms.routes.js'
import cartRoutes from './cart.routes.js'
import adminRoutes from './admin/index.js'
import { publicConfig } from '../config/env.js'
import { ok } from '../utils/api-response.js'

/**
 * API v1 router.
 *
 * Routers are added here phase by phase, in the order set out in
 * docs/migration-status.md. Route ORDER matters in two places carried over from Laravel
 * (see docs/route-mapping.md §7 and §8):
 *   - admin product static paths must precede /products/:id
 *   - there is no category catch-all here; /api/v1 is a closed namespace, so the
 *     exclusion list is a React Router concern only.
 */
const router = Router()

router.use('/health', healthRoutes)

// Values React is allowed to read. See docs/env-mapping.md §10.
router.get('/config', (req, res) => ok(res, publicConfig, 'Configuration'))

router.use('/auth', authRoutes) // phase 2
router.use('/', catalogRoutes) // phase 3 — products, taxonomy, search, home
router.use('/', cmsRoutes) // phase 4 — blog, banners, pages
router.use('/cart', cartRoutes) // phase 5 + 7 — cart, coupons
router.use('/admin', adminRoutes) // phase 2 (auth only); rest in phase 13

// -- added in later phases -------------------------------------------------
// router.use('/wishlist', wishlistRoutes)      // phase 6
// router.use('/account', accountRoutes)        // phase 8
// router.use('/checkout', checkoutRoutes)      // phase 9-10
// router.use('/orders', orderRoutes)           // phase 9
// router.use('/catalog', catalogFeedRoutes)    // phase 12

export default router
