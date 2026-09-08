import { Router } from 'express'
import * as accountController from '../controllers/account.controller.js'
import { validate } from '../middleware/validate.middleware.js'
import { attachUser, requireAuth, requireCustomer } from '../middleware/auth.middleware.js'
import {
  updateProfileSchema,
  addressSchema,
  wishlistSchema,
} from '../validators/account.validator.js'

/**
 * Account routes — Laravel's `['auth', 'customer']` group.
 *
 * The guard is applied to the whole router rather than per route, so a new endpoint added
 * here cannot accidentally ship unauthenticated. Ownership of each row is checked again in
 * the service.
 *
 * ROUTE ORDER: literal paths precede `/:page`, or "addresses" is read as an account page.
 */
const router = Router()

router.use(attachUser, requireAuth, requireCustomer)

// -- collections (literals first) -------------------------------------------
router.patch('/profile', validate(updateProfileSchema), accountController.updateProfile)

router.get('/addresses', accountController.listAddresses)
router.post('/addresses', validate(addressSchema), accountController.storeAddress)
router.patch('/addresses/:id', validate(addressSchema), accountController.updateAddress)
router.delete('/addresses/:id', accountController.destroyAddress)
router.post('/addresses/:id/default', accountController.setDefaultAddress)

router.get('/wishlist', accountController.listWishlist)
router.post('/wishlist', validate(wishlistSchema), accountController.storeWishlist)
router.delete('/wishlist/product/:productId', accountController.destroyWishlistProduct)
router.delete('/wishlist/:id', accountController.destroyWishlistItem)

router.get('/reviews', accountController.listReviews)
router.delete('/reviews/:id', accountController.destroyReview)

router.get('/orders', accountController.listOrders)

// -- the account page aggregate (wildcard last) -----------------------------
router.get('/', accountController.show)
router.get('/:page', accountController.show)

export default router
