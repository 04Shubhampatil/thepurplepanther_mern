import { Prisma } from '@prisma/client'

/**
 * Money handling, ported from App\Support\Money and the rounding behaviour of
 * PromotionService / CartService.
 *
 * Prisma returns Decimal objects for decimal columns; JS numbers lose precision. Every
 * amount entering business logic goes through toNumber(), and every amount written back
 * goes through toDecimal().
 */

/** Prisma Decimal | string | number | null -> number */
export function toNumber(value) {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value) || 0
  if (typeof value?.toNumber === 'function') return value.toNumber()
  return Number(value) || 0
}

/** number -> Prisma Decimal, rounded to 2dp for storage in decimal(x,2) columns */
export function toDecimal(value) {
  return new Prisma.Decimal(round2(value).toFixed(2))
}

/**
 * PHP's round($x, 2) is half-away-from-zero. JS Math.round is half-up, which differs for
 * negatives, and naive `Math.round(x * 100) / 100` misrounds cases like 1.005 because of
 * float representation. This matches PHP for the non-negative amounts this app deals in.
 */
export function round2(value) {
  const n = toNumber(value)
  if (!Number.isFinite(n)) return 0
  const sign = n < 0 ? -1 : 1
  const abs = Math.abs(n)
  // epsilon nudge corrects 1.005 * 100 === 100.49999999999999
  return (sign * Math.round((abs + Number.EPSILON) * 100)) / 100
}

/**
 * Reproduces App\Support\Money::format() exactly:
 *   '₹ '.number_format($amount, 2)  ->  "₹ 1,234.56"
 * The space after the symbol and the thousands separators are part of the UI contract.
 */
export function format(value, decimals = 2) {
  const n = toNumber(value)
  const fixed = Math.abs(n).toFixed(decimals)
  const [whole, fraction] = fixed.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const sign = n < 0 ? '-' : ''
  return `₹ ${sign}${grouped}${fraction ? `.${fraction}` : ''}`
}

/** Discount percent as shown on product cards — matches Product::getDiscountPercentAttribute */
export function discountPercent(mrp, price) {
  const m = toNumber(mrp)
  const p = toNumber(price)
  if (m > 0 && p > 0 && p < m) return Math.round(((m - p) / m) * 100)
  return 0
}

export default { toNumber, toDecimal, round2, format, discountPercent }
