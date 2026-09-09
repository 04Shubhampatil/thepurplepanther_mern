import { z } from 'zod'
import { BANNER_SECTION_KEYS } from '../constants/cms.js'
import { STATUS_KEYS } from '../constants/order-statuses.js'
import { ROLES } from '../constants/roles.js'

/**
 * Admin validation.
 *
 * Multipart bodies arrive as strings, so booleans, numbers and JSON arrays are coerced
 * here rather than in the services. Every write endpoint is validated — an authenticated
 * admin is still untrusted input.
 */

const str = (max, message) =>
  z.string({ error: message }).trim().min(1, message).max(max)

const optStr = (max) =>
  z.string().max(max).nullish().transform((v) => (v == null || v === '' ? null : String(v).trim()))

/** "1" / "true" / "on" -> true. Multipart sends strings. */
const bool = z
  .union([z.boolean(), z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === '') return undefined
    if (typeof v === 'boolean') return v
    return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase())
  })

const num = z.coerce.number().nullish().transform((v) => (v === null || Number.isNaN(v) ? null : v))
const int0 = z.coerce.number().int().min(0).optional()

/** A JSON array that may arrive as a real array or an encoded string. */
const jsonArray = z
  .union([z.array(z.any()), z.string()])
  .nullish()
  .transform((v) => {
    if (v == null || v === '') return null
    if (Array.isArray(v)) return v
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  })

/** A JSON object that may arrive as a real object or an encoded string. */
const jsonObject = z
  .union([z.record(z.string(), z.any()), z.string()])
  .nullish()
  .transform((v) => {
    if (v == null || v === '') return {}
    if (typeof v === 'object') return v
    try {
      const parsed = JSON.parse(v)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  })

const idList = z
  .union([z.array(z.union([z.string(), z.number()])), z.string()])
  .transform((v) => (Array.isArray(v) ? v : String(v).split(',')))
  .pipe(z.array(z.coerce.number().int().positive()).min(1, 'Select at least one item.'))

// ── simple resources ───────────────────────────────────────────────────────

export const categorySchema = z.object({
  title: str(255, 'Please enter a title.'),
  slug: optStr(255),
  short_description: optStr(255),
  has_color: bool,
  has_size: bool,
  show_on_home: bool,
  is_active: bool,
  sort_order: int0,
})

export const subCategorySchema = z.object({
  category_id: z.coerce.number({ error: 'Please choose a category.' }).int().positive(),
  title: str(255, 'Please enter a title.'),
  slug: optStr(255),
  is_active: bool,
  sort_order: int0,
})

export const brandSchema = z.object({
  name: str(255, 'Please enter a name.'),
  slug: optStr(255),
  is_active: bool,
  sort_order: int0,
})

export const colorSchema = z.object({
  name: str(255, 'Please enter a name.'),
  code: optStr(20),
  is_active: bool,
  sort_order: int0,
})

export const sizeSchema = z.object({
  name: str(255, 'Please enter a name.'),
  is_active: bool,
  sort_order: int0,
})

export const offerSchema = z.object({
  title: str(255, 'Please enter a title.'),
  slug: optStr(255),
  description: optStr(5000),
  discount_percent: z.coerce.number().int().min(0).max(100).optional(),
  is_active: bool,
  sort_order: int0,
})

export const newsTypeSchema = z.object({
  title: str(255, 'Please enter a title.'),
  slug: optStr(255),
  is_active: bool,
  sort_order: int0,
})

export const blogPostSchema = z.object({
  title: str(255, 'Please enter a title.'),
  slug: optStr(255),
  // Required, as in BlogPostController — a post with no type disappears from the journal's
  // type filter and from the storefront's category strip.
  news_type_id: z.coerce.number({ error: 'Please choose a news type.' }).int().positive(),
  // Laravel defaulted the author to 'Admin' on save rather than leaving it null.
  author_name: optStr(255).transform((v) => v || 'Admin'),
  excerpt: optStr(2000),
  content: str(16777215, 'Please write the post content.'),
  comments_count: int0,
  is_featured: bool,
  is_active: bool,
  sort_order: int0,
  /*
   * `datetime-local` sends "2026-08-09T20:27" — a string Prisma will not accept for a
   * DateTime column, and a WALL CLOCK with no zone attached.
   *
   * `new Date("2026-08-09T20:27")` reads it as LOCAL time, and Prisma then writes the UTC
   * equivalent, so on an Asia/Kolkata server every save would walk the stored value back by
   * 5h30m. Laravel wrote the digits the admin typed straight into the column, so the 'Z' is
   * appended to keep them: the column ends up holding exactly what the field showed, which
   * is what utils/admin-date.js reads back out.
   */
  published_at: z
    .string()
    .nullish()
    .transform((v) => {
      if (v == null || v === '') return null
      const wallClock = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v)
      return new Date(wallClock ? `${v}${v.length === 16 ? ':00' : ''}Z` : v)
    })
    .refine((v) => v === null || !Number.isNaN(v.getTime()), 'Please enter a valid date.'),
})

