import { Router } from 'express'
import adminAuthRoutes from './auth.routes.js'
import * as admin from '../../controllers/admin/admin.controller.js'
import { createResourceController } from '../../controllers/admin/resource.controller.js'
import * as catalogAdmin from '../../services/admin/catalog-admin.service.js'
import { validate } from '../../middleware/validate.middleware.js'
import { attachUser, requireAuth, requireAdmin } from '../../middleware/auth.middleware.js'
import { upload } from '../../services/upload.service.js'
import * as v from '../../validators/admin.validator.js'

/**
 * Admin API: /api/v1/admin
 *
 * AUTHORISATION. Only `/auth` is reachable signed-out; everything below the guard line
 * requires authentication AND the admin role. The guard is applied once to the router, so
 * a newly added endpoint cannot ship unprotected by omission — hiding buttons in React is
 * never the control (brief §31).
 *
 * ROUTE ORDER. Literal paths under a resource must precede that resource's `/:id`, or they
 * are read as ids. This is the same hazard Laravel worked around by registering
 * `products/check-title` and `products/bulk` before `Route::resource('products')`.
 */
const router = Router()

// Public: admins must be able to sign in.
router.use('/auth', adminAuthRoutes)

// ─────────────────────────── everything below requires an admin ───────────
router.use(attachUser, requireAuth, requireAdmin)

router.get('/dashboard', admin.dashboard)
router.get('/profile', admin.profile)
router.patch('/profile', admin.updateProfile)

// ── products (literals BEFORE /:id) ────────────────────────────────────────
router.get('/products/check-title', admin.checkTitle)
router.get('/products/form-data', admin.productFormData)
router.get('/products/sub-categories', admin.subCategoriesFor)
router.post('/products/bulk', validate(v.bulkProductSchema), admin.productBulk)

router.get('/products', admin.productIndex)
router.post(
  '/products',
  upload.fields([
    { name: 'featured_image', maxCount: 1 },
    { name: 'featured_image_2', maxCount: 1 },
    { name: 'size_guide_image', maxCount: 1 },
    { name: 'highlights_image', maxCount: 1 },
    { name: 'gallery', maxCount: 20 },
  ]),
  validate(v.productSchema),
  admin.productStore,
)
router.get('/products/:id', admin.productShow)
router.patch(
  '/products/:id',
  upload.fields([
    { name: 'featured_image', maxCount: 1 },
    { name: 'featured_image_2', maxCount: 1 },
    { name: 'size_guide_image', maxCount: 1 },
    { name: 'highlights_image', maxCount: 1 },
    { name: 'gallery', maxCount: 20 },
  ]),
  validate(v.productSchema),
  admin.productUpdate,
)
router.delete('/products/:id', admin.productDestroy)
router.patch('/products/:id/toggle', admin.productToggle)
router.patch('/products/:id/featured', admin.productToggleFeatured)

router.get('/products/:id/reviews', admin.reviewIndex)
router.post('/products/:id/reviews', validate(v.adminReviewSchema), admin.reviewStore)
router.patch('/products/:id/reviews/:reviewId/toggle', admin.reviewToggle)
router.delete('/products/:id/reviews/:reviewId', admin.reviewDestroy)

// ── simple taxonomies via the shared factory ───────────────────────────────
const resources = [
  ['categories', catalogAdmin.categories, 'Category', v.categorySchema, 'image'],
  ['sub-categories', catalogAdmin.subCategories, 'Sub-category', v.subCategorySchema, 'image'],
  ['brands', catalogAdmin.brands, 'Brand', v.brandSchema, 'image'],
  ['colors', catalogAdmin.colors, 'Color', v.colorSchema, null],
  ['sizes', catalogAdmin.sizes, 'Size', v.sizeSchema, null],
  ['offers', catalogAdmin.offers, 'Offer', v.offerSchema, 'image'],
  ['news-types', catalogAdmin.newsTypes, 'News type', v.newsTypeSchema, null],
  ['blog-posts', catalogAdmin.blogPosts, 'Blog post', v.blogPostSchema, 'image'],
]

for (const [path, service, label, schema, imageField] of resources) {
  const controller = createResourceController(service, label, { imageField })
  const withUpload = imageField ? [upload.single(imageField)] : []

  router.get(`/${path}`, controller.index)
  router.post(`/${path}`, ...withUpload, validate(schema), controller.store)
  router.get(`/${path}/:id`, controller.show)
  router.patch(`/${path}/:id`, ...withUpload, validate(schema), controller.update)
  router.delete(`/${path}/:id`, controller.destroy)
  router.patch(`/${path}/:id/toggle`, controller.toggle)
}

