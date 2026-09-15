import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as newsletterController from '../controllers/newsletter.controller.js'
import * as catalogFeedController from '../controllers/catalog-feed.controller.js'
import { attachUser } from '../middleware/auth.middleware.js'
import env from '../config/env.js'

/**
 * Newsletter, contact and the Meta catalog feed.
 *
 * Public write endpoints are rate limited — they insert rows an admin later reads, so
 * without a limit they are a spam sink. Laravel had no throttling on either.
 */
const router = Router()

const writeLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
})

router.post('/newsletter/check', newsletterController.check)
router.post('/newsletter/subscribe', writeLimiter, attachUser, newsletterController.subscribe)
router.post('/contact', writeLimiter, newsletterController.contact)

// The feed keeps its ORIGINAL path as well, because Meta Commerce Manager is configured
// against it. Both are mounted; see docs/route-mapping.md §6.
router.get('/catalog/meta/products.csv', catalogFeedController.feed)
// Token-free copy of the same CSV, for opening directly in a browser or Excel.
router.get('/catalog/meta/products-public.csv', catalogFeedController.publicFeed)

export default router
