import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as checkoutController from '../controllers/checkout.controller.js'
import { validate } from '../middleware/validate.middleware.js'
import { attachUser } from '../middleware/auth.middleware.js'
import { attachGuestCart } from '../middleware/guest-cart.middleware.js'
import { placeOrderSchema, verifyPaymentSchema } from '../validators/checkout.validator.js'
import env from '../config/env.js'

/**
 * Checkout — public, because guest checkout creates the account.
 *
 * `place` is rate limited: it creates a database row and calls Razorpay on every request,
 * so an unthrottled endpoint is both a spam vector and a cost. Laravel had no limit here.
 * `verify` is limited more tightly still — repeated calls against one order with different
 * signatures is exactly what a forgery attempt looks like.
 */
const router = Router()

router.use(attachUser, attachGuestCart)

const placeLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many checkout attempts. Please try again later.' },
})

const verifyLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  // Successful verifications must not count — a customer who legitimately retries after a
  // network blip should never be locked out of confirming an order they have paid for.
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many verification attempts. Please contact support.' },
})

router.get('/', checkoutController.show)
router.post('/place', placeLimiter, validate(placeOrderSchema), checkoutController.place)
router.post('/verify', verifyLimiter, validate(verifyPaymentSchema), checkoutController.verify)

export default router