// Blog posts additionally have a featured toggle.
router.patch('/blog-posts/:id/featured', async (req, res, next) => {
  try {
    const post = await catalogAdmin.blogPosts.find(req.params.id)
    const updated = await catalogAdmin.blogPosts.update(req.params.id, {
      isFeatured: !post.isFeatured,
    })
    res.json({ success: true, data: { isFeatured: updated.isFeatured }, message: 'Updated.' })
  } catch (error) {
    next(error)
  }
})

// ── orders (literals BEFORE /:id) ──────────────────────────────────────────
router.get('/orders/statuses', admin.orderStatuses)
router.post('/orders/bulk', validate(v.bulkOrderSchema), admin.orderBulk)

router.get('/orders', admin.orderIndex)
router.get('/orders/:id', admin.orderShow)
router.get('/orders/:id/print', admin.orderPrint)
router.get('/orders/:id/status-data', admin.orderStatusData)
router.patch('/orders/:id/status', validate(v.orderStatusSchema), admin.orderUpdateStatus)
router.patch(
  '/orders/:id/delivery-date',
  validate(v.deliveryDateSchema),
  admin.orderUpdateDeliveryDate,
)
router.delete('/orders/:id/status-logs/:logId', admin.orderDeleteStatusLog)
router.delete('/orders/:id', admin.orderDestroy)

// ── users ──────────────────────────────────────────────────────────────────
router.post('/users/bulk', validate(v.bulkUserSchema), admin.userBulk)
router.get('/users', admin.userIndex)
router.post('/users', validate(v.adminUserCreateSchema), admin.userStore)
router.get('/users/:id', admin.userShow)
router.patch('/users/:id', validate(v.adminUserUpdateSchema), admin.userUpdate)
router.delete('/users/:id', admin.userDestroy)
router.patch('/users/:id/toggle', admin.userToggle)

// ── banners & home sections ────────────────────────────────────────────────
const bannerUpload = upload.fields([{ name: 'images', maxCount: 20 }])

router.get('/banners', admin.bannerIndex)
router.post('/banners', bannerUpload, validate(v.bannerSchema), admin.bannerStore)
router.get('/banners/:id', admin.bannerShow)
// POST as well as PATCH: Laravel registered update as POST because Hostinger's
// ModSecurity blocks PUT and returns 500. Both are accepted.
router.post('/banners/:id', bannerUpload, validate(v.bannerSchema), admin.bannerUpdate)
router.patch('/banners/:id', bannerUpload, validate(v.bannerSchema), admin.bannerUpdate)
router.delete('/banners/:id', admin.bannerDestroy)
router.patch('/banners/:id/toggle', admin.bannerToggle)

router.get('/home-sections', admin.homeSectionShow)
router.post('/home-sections', validate(v.homeSectionSchema), admin.homeSectionUpdate)

// ── coupons ────────────────────────────────────────────────────────────────
router.get('/coupons', admin.couponIndex)
router.post('/coupons', upload.single('image'), validate(v.couponSchema), admin.couponStore)
router.get('/coupons/:id', admin.couponShow)
router.patch('/coupons/:id', upload.single('image'), validate(v.couponSchema), admin.couponUpdate)
router.delete('/coupons/:id', admin.couponDestroy)
router.patch('/coupons/:id/toggle', admin.couponToggle)

// ── contacts ───────────────────────────────────────────────────────────────
router.get('/contacts', admin.contactIndex)
router.post('/contacts/subscribers/bulk', validate(v.bulkIdsSchema), admin.subscriberBulk)
router.delete('/contacts/subscribers/:id', admin.subscriberDestroy)
router.post('/contacts/messages/bulk', validate(v.bulkIdsSchema), admin.messageBulk)
router.delete('/contacts/messages/:id', admin.messageDestroy)

// ── settings ───────────────────────────────────────────────────────────────
router.get('/settings/pages', admin.pageSettingsIndex)
router.put('/settings/pages/:slug', validate(v.pageSettingSchema), admin.pageSettingsUpdate)
router.patch('/settings/pages/:slug', validate(v.pageSettingSchema), admin.pageSettingsUpdate)
router.get('/settings/shipping', admin.shippingSettingsShow)
router.put('/settings/shipping', validate(v.shippingSettingSchema), admin.shippingSettingsUpdate)
router.patch('/settings/shipping', validate(v.shippingSettingSchema), admin.shippingSettingsUpdate)

export default router
