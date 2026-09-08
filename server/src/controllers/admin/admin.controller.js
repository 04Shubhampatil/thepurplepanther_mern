import * as catalogAdmin from '../../services/admin/catalog-admin.service.js'
import * as orderAdmin from '../../services/admin/order-admin.service.js'
import * as miscAdmin from '../../services/admin/misc-admin.service.js'
import * as accountService from '../../services/account.service.js'
import { ok, created, asyncHandler } from '../../utils/api-response.js'
import { BANNER_SECTIONS } from '../../constants/cms.js'
import { STATUS_LABELS } from '../../constants/order-statuses.js'

/** Admin handlers for the modules that need more than the CRUD factory. */

const intParam = (value, fallback) => Number.parseInt(value ?? String(fallback), 10) || fallback

// ── dashboard & profile ────────────────────────────────────────────────────

export const dashboard = asyncHandler(async (req, res) =>
  ok(res, await orderAdmin.dashboardStats(), 'Dashboard'),
)

export const profile = asyncHandler(async (req, res) =>
  ok(res, { user: accountService.customerPayload(req.user) }, 'Profile'),
)

export const updateProfile = asyncHandler(async (req, res) =>
  ok(res, { user: await accountService.updateProfile(req.user, req.body) }, 'Profile updated.'),
)

// ── products ───────────────────────────────────────────────────────────────

export const productIndex = asyncHandler(async (req, res) =>
  ok(
    res,
    await catalogAdmin.listProducts({
      search: req.query.search ?? '',
      categoryId: req.query.category_id,
      brandId: req.query.brand_id,
      offerId: req.query.offer_id,
      page: intParam(req.query.page, 1),
      perPage: intParam(req.query.per_page, 10),
    }),
    'Products',
  ),
)

/** Form data for the product editor — categories, brands, offers, colours, sizes. */
export const productFormData = asyncHandler(async (req, res) =>
  ok(res, await catalogAdmin.productFormData(), 'Product form data'),
)

/**
 * `products.title` carries a UNIQUE constraint, which is why the admin form probes it
 * before submitting.
 */
export const checkTitle = asyncHandler(async (req, res) =>
  ok(
    res,
    { available: await catalogAdmin.isTitleAvailable(req.query.title, req.query.ignore_id) },
    'This product title already exists. Duplicate name not allowed.',
  ),
)

export const subCategoriesFor = asyncHandler(async (req, res) => {
  const { listSubCategories } = await import('../../services/catalog.service.js')
  return ok(
    res,
    { subCategories: await listSubCategories(req.query.category_id) },
    'Sub-categories',
  )
})

export const productShow = asyncHandler(async (req, res) =>
  ok(res, { item: await catalogAdmin.findProduct(req.params.id) }, 'Product'),
)

export const productStore = asyncHandler(async (req, res) =>
  created(res, { item: await catalogAdmin.createProduct(req.body, req.files ?? {}) }, 'Product created.'),
)

export const productUpdate = asyncHandler(async (req, res) =>
  ok(
    res,
    { item: await catalogAdmin.updateProduct(req.params.id, req.body, req.files ?? {}) },
    'Product updated.',
  ),
)

export const productDestroy = asyncHandler(async (req, res) => {
  await catalogAdmin.deleteProduct(req.params.id)
  return ok(res, {}, 'Product deleted.')
})

export const productBulk = asyncHandler(async (req, res) =>
  ok(res, {}, await catalogAdmin.bulkProductAction(req.body.action, req.body.ids)),
)

export const productToggle = asyncHandler(async (req, res) =>
  ok(res, { isActive: await catalogAdmin.toggleProduct(req.params.id, 'isActive') }, 'Product status updated.'),
)

export const productToggleFeatured = asyncHandler(async (req, res) =>
  ok(
    res,
    { isFeatured: await catalogAdmin.toggleProduct(req.params.id, 'isFeatured') },
    'Product featured status updated.',
  ),
)

// ── product reviews ────────────────────────────────────────────────────────

export const reviewIndex = asyncHandler(async (req, res) =>
  ok(
    res,
    await catalogAdmin.listProductReviews(req.params.id, { page: intParam(req.query.page, 1) }),
    'Reviews',
  ),
)

export const reviewStore = asyncHandler(async (req, res) =>
  created(
    res,
    { item: await catalogAdmin.createProductReview(req.params.id, req.body) },
    'Review added successfully.',
  ),
)

export const reviewToggle = asyncHandler(async (req, res) =>
  ok(
    res,
    { isActive: await catalogAdmin.toggleProductReview(req.params.id, req.params.reviewId) },
    'Review status updated.',
  ),
)

export const reviewDestroy = asyncHandler(async (req, res) => {
  await catalogAdmin.deleteProductReview(req.params.id, req.params.reviewId)
  return ok(res, {}, 'Review deleted successfully.')
})

// ── orders ─────────────────────────────────────────────────────────────────

