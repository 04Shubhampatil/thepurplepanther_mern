import { productImageUrl, mediaUrl, highlightIconUrl } from './media.js'
import { format, toNumber, discountPercent } from './money.js'
import { parseJsonArray } from './json.js'

/**
 * Shapes Prisma rows into the payloads React consumes.
 *
 * This is where Laravel's model ACCESSORS live now — `featured_image_url`,
 * `hover_image_url`, `formatted_price`, `discount_percent` and the accessory-package
 * normaliser were computed properties on the Eloquent models, so they have to be produced
 * explicitly here or the UI silently loses them.
 *
 * Money is emitted twice on purpose: a raw number for logic and a pre-formatted string
 * for display. The formatted value is authoritative, so React never re-implements
 * "₹ 1,234.56" and can never drift from the server.
 */

/** Product::getFeaturedImageUrlAttribute */
export const featuredImageUrl = (product) => productImageUrl(product.featuredImage)

/** Product::getHoverImageUrlAttribute — falls back to the featured image. */
export const hoverImageUrl = (product) =>
  product.featuredImage2 ? productImageUrl(product.featuredImage2) : featuredImageUrl(product)

/**
 * Product::getDiscountPercentAttribute — an attached offer WINS over the computed
 * mrp/selling_price difference, even when the offer's percent is lower.
 */
export function productDiscountPercent(product) {
  if (product.offer) return Number(product.offer.discountPercent ?? 0)
  return discountPercent(product.mrp, product.sellingPrice)
}

/** Product::getFormattedPriceAttribute — selling price when set, else MRP. */
export function currentPrice(product) {
  const selling = toNumber(product.sellingPrice)
  return selling > 0 ? selling : toNumber(product.mrp)
}

/**
 * Product::accessoryPackages() — drops entries without a label or price, defaults the key
 * to "package-N", and defaults mrp to price.
 *
 * Server-authoritative: the cart re-resolves the price from here and never trusts a
 * browser-supplied amount.
 */
export function accessoryPackages(product) {
  return parseJsonArray(product.accessoryPackages)
    .filter((p) => p?.label != null && p.label !== '' && p.price !== undefined && p.price !== '')
    .map((p, index) => ({
      key: String(p.key ?? `package-${index + 1}`),
      label: String(p.label),
      mrp: toNumber(p.mrp ?? p.price),
      price: toNumber(p.price),
    }))
}

/** Colour/size pivots carry `quantity`, which is the per-variant stock. */
const presentColors = (product) =>
  (product.colors ?? []).map((pc) => ({
    id: pc.color?.id ?? pc.colorId,
    name: pc.color?.name ?? null,
    code: pc.color?.code ?? null,
    quantity: pc.quantity ?? 0,
  }))

const presentSizes = (product) =>
  (product.sizes ?? []).map((ps) => ({
    id: ps.size?.id ?? ps.sizeId,
    name: ps.size?.name ?? null,
    quantity: ps.quantity ?? 0,
  }))

/**
 * Card shape — product grids, search results, related products.
 * Deliberately small: listing pages render up to 50 of these.
 */
export function presentProductCard(product) {
  const price = currentPrice(product)
  const mrp = toNumber(product.mrp)

  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    url: `/product/${product.slug}`,
    image: featuredImageUrl(product),
    hoverImage: hoverImageUrl(product),
    price,
    priceFormatted: format(price),
    mrp,
    mrpFormatted: format(mrp),
    hasSellingPrice: toNumber(product.sellingPrice) > 0,
    discountPercent: productDiscountPercent(product),
    isNewArrival: product.isNewArrival ?? false,
    isFeatured: product.isFeatured ?? false,
    isTodaysDeal: product.isTodaysDeal ?? false,
    category: product.category
      ? { id: product.category.id, title: product.category.title, slug: product.category.slug }
      : null,
    colors: presentColors(product),
    sizes: presentSizes(product),
  }
}

/**
 * Gallery assembly — port of the block at the top of FrontendController::shopSingle.
 *
 * 1. featured image, then the hover image when featured_image_2 is set
 * 2. then every product image with NO colour attached
 * 3. pad with the featured image until there are at least 4 (the theme's slider needs 4)
 * 4. cap at 8
 * 5. if the FIRST colour has its own gallery, that replaces the whole gallery
 *
 * Step 5 is easy to miss and visible immediately: without it, a product whose images are
 * all colour-tagged shows four copies of the featured image.
 */
