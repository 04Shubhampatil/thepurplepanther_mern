import { get, post, patch, put, del, toFormData } from './api.js'

/**
 * Every API call in one place.
 *
 * Components never build URLs. That keeps the route surface reviewable against
 * docs/api.md, and means a backend path change is a one-line edit here.
 */

// ── auth ───────────────────────────────────────────────────────────────────
export const auth = {
  me: () => get('/auth/me'),
  login: (body) => post('/auth/login', body),
  register: (body) => post('/auth/register', body),
  logout: () => post('/auth/logout'),
  checkEmail: (email) => post('/auth/check-email', { email }),
  forgotPassword: (email) => post('/auth/forgot-password', { email }),
  resetPassword: (body) => post('/auth/reset-password', body),
}

export const adminAuth = {
  login: (body) => post('/admin/auth/login', body),
  logout: () => post('/admin/auth/logout'),
  me: () => get('/admin/auth/me'),
}

// ── catalog ────────────────────────────────────────────────────────────────
export const catalog = {
  home: () => get('/home'),
  products: (params) => get('/products', { params }),
  product: (slug, params) => get(`/products/${slug}`, { params }),
  search: (q, limit = 8) => get('/search', { params: { q, limit } }),
  categories: () => get('/categories'),
  subCategories: (categoryId) => get('/sub-categories', { params: { category_id: categoryId } }),
  brands: () => get('/brands'),
  colors: () => get('/colors'),
  sizes: () => get('/sizes'),
  submitReview: (slug, body) => post(`/products/${slug}/reviews`, body),
}

// ── cms ────────────────────────────────────────────────────────────────────
export const cms = {
  blog: (params) => get('/blog', { params }),
  post: (slug) => get(`/blog/${slug}`),
  newsTypes: () => get('/news-types'),
  banners: (sections) => get('/banners', { params: { sections: sections?.join(',') } }),
  pages: () => get('/pages'),
  page: (slug) => get(`/pages/${slug}`),
  supportPages: () => get('/pages/support'),
  supportPage: (slug) => get(`/pages/support/${slug}`),
}

// ── cart ───────────────────────────────────────────────────────────────────
export const cart = {
  get: () => get('/cart'),
  add: (body) => post('/cart/items', body),
  update: (productId, body) => patch(`/cart/items/${productId}`, body),
  remove: (productId, body) => del(`/cart/items/${productId}`, { data: body }),
  buyNow: (body) => post('/cart/buy-now', body),
  applyCoupon: (code) => post('/cart/coupon', { code }),
  removeCoupon: () => del('/cart/coupon'),
  publicCoupons: () => get('/cart/coupons'),
  recommendations: () => get('/cart/recommendations'),
}

// ── account ────────────────────────────────────────────────────────────────
export const account = {
  page: (page = 'overview') => get(`/account/${page}`),
  updateProfile: (body) => patch('/account/profile', body),
  addresses: () => get('/account/addresses'),
  createAddress: (body) => post('/account/addresses', body),
  updateAddress: (id, body) => patch(`/account/addresses/${id}`, body),
  deleteAddress: (id) => del(`/account/addresses/${id}`),
  setDefaultAddress: (id) => post(`/account/addresses/${id}/default`),
  wishlist: () => get('/account/wishlist'),
  addToWishlist: (productId) => post('/account/wishlist', { product_id: productId }),
  removeWishlistItem: (id) => del(`/account/wishlist/${id}`),
  removeWishlistProduct: (productId) => del(`/account/wishlist/product/${productId}`),
  reviews: () => get('/account/reviews'),
  deleteReview: (id) => del(`/account/reviews/${id}`),
  orders: () => get('/account/orders'),
}

// ── checkout ───────────────────────────────────────────────────────────────
export const checkout = {
  context: () => get('/checkout'),
  place: (body) => post('/checkout/place', body),
  verify: (body) => post('/checkout/verify', body),
  order: (orderNumber) => get(`/orders/${orderNumber}`),
}

// ── misc ───────────────────────────────────────────────────────────────────
export const misc = {
  config: () => get('/config'),
  health: () => get('/health'),
  newsletterCheck: (email) => post('/newsletter/check', { email }),
  subscribe: (email) => post('/newsletter/subscribe', { email }),
  contact: (body) => post('/contact', body),
}

// ── admin ──────────────────────────────────────────────────────────────────

/** Simple resources all share the same shape, so their clients are generated. */
const resource = (path) => ({
  list: (params) => get(`/admin/${path}`, { params }),
  show: (id) => get(`/admin/${path}/${id}`),
  create: (body, files) =>
    files
      ? post(`/admin/${path}`, toFormData(body, files))
      : post(`/admin/${path}`, body),
  update: (id, body, files) =>
    files
      ? patch(`/admin/${path}/${id}`, toFormData(body, files))
      : patch(`/admin/${path}/${id}`, body),
  remove: (id) => del(`/admin/${path}/${id}`),
  toggle: (id) => patch(`/admin/${path}/${id}/toggle`),
})

