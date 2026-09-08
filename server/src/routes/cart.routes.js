import { Router } from 'express'
import * as cartController from '../controllers/cart.controller.js'
import { validate } from '../middleware/validate.middleware.js'
import { attachUser } from '../middleware/auth.middleware.js'
import { attachGuestCart } from '../middleware/guest-cart.middleware.js'
import {
  addToCartSchema,
  updateCartSchema,
  removeCartSchema,
  applyCouponSchema,
} from '../validators/cart.validator.js'

/**
 * Cart routes — public, exactly as in Laravel. Guests have carts too.
 *
 * `attachUser` + `attachGuestCart` run on every route so each handler can branch on
 * whether there is a signed-in user without repeating the lookup.
 *
 * ROUTE ORDER: `/coupon` and `/buy-now` are literals under the same prefix as
 * `/items/:productId`; they are declared first so neither is read as a product id.
 */
const router = Router()

router.use(attachUser, attachGuestCart)

router.get('/', cartController.index)

router.get('/coupons', cartController.publicCoupons)
router.post('/coupon', validate(applyCouponSchema), cartController.applyCoupon)
router.delete('/coupon', cartController.removeCoupon)

router.post('/buy-now', validate(addToCartSchema), cartController.buyNow)

router.post('/items', validate(addToCartSchema), cartController.store)
router.patch('/items/:productId', validate(updateCartSchema), cartController.update)
router.delete('/items/:productId', validate(removeCartSchema), cartController.destroy)

export default router