export function buildGallery(product) {
  const images = product.images ?? []

  const colourGalleries = {}
  for (const image of images) {
    if (!image.colorId || !image.color?.name) continue
    const key = String(image.color.name).toUpperCase()
    ;(colourGalleries[key] ??= []).push(mediaUrl(image.image))
  }

  let gallery = [featuredImageUrl(product)]
  if (product.featuredImage2) gallery.push(hoverImageUrl(product))
  for (const image of images.filter((i) => !i.colorId)) gallery.push(mediaUrl(image.image))

  const firstColour = String(product.colors?.[0]?.color?.name ?? '').toUpperCase()
  if (firstColour && colourGalleries[firstColour]?.length) {
    gallery = [...colourGalleries[firstColour]]
    while (gallery.length < 4) gallery.push(gallery[0])
  } else {
    while (gallery.length < 4) gallery.push(featuredImageUrl(product))
  }

  return { gallery: gallery.slice(0, 8), colourGalleries }
}

/**
 * Review aggregates — average to 1dp and a 5→1 star breakdown with percentages.
 * Only active reviews are counted; the caller must filter.
 */
export function summariseReviews(reviews = []) {
  const count = reviews.length
  const average = count
    ? Math.round((reviews.reduce((sum, r) => sum + Number(r.rating ?? 0), 0) / count) * 10) / 10
    : 0

  const breakdown = {}
  for (let star = 5; star >= 1; star -= 1) {
    const starCount = reviews.filter((r) => Number(r.rating) === star).length
    breakdown[star] = {
      count: starCount,
      percent: count ? Math.round((starCount / count) * 100) : 0,
    }
  }

  return { count, average, breakdown }
}

/** Full product detail payload. */
export function presentProductDetail(product) {
  const { gallery, colourGalleries } = buildGallery(product)
  const activeReviews = (product.reviews ?? []).filter((r) => r.isActive)
  const price = currentPrice(product)
  const mrp = toNumber(product.mrp)

  return {
    ...presentProductCard(product),

    shortDescription: product.shortDescription,
    features: product.features,

    saving: Math.max(0, mrp - price),
    savingFormatted: format(Math.max(0, mrp - price)),
    maxUnitBuy: product.maxUnitBuy ?? 1,
    deliveryCharge: toNumber(product.deliveryCharge),

    gallery,
    colourGalleries,

    subCategory: product.subCategory
      ? { id: product.subCategory.id, title: product.subCategory.title, slug: product.subCategory.slug }
      : null,
    brand: product.brand ? { id: product.brand.id, name: product.brand.name } : null,
    offer: product.offer
      ? { id: product.offer.id, title: product.offer.title, discountPercent: product.offer.discountPercent }
      : null,

    showSizeGuide: product.showSizeGuide ?? false,
    sizeGuideContent: product.sizeGuideContent,
    sizeGuideImage: product.sizeGuideImage ? mediaUrl(product.sizeGuideImage) : null,

    highlights: {
      image: product.highlightsImage ? mediaUrl(product.highlightsImage) : featuredImageUrl(product),
      shortDescription: product.highlightsShortDescription,
      items: parseJsonArray(product.highlightsItems).map((item) => ({
        ...item,
        icon: highlightIconUrl(item?.icon),
      })),
    },
    informationItems: parseJsonArray(product.informationItems),
    specifications: parseJsonArray(product.specifications),
    accessoryPackages: accessoryPackages(product),

    seo: {
      title: product.seoTitle || product.title,
      description: product.metaDescription,
      keywords: product.metaKeywords,
    },

    reviews: {
      ...summariseReviews(activeReviews),
      items: activeReviews.map((review) => ({
        id: review.id,
        reviewerName: review.reviewerName,
        rating: review.rating,
        comment: review.comment,
        image: review.image ? mediaUrl(review.image) : null,
        createdAt: review.createdAt,
      })),
    },
  }
}

export default {
  presentProductCard,
  presentProductDetail,
  buildGallery,
  summariseReviews,
  accessoryPackages,
  currentPrice,
  productDiscountPercent,
  featuredImageUrl,
  hoverImageUrl,
}