export const admin = {
  dashboard: () => get('/admin/dashboard'),
  profile: () => get('/admin/profile'),
  updateProfile: (body) => patch('/admin/profile', body),

  categories: resource('categories'),
  subCategories: resource('sub-categories'),
  brands: resource('brands'),
  colors: resource('colors'),
  sizes: resource('sizes'),
  offers: resource('offers'),
  newsTypes: resource('news-types'),

  /*
   * Journal posts carry two uploads and filter by news type, so they need more than the
   * generated resource: `save` posts both files as multipart, and `toggleFeatured` hits the
   * separate endpoint behind the Featured column.
   */
  blogPosts: {
    ...resource('blog-posts'),
    save: (id, body, files) =>
      id
        ? patch(`/admin/blog-posts/${id}`, toFormData(body, files))
        : post('/admin/blog-posts', toFormData(body, files)),
    toggleFeatured: (id) => patch(`/admin/blog-posts/${id}/featured`),
  },
  /*
   * Coupons carry an image, so writes are multipart; `formData` fills the offer-type
   * dropdown and the category/product multi-selects from one call, as
   * CouponController::formData did.
   */
  coupons: {
    ...resource('coupons'),
    formData: () => get('/admin/coupons/form-data'),
    save: (id, body, files) =>
      id
        ? patch(`/admin/coupons/${id}`, toFormData(body, files))
        : post('/admin/coupons', toFormData(body, files)),
  },
  users: resource('users'),
  /*
   * Banners are multipart in both directions and update over POST.
   *
   * Laravel registered `admin.banners.update` as POST because Hostinger's ModSecurity
   * rejects PUT/PATCH with a 500, and the Express router keeps both. Going through POST
   * here means the panel behaves the same on that host as it does locally.
   */
  banners: {
    ...resource('banners'),
    save: (id, body, files) =>
      post(id ? `/admin/banners/${id}` : '/admin/banners', toFormData(body, files)),
  },

  products: {
    ...resource('products'),
    formData: () => get('/admin/products/form-data'),
    checkTitle: (title, ignoreId) =>
      get('/admin/products/check-title', { params: { title, ignore_id: ignoreId } }),
    subCategories: (categoryId) =>
      get('/admin/products/sub-categories', { params: { category_id: categoryId } }),
    bulk: (action, ids) => post('/admin/products/bulk', { action, ids }),
    toggleFeatured: (id) => patch(`/admin/products/${id}/featured`),
    reviews: (id, params) => get(`/admin/products/${id}/reviews`, { params }),
    addReview: (id, body) => post(`/admin/products/${id}/reviews`, body),
    toggleReview: (id, reviewId) => patch(`/admin/products/${id}/reviews/${reviewId}/toggle`),
    deleteReview: (id, reviewId) => del(`/admin/products/${id}/reviews/${reviewId}`),
  },

  orders: {
    list: (params) => get('/admin/orders', { params }),
    show: (id) => get(`/admin/orders/${id}`),
    print: (id) => get(`/admin/orders/${id}/print`),
    statuses: () => get('/admin/orders/statuses'),
    statusData: (id) => get(`/admin/orders/${id}/status-data`),
    updateStatus: (id, body) => patch(`/admin/orders/${id}/status`, body),
    updateDeliveryDate: (id, date) =>
      patch(`/admin/orders/${id}/delivery-date`, { expected_delivery_date: date }),
    deleteStatusLog: (id, logId) => del(`/admin/orders/${id}/status-logs/${logId}`),
    remove: (id) => del(`/admin/orders/${id}`),
    bulk: (action, ids) => post('/admin/orders/bulk', { action, ids }),
  },

  usersBulk: (action, ids) => post('/admin/users/bulk', { action, ids }),
  userDetail: (id, params) => get(`/admin/users/${id}/detail`, { params }),

  homeSections: {
    get: (section) => get('/admin/home-sections', { params: { section } }),
    update: (section, productIds) =>
      post('/admin/home-sections', { section, product_ids: productIds }),
  },

  contacts: {
    list: (params) => get('/admin/contacts', { params }),
    deleteSubscriber: (id) => del(`/admin/contacts/subscribers/${id}`),
    bulkSubscribers: (ids) => post('/admin/contacts/subscribers/bulk', { ids }),
    deleteMessage: (id) => del(`/admin/contacts/messages/${id}`),
    bulkMessages: (ids) => post('/admin/contacts/messages/bulk', { ids }),
  },

  settings: {
    pages: () => get('/admin/settings/pages'),
    updatePage: (slug, body) => put(`/admin/settings/pages/${slug}`, body),
    shipping: () => get('/admin/settings/shipping'),
    updateShipping: (body) => put('/admin/settings/shipping', body),
  },
}

export default { auth, adminAuth, catalog, cms, cart, account, checkout, misc, admin }
