import { Router } from 'express'
import adminAuthRoutes from './auth.routes.js'

/**
 * Admin API root: /api/v1/admin
 *
 * Authorisation is enforced per-router, not here, because the auth routes themselves must
 * stay reachable to a signed-out admin. Every OTHER admin router mounts behind
 * requireAuth + requireAdmin — hiding buttons in React is never the control.
 */
const router = Router()

router.use('/auth', adminAuthRoutes)

// -- added in phase 13 -----------------------------------------------------
// router.use('/dashboard', requireAuth, requireAdmin, dashboardRoutes)
// router.use('/products',  requireAuth, requireAdmin, productRoutes)
// router.use('/orders',    requireAuth, requireAdmin, orderRoutes)
// ...

export default router
