import { Router } from 'express'
import * as checkoutController from '../controllers/checkout.controller.js'
import { attachUser } from '../middleware/auth.middleware.js'

/**
 * Order confirmation page.
 *
 * Public in the sense that no login is required — a guest who has just paid must be able
 * to see their order. Access is controlled inside the service: an unpaid order is refused,
 * and a signed-in customer may only read their own (admins may read any).
 */
const router = Router()

router.use(attachUser)
router.get('/:orderNumber', checkoutController.showOrder)

export default router
