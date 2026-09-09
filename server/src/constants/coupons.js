/**
 * `App\Models\Coupon::OFFER_TYPES`, verbatim.
 *
 * The keys are validated against on every write and the labels fill the admin form's
 * dropdown, so both halves matter. The storefront's discount engine only branches on
 * `bogo` and `free_shipping`; the rest are descriptive, which is exactly why an enum
 * narrowed to the two the engine knows about silently rejected the other eleven.
 */
export const COUPON_OFFER_TYPE_LABELS = Object.freeze({
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

export const COUPON_OFFER_TYPES = Object.freeze(Object.keys(COUPON_OFFER_TYPE_LABELS))

export default COUPON_OFFER_TYPE_LABELS