export const orderIndex = asyncHandler(async (req, res) =>
  ok(
    res,
    await orderAdmin.listOrders({
      search: req.query.search ?? '',
      status: req.query.status ?? null,
      page: intParam(req.query.page, 1),
      perPage: intParam(req.query.per_page, 20),
    }),
    'Orders',
  ),
)

export const orderShow = asyncHandler(async (req, res) =>
  ok(res, { order: await orderAdmin.findOrder(req.params.id) }, 'Order'),
)

/** Laravel rendered a print view; React renders it, so this returns the same data. */
export const orderPrint = asyncHandler(async (req, res) =>
  ok(res, { order: await orderAdmin.findOrder(req.params.id) }, 'Order'),
)

export const orderStatusData = asyncHandler(async (req, res) =>
  ok(res, await orderAdmin.statusPayload(req.params.id), 'Order status'),
)

export const orderUpdateStatus = asyncHandler(async (req, res) =>
  ok(
    res,
    { order: await orderAdmin.updateStatus(req.params.id, req.body) },
    'Order status updated.',
  ),
)

export const orderUpdateDeliveryDate = asyncHandler(async (req, res) =>
  ok(
    res,
    { order: await orderAdmin.updateDeliveryDate(req.params.id, req.body.expected_delivery_date) },
    'Delivery date updated.',
  ),
)

export const orderDeleteStatusLog = asyncHandler(async (req, res) => {
  await orderAdmin.deleteStatusLog(req.params.id, req.params.logId)
  return ok(res, {}, 'Status log deleted.')
})

export const orderDestroy = asyncHandler(async (req, res) => {
  await orderAdmin.deleteOrder(req.params.id)
  return ok(res, {}, 'Order deleted.')
})

export const orderBulk = asyncHandler(async (req, res) =>
  ok(res, {}, await orderAdmin.bulkOrderAction(req.body.action, req.body.ids)),
)

export const orderStatuses = asyncHandler(async (req, res) =>
  ok(
    res,
    { statuses: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })) },
    'Order statuses',
  ),
)

// ── users ──────────────────────────────────────────────────────────────────

export const userIndex = asyncHandler(async (req, res) =>
  ok(
    res,
    await miscAdmin.listUsers({
      search: req.query.search ?? '',
      role: req.query.role ?? null,
      page: intParam(req.query.page, 1),
      perPage: intParam(req.query.per_page, 20),
    }),
    'Users',
  ),
)

export const userShow = asyncHandler(async (req, res) =>
  ok(res, { item: await miscAdmin.findUser(req.params.id) }, 'User'),
)

export const userStore = asyncHandler(async (req, res) =>
  created(res, { item: await miscAdmin.createUser(req.body) }, 'User created.'),
)

export const userUpdate = asyncHandler(async (req, res) =>
  ok(res, { item: await miscAdmin.updateUser(req.params.id, req.body) }, 'User updated.'),
)

export const userDestroy = asyncHandler(async (req, res) => {
  await miscAdmin.deleteUser(req.params.id, req.user.id)
  return ok(res, {}, 'User deleted.')
})

export const userToggle = asyncHandler(async (req, res) =>
  ok(
    res,
    { isActive: await miscAdmin.toggleUser(req.params.id, req.user.id) },
    'User status updated.',
  ),
)

export const userBulk = asyncHandler(async (req, res) =>
  ok(res, {}, await miscAdmin.bulkUserAction(req.body.action, req.body.ids, req.user.id)),
)

// ── banners & home sections ────────────────────────────────────────────────

export const bannerIndex = asyncHandler(async (req, res) =>
  ok(
    res,
    {
      banners: await miscAdmin.listBanners({ section: req.query.section ?? null }),
      sections: Object.entries(BANNER_SECTIONS).map(([key, meta]) => ({ key, ...meta })),
    },
    'Banners',
  ),
)

export const bannerShow = asyncHandler(async (req, res) =>
  ok(res, { item: await miscAdmin.findBanner(req.params.id) }, 'Banner'),
)

export const bannerStore = asyncHandler(async (req, res) =>
  created(res, { item: await miscAdmin.createBanner(req.body, req.files ?? {}) }, 'Banner created.'),
)

/**
 * Update is POST, not PUT.
 *
 * Laravel registered it that way because Hostinger's ModSecurity blocks PUT and returns
 * 500. Preserved so any existing admin client keeps working; a PUT alias is also
 * registered in the router for correctness.
 */
export const bannerUpdate = asyncHandler(async (req, res) =>
  ok(
    res,
    { item: await miscAdmin.updateBanner(req.params.id, req.body, req.files ?? {}) },
    'Banner updated.',
  ),
)

export const bannerDestroy = asyncHandler(async (req, res) => {
  await miscAdmin.deleteBanner(req.params.id)
  return ok(res, {}, 'Banner deleted.')
})

export const bannerToggle = asyncHandler(async (req, res) =>
  ok(res, { isActive: await miscAdmin.toggleBanner(req.params.id) }, 'Banner status updated.'),
)

