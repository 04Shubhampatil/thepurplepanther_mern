/**
 * Image helpers for the admin listings.
 *
 * The admin endpoints return RAW Prisma rows, not presented ones — the storefront's
 * presenters resolve media URLs, the admin CRUD factory does not. So every admin card holds
 * a storage path like `products/abc.jpg` and has to resolve it the way Blade did with
 * `asset('storage/'.$path)`.
 *
 * Reading the wrong field is silent rather than loud: the card falls back to the
 * placeholder and looks plausible, so it is worth knowing that the column names differ per
 * model. Category, SubCategory and Offer store `image`; Product stores `featuredImage`.
 */
export function storageUrl(path, fallback = '') {
  if (!path) return fallback

  const value = String(path)
  if (value.startsWith('http://') || value.startsWith('https://')) return value

  return `/storage/${value.replace(/^\/+/, '')}`
}

/**
 * Product::getDiscountPercentAttribute.
 *
 * The OFFER's percent wins when a product has one; only without an offer is the figure
 * derived from mrp and selling price. Computing it from the prices alone under-reports any
 * product whose discount comes from an offer, which is most of them.
 */
export function discountPercent(product) {
  if (product?.offer) return Number(product.offer.discountPercent) || 0

  const mrp = Number(product?.mrp) || 0
  const price = Number(product?.sellingPrice) || 0

  if (mrp > 0 && price > 0 && price < mrp) return Math.round(((mrp - price) / mrp) * 100)

  return 0
}

/**
 * BannerImage::getIsVideoAttribute — decided by file extension, not by a column.
 *
 * Another accessor the admin's raw rows do not carry. Without it the Banners grid treats a
 * video placement as an image and paints its poster-less first frame as a background, which
 * renders as a black card.
 */
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogg', 'ogv', 'mov'])

export function isVideoPath(path) {
  return VIDEO_EXTENSIONS.has(String(path ?? '').split('.').pop().toLowerCase())
}
