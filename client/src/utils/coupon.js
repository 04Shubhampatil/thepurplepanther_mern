import { storageUrl } from './admin-media.js'

/**
 * App\Models\Coupon's accessors.
 *
 * The admin API returns raw rows, so `discount_label`, `offer_type_label` and `image_url`
 * have to be computed here — the coupon card shows nothing BUT the label, so getting this
 * wrong is not subtle.
 */

/** `Coupon::OFFER_TYPES`, verbatim. */
export const OFFER_TYPES = Object.freeze({
  coupon: 'Coupon code',
  percent: 'Percentage discount',
  flat: 'Flat discount',
  new_customer: 'New customer offer',
  free_shipping: 'Free shipping',
  quantity: 'Quantity discount',
  cart_value: 'Cart value discount',
  category: 'Category discount',
  product: 'Product-specific discount',
  seasonal: 'Seasonal / festival sale',
  flash: 'Flash sale',
  prepaid: 'Prepaid order discount',
  member: 'Member-exclusive offer',
  bogo: 'Buy X, Get Y Free',
})

/**
 * `number_format($v, 2)` with trailing zeros and any trailing point stripped, so 10.00
 * prints as "10" and 12.50 as "12.5" — the label reads as an amount, not a ledger entry.
 */
function trimDecimals(value) {
  return Number(value ?? 0)
    .toFixed(2)
    .replace(/0+$/, '')
    .replace(/\.$/, '')
}

/**
 * `getDiscountLabelAttribute` — the card's headline, and the order of these branches is the
 * behaviour. BOGO wins outright; free shipping only counts when there is no discount figure
 * to show instead; and the amount/percent split is on `discount_type`, not on which column
 * happens to be filled.
 */
export function discountLabel(coupon) {
  if (!coupon) return ''

  if (coupon.offerType === 'bogo') {
    const buy = Number(coupon.bogoBuyQuantity) || 1
    const get = Number(coupon.bogoGetQuantity) || 1
    return `Buy ${buy}, get ${get} free`
  }

  if (coupon.freeShipping && !Number(coupon.discountPercent) && !Number(coupon.discountAmount)) {
    return 'Free shipping'
  }

  if (coupon.discountType === 'amount') {
    return `Discount: ₹ ${trimDecimals(coupon.discountAmount)}`
  }

  return `Discount: ${trimDecimals(coupon.discountPercent)}%`
}

/** `getOfferTypeLabelAttribute` — falls back to the raw key with its first letter raised. */
export function offerTypeLabel(coupon) {
  const key = coupon?.offerType ?? ''
  return OFFER_TYPES[key] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : '')
}

/**
 * `getImageUrlAttribute`. The fallback is that exact Unsplash URL in the model — the coupon
 * cards are the one admin surface that reaches outside for its art, which is why the cards
 * are dark rather than blank when no image is set.
 */
export const COUPON_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80'

export function couponImageUrl(coupon) {
  return storageUrl(coupon?.image, COUPON_FALLBACK_IMAGE)
}