export const homeSectionShow = asyncHandler(async (req, res) =>
  ok(
    res,
    { section: req.query.section ?? 'shop_the_look', items: await miscAdmin.getHomeSection(req.query.section) },
    'Home section',
  ),
)

export const homeSectionUpdate = asyncHandler(async (req, res) =>
  ok(
    res,
    { items: await miscAdmin.updateHomeSection(req.body.section, req.body.product_ids ?? []) },
    'Home section updated.',
  ),
)

// ── coupons ────────────────────────────────────────────────────────────────

export const couponIndex = asyncHandler(async (req, res) =>
  ok(
    res,
    await miscAdmin.listCoupons({
      search: req.query.search ?? '',
      page: intParam(req.query.page, 1),
    }),
    'Coupons',
  ),
)

export const couponShow = asyncHandler(async (req, res) =>
  ok(res, { item: await miscAdmin.findCoupon(req.params.id) }, 'Coupon'),
)

export const couponStore = asyncHandler(async (req, res) =>
  created(res, { item: await miscAdmin.createCoupon(req.body, req.file) }, 'Coupon created.'),
)

export const couponUpdate = asyncHandler(async (req, res) =>
  ok(res, { item: await miscAdmin.updateCoupon(req.params.id, req.body, req.file) }, 'Coupon updated.'),
)

export const couponDestroy = asyncHandler(async (req, res) => {
  await miscAdmin.deleteCoupon(req.params.id)
  return ok(res, {}, 'Coupon deleted.')
})

export const couponToggle = asyncHandler(async (req, res) =>
  ok(res, { isActive: await miscAdmin.toggleCoupon(req.params.id) }, 'Coupon status updated.'),
)

// ── contacts ───────────────────────────────────────────────────────────────

export const contactIndex = asyncHandler(async (req, res) =>
  ok(
    res,
    {
      subscribers: await miscAdmin.listSubscribers({
        search: req.query.search ?? '',
        page: intParam(req.query.subscribers_page, 1),
      }),
      messages: await miscAdmin.listContactMessages({
        search: req.query.search ?? '',
        page: intParam(req.query.messages_page, 1),
      }),
    },
    'Contacts',
  ),
)

export const subscriberDestroy = asyncHandler(async (req, res) => {
  await miscAdmin.deleteSubscriber(req.params.id)
  return ok(res, {}, 'Subscriber deleted.')
})

export const subscriberBulk = asyncHandler(async (req, res) =>
  ok(res, {}, await miscAdmin.bulkDeleteSubscribers(req.body.ids)),
)

export const messageDestroy = asyncHandler(async (req, res) => {
  await miscAdmin.deleteContactMessage(req.params.id)
  return ok(res, {}, 'Message deleted.')
})

export const messageBulk = asyncHandler(async (req, res) =>
  ok(res, {}, await miscAdmin.bulkDeleteContactMessages(req.body.ids)),
)

// ── settings ───────────────────────────────────────────────────────────────

export const pageSettingsIndex = asyncHandler(async (req, res) =>
  ok(res, { pages: await miscAdmin.listSitePages() }, 'Pages'),
)

export const pageSettingsUpdate = asyncHandler(async (req, res) =>
  ok(res, { page: await miscAdmin.updateSitePage(req.params.slug, req.body) }, 'Page saved successfully.'),
)

export const shippingSettingsShow = asyncHandler(async (req, res) =>
  ok(res, { settings: await miscAdmin.getShippingSettings() }, 'Shipping settings'),
)

export const shippingSettingsUpdate = asyncHandler(async (req, res) =>
  ok(
    res,
    { settings: await miscAdmin.updateShippingSettings(req.body) },
    'Shipping settings updated.',
  ),
)

export default {
  dashboard,
  profile,
  updateProfile,
  productIndex,
  productFormData,
  checkTitle,
  subCategoriesFor,
  productShow,
  productStore,
  productUpdate,
  productDestroy,
  productBulk,
  productToggle,
  productToggleFeatured,
  reviewIndex,
  reviewStore,
  reviewToggle,
  reviewDestroy,
  orderIndex,
  orderShow,
  orderPrint,
  orderStatusData,
  orderUpdateStatus,
  orderUpdateDeliveryDate,
  orderDeleteStatusLog,
  orderDestroy,
  orderBulk,
  orderStatuses,
  userIndex,
  userShow,
  userStore,
  userUpdate,
  userDestroy,
  userToggle,
  userBulk,
  bannerIndex,
  bannerShow,
  bannerStore,
  bannerUpdate,
  bannerDestroy,
  bannerToggle,
  homeSectionShow,
  homeSectionUpdate,
  couponIndex,
  couponShow,
  couponStore,
  couponUpdate,
  couponDestroy,
  couponToggle,
  contactIndex,
  subscriberDestroy,
  subscriberBulk,
  messageDestroy,
  messageBulk,
  pageSettingsIndex,
  pageSettingsUpdate,
  shippingSettingsShow,
  shippingSettingsUpdate,
}
