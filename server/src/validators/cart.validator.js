import { z } from 'zod'

/**
 * Cart validation. Field names and limits mirror CartController's rules, including the
 * snake_case body keys the storefront already sends.
 *
 * Note what is deliberately ABSENT: price, discount and total. The client never submits an
 * amount, so there is nothing to tamper with — every figure is derived server-side.
 */

const productId = z.coerce
  .number({ error: 'Please choose a product.' })
  .int('Please choose a product.')
  .positive('Please choose a product.')

// max:80 / max:40 / max:50 match the cart_items column widths.
const color = z.string().max(80).nullish()
const size = z.string().max(40).nullish()
const packageKey = z.string().max(50).nullish()

export const addToCartSchema = z.object({
  product_id: productId,
  quantity: z.coerce.number().int().min(1).max(99).optional().default(1),
  color,
  size,
  package_key: packageKey,
})

export const updateCartSchema = z.object({
  // 0 is valid and means "remove", matching CartService::update.
  quantity: z.coerce
    .number({ error: 'Please enter a quantity.' })
    .int('Please enter a whole number.')
    .min(0)
    .max(99),
  color,
  size,
  package_key: packageKey,
})

export const removeCartSchema = z.object({
  color,
  size,
  package_key: packageKey,
})

export const applyCouponSchema = z.object({
  code: z
    .string({ error: 'Please enter a coupon code.' })
    .trim()
    .min(1, 'Please enter a coupon code.')
    .max(50),
})

export default { addToCartSchema, updateCartSchema, removeCartSchema, applyCouponSchema }
