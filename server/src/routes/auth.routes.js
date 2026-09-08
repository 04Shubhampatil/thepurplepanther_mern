import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as authController from '../controllers/auth.controller.js'
import { validate } from '../middleware/validate.middleware.js'
import { attachUser } from '../middleware/auth.middleware.js'
import {
  loginSchema,
  registerSchema,
  checkEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.validator.js'
import env from '../config/env.js'

const router = Router()

/**
 * Credential endpoints get a tighter limit than the global API one. Laravel had no
 * throttling on customer login at all — only the 2-per-day cap on password resets — so
 * this closes a real brute-force gap without changing any success-path behaviour.
 */
const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only failed attempts count toward the limit
  message: { success: false, message: 'Too many attempts. Please try again later.' },
})

router.post('/login', authLimiter, validate(loginSchema), authController.login)
router.post('/register', authLimiter, validate(registerSchema), authController.register)
router.post('/logout', authController.logout)

router.get('/me', attachUser, authController.me)

router.post('/check-email', attachUser, validate(checkEmailSchema), authController.checkEmail)

router.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
)
router.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
)

export default router