// ── products ───────────────────────────────────────────────────────────────

/** Colour/size pivots with their per-variant stock. */
const variantList = z
  .union([z.array(z.any()), z.string()])
  .nullish()
  .transform((v) => {
    if (v == null || v === '') return undefined
    let raw = v
    if (typeof v === 'string') {
      try {
        raw = JSON.parse(v)
      } catch {
        return undefined
      }
    }
    if (!Array.isArray(raw)) return undefined
    return raw
      .filter((e) => e && e.id !== undefined && e.id !== null && e.id !== '')
      .map((e) => ({ id: Number(e.id), quantity: Math.max(0, Number(e.quantity ?? 0)) }))
  })

export const productSchema = z.object({
  title: str(255, 'Please enter a product title.'),
  slug: optStr(255),
  category_id: z.coerce.number({ error: 'Please choose a category.' }).int().positive(),
  sub_category_id: z.coerce.number().int().positive().nullish(),
  brand_id: z.coerce.number().int().positive().nullish(),
  offer_id: z.coerce.number().int().positive().nullish(),
  short_description: z.string().nullish(),
  features: z.string().nullish(),
  mrp: z.coerce.number({ error: 'Please enter an MRP.' }).min(0),
  selling_price: z.coerce.number().min(0).optional(),
  max_unit_buy: z.coerce.number().int().min(1).optional(),
  delivery_charge: z.coerce.number().min(0).optional(),
  seo_title: optStr(255),
  meta_description: z.string().nullish(),
  meta_keywords: optStr(500),
  is_active: bool,
  is_featured: bool,
  is_todays_deal: bool,
  is_popular_accessory: bool,
  is_new_arrival: bool,
  show_size_guide: bool,
  size_guide_content: z.string().nullish(),
  highlights_short_description: z.string().nullish(),
  highlights_items: jsonArray,
  information_items: jsonArray,
  specifications: jsonArray,
  accessory_packages: jsonArray,
  colors: variantList,
  sizes: variantList,
  remove_gallery: z
    .union([z.array(z.union([z.string(), z.number()])), z.string()])
    .nullish()
    .transform((v) => {
      if (v == null || v === '') return []
      const arr = Array.isArray(v) ? v : String(v).split(',')
      return arr.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)
    }),
  sort_order: int0,
})

export const adminReviewSchema = z.object({
  reviewer_name: str(255, 'Please enter a name.'),
  reviewer_email: z.string().email('Please enter a valid email address.').max(255).nullish(),
  rating: z.coerce.number({ error: 'Please choose a rating.' }).int().min(1).max(5),
  comment: z.string().nullish(),
})

export const bulkProductSchema = z.object({
  action: z.enum(['enable', 'disable', 'set_todays_deal', 'remove_todays_deal', 'delete'], {
    error: 'Please choose an action.',
  }),
  ids: idList,
})

// ── orders ─────────────────────────────────────────────────────────────────

export const orderStatusSchema = z.object({
  status: z.enum(STATUS_KEYS, { error: 'Please choose a valid status.' }),
  title: optStr(255),
  description: optStr(2000),
})

export const deliveryDateSchema = z.object({
  expected_delivery_date: z
    .string()
    .nullish()
    .refine((v) => v == null || v === '' || !Number.isNaN(Date.parse(v)), 'Please enter a valid date.'),
})

export const bulkOrderSchema = z.object({
  action: z.string({ error: 'Please choose an action.' }).min(1),
  ids: idList,
})

// ── users ──────────────────────────────────────────────────────────────────

export const adminUserCreateSchema = z.object({
  name: str(255, 'Please enter a name.'),
  username: optStr(255),
  email: z
    .string({ error: 'Please enter a valid email address.' })
    .trim()
    .max(255)
    .email('Please enter a valid email address.'),
  phone: optStr(30),
  password: z
    .string({ error: 'Please enter a password.' })
    .min(6, 'Password must be at least 6 characters.'),
  role: z.enum([ROLES.ADMIN, ROLES.CUSTOMER]).optional(),
  is_active: bool,
})

export const adminUserUpdateSchema = adminUserCreateSchema.partial({ password: true }).extend({
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters.')
    .nullish()
    .transform((v) => (v === '' ? null : v)),
})

export const bulkUserSchema = z.object({
  action: z.enum(['enable', 'disable', 'delete'], { error: 'Please choose an action.' }),
  ids: idList,
})

// ── banners & home sections ────────────────────────────────────────────────

