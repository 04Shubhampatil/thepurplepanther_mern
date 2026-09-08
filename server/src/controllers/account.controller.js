import * as account from '../services/account.service.js'
import { ok, created, noContent, asyncHandler } from '../utils/api-response.js'
import { NotFoundError } from '../utils/api-error.js'
import { ACCOUNT_PAGES, ACCOUNT_PAGE_ALIASES } from '../constants/cms.js'

/**
 * Account endpoints. Every route sits behind requireAuth + requireCustomer, and each
 * mutation additionally re-checks row ownership in the service.
 */

/**
 * GET /account/:page? — the whole account area in one call, as AccountController::bootstrap
 * did. `favorites` and `wishlists` are legacy aliases for `wishlist`.
 */
export const show = asyncHandler(async (req, res) => {
  const requested = req.params.page ?? 'overview'
  const page = ACCOUNT_PAGE_ALIASES[requested] ?? requested

  if (!Object.prototype.hasOwnProperty.call(ACCOUNT_PAGES, page)) {
    throw new NotFoundError('Page not found.')
  }

  const data = await account.bootstrap(req.user)
  return ok(res, { page, title: ACCOUNT_PAGES[page], ...data }, 'Account')
})

export const updateProfile = asyncHandler(async (req, res) =>
  ok(
    res,
    { user: await account.updateProfile(req.user, req.body) },
    'Your information has been saved.',
  ),
)

// ── addresses ──────────────────────────────────────────────────────────────

export const listAddresses = asyncHandler(async (req, res) =>
  ok(res, { addresses: await account.listAddresses(req.user.id) }, 'Addresses'),
)

export const storeAddress = asyncHandler(async (req, res) =>
  created(res, { address: await account.createAddress(req.user.id, req.body) }, 'Address saved.'),
)

export const updateAddress = asyncHandler(async (req, res) =>
  ok(
    res,
    { address: await account.updateAddress(req.user.id, req.params.id, req.body) },
    'Address updated.',
  ),
)

export const destroyAddress = asyncHandler(async (req, res) => {
  await account.deleteAddress(req.user.id, req.params.id)
  return ok(res, {}, 'Address deleted.')
})

export const setDefaultAddress = asyncHandler(async (req, res) =>
  ok(
    res,
    { address: await account.setDefaultAddress(req.user.id, req.params.id) },
    'Default address updated.',
  ),
)

// ── wishlist ───────────────────────────────────────────────────────────────

export const listWishlist = asyncHandler(async (req, res) =>
  ok(res, { wishlist: await account.listWishlist(req.user.id) }, 'Wishlist'),
)

export const storeWishlist = asyncHandler(async (req, res) => {
  const { item } = await account.addToWishlist(req.user.id, req.body.product_id)

  // TODO(phase 12): Meta AddToWishlist, only when `created` is true — Laravel gated the
  // event on wasRecentlyCreated so re-adding does not double-count.

  return ok(res, { item }, 'Added to wishlist.')
})

export const destroyWishlistItem = asyncHandler(async (req, res) => {
  await account.removeFromWishlist(req.user.id, req.params.id)
  return ok(res, {}, 'Removed from wishlist.')
})

/** Remove by product id — the product page toggles without knowing the wishlist row id. */
export const destroyWishlistProduct = asyncHandler(async (req, res) => {
  await account.removeProductFromWishlist(req.user.id, req.params.productId)
  return ok(res, {}, 'Removed from wishlist.')
})

// ── reviews & orders ───────────────────────────────────────────────────────

export const listReviews = asyncHandler(async (req, res) =>
  ok(res, { reviews: await account.listReviews(req.user) }, 'Reviews'),
)

export const destroyReview = asyncHandler(async (req, res) => {
  await account.deleteReview(req.user.id, req.params.id)
  return ok(res, {}, 'Review deleted.')
})

export const listOrders = asyncHandler(async (req, res) =>
  ok(res, { orders: await account.listOrders(req.user.id) }, 'Orders'),
)

export { noContent }
export default {
  show,
  updateProfile,
  listAddresses,
  storeAddress,
  updateAddress,
  destroyAddress,
  setDefaultAddress,
  listWishlist,
  storeWishlist,
  destroyWishlistItem,
  destroyWishlistProduct,
  listReviews,
  destroyReview,
  listOrders,
}
