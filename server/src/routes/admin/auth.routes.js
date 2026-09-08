import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as adminAuthController from '../../controllers/admin/auth.controller.js'
import { validate } from '../../middleware/validate.middleware.js'
import { attachUser, requireAuth, requireAdmin } from '../../middleware/auth.middleware.js'
import { adminLoginSchema } from '../../validators/auth.validator.js'
import env from '../../config/env.js'

const router = Router()

/** Admin credentials are higher value than customer ones — a tighter limit. */
const adminLoginLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: Math.max(5, Math.floor(env.AUTH_RATE_LIMIT_MAX / 2)),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
})

router.post('/login', adminLoginLimiter, validate(adminLoginSchema), adminAuthController.login)
router.post('/logout', adminAuthController.logout)
router.get('/me', attachUser, requireAuth, requireAdmin, adminAuthController.me)

export default router