export const bannerSchema = z.object({
  title: str(255, 'Please enter a title.'),
  section: z.enum(BANNER_SECTION_KEYS, { error: 'Please choose a valid section.' }),
  subtitle: z.string().nullish(),
  description: z.string().nullish(),
  button_text: optStr(100),
  button_link: optStr(500),
  button_text_2: optStr(100),
  button_link_2: optStr(500),
  is_active: bool,
  sort_order: int0,

  /*
   * Per-slide metadata, exactly as BannerController handled it.
   *
   * The `image_*` arrays are POSITIONAL — index i describes the i-th newly uploaded file,
   * which is why they are arrays and not maps. The `existing_*` maps are keyed by
   * banner_images.id, because the admin edits slides that already have one.
   *
   * Both shapes reach us JSON-encoded: the form is multipart (it carries files), and
   * toFormData stringifies anything that is not a scalar.
   */
  image_titles: jsonArray,
  image_subtitles: jsonArray,
  image_button_texts: jsonArray,
  image_button_links: jsonArray,

  existing_titles: jsonObject,
  existing_subtitles: jsonObject,
  existing_button_texts: jsonObject,
  existing_button_links: jsonObject,
  existing_sort: jsonObject,

  /*
   * Previously this split the value on commas, which silently discarded every id once the
   * client started sending `JSON.stringify([1, 2])` — "[1" and "2]" are both NaN. Parsing
   * the JSON first fixes the removals; the comma form still works for hand-made requests.
   */
  remove_images: z
    .union([z.array(z.union([z.string(), z.number()])), z.string()])
    .nullish()
    .transform((v) => {
      if (v == null || v === '') return []
      let arr = v
      if (!Array.isArray(arr)) {
        try {
          const parsed = JSON.parse(arr)
          arr = Array.isArray(parsed) ? parsed : String(v).split(',')
        } catch {
          arr = String(v).split(',')
        }
      }
      return arr.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)
    }),
})

export const homeSectionSchema = z.object({
  section: z.string({ error: 'Please choose a section.' }).min(1).max(50),
  product_ids: z
    .union([z.array(z.union([z.string(), z.number()])), z.string()])
    .nullish()
    .transform((v) => {
      if (v == null || v === '') return []
      const arr = Array.isArray(v) ? v : String(v).split(',')
      return arr.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)
    }),
})

// ── coupons ────────────────────────────────────────────────────────────────

export const couponSchema = z
  .object({
    code: str(50, 'Please enter a coupon code.'),
    offer_type: z.enum(['coupon', 'bogo']).optional(),
    description: z.string().nullish(),
    discount_type: z.enum(['percent', 'amount']).optional(),
    discount_percent: num,
    discount_amount: num,
    max_discount_status: bool,
    max_discount_amount: num,
    min_cart_status: bool,
    min_cart_amount: num,
    applies_to: z.enum(['all', 'products', 'categories']).optional(),
    category_ids: jsonArray,
    product_ids: jsonArray,
    min_quantity: num,
    bogo_buy_quantity: num,
    bogo_get_quantity: num,
    new_customers_only: bool,
    members_only: bool,
    free_shipping: bool,
    prepaid_only: bool,
    starts_at: z.string().nullish(),
    ends_at: z.string().nullish(),
    usage_limit: num,
    max_use_per_user: bool,
    is_active: bool,
    is_public: bool,
  })
  // A coupon that can never produce a discount is a support ticket waiting to happen,
  // so it is rejected at the form rather than at the till.
  .refine(
    (d) =>
      d.offer_type === 'bogo' ||
      d.free_shipping ||
      (d.discount_type === 'amount' ? Number(d.discount_amount) > 0 : Number(d.discount_percent) > 0),
    { message: 'Enter a discount, or enable free shipping.', path: ['discount_percent'] },
  )
  .refine(
    (d) => d.offer_type !== 'bogo' || (Number(d.bogo_buy_quantity) > 0 && Number(d.bogo_get_quantity) > 0),
    { message: 'Buy and Get quantities are required for a BOGO offer.', path: ['bogo_buy_quantity'] },
  )
  .refine((d) => !d.starts_at || !d.ends_at || new Date(d.ends_at) > new Date(d.starts_at), {
    message: 'The end date must be after the start date.',
    path: ['ends_at'],
  })

// ── settings & bulk ────────────────────────────────────────────────────────

export const pageSettingSchema = z.object({
  title: optStr(255),
  content: z.string().nullish(),
  is_active: bool,
})

export const shippingSettingSchema = z.object({
  free_shipping_threshold: z.coerce
    .number({ error: 'Please enter a threshold.' })
    .min(0, 'The threshold cannot be negative.'),
  flat_shipping_rate: z.coerce
    .number({ error: 'Please enter a shipping rate.' })
    .min(0, 'The rate cannot be negative.'),
})

export const bulkIdsSchema = z.object({ ids: idList })

export default {
  categorySchema,
  subCategorySchema,
  brandSchema,
  colorSchema,
  sizeSchema,
  offerSchema,
  newsTypeSchema,
  blogPostSchema,
  productSchema,
  adminReviewSchema,
  bulkProductSchema,
  orderStatusSchema,
  deliveryDateSchema,
  bulkOrderSchema,
  adminUserCreateSchema,
  adminUserUpdateSchema,
  bulkUserSchema,
  bannerSchema,
  homeSectionSchema,
  couponSchema,
  pageSettingSchema,
  shippingSettingSchema,
  bulkIdsSchema,
}
