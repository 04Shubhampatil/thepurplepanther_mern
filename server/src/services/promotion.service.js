import prisma from '../config/database.js'
import { BusinessError } from '../utils/api-error.js'
import { toNumber, toDecimal, round2, format } from '../utils/money.js'
import { parseJsonArray } from '../utils/json.js'

/**
 * Coupons and promotions — port of App\Services\PromotionService.
 *
 * This is the file most likely to cost real money if it drifts, so every rule below traces
 * to a specific line of the original and the ORDER of the checks is preserved: each
 * rejection has its own customer-facing message, and reordering them changes which message
 * a customer sees.
 *
 * The applied coupon code is session state, not a database column. It is re-validated on
 * every cart read, so a coupon that expires or runs out mid-session stops applying
 * immediately rather than being honoured because it was applied earlier.
 */

const emptyQuote = () => ({
  code: null,
  couponId: null,
  label: null,
  amount: 0,
  amountFormatted: format(0),
  freeShipping: false,
  message: null,
})

/**
 * PromotionService::findActiveCoupon — existence and window checks, each with its own
 * message. Codes are upper-cased and trimmed before lookup.
 */
async function findActiveCoupon(code) {
  const normalized = String(code ?? '').trim().toUpperCase()

  const coupon = await prisma.coupon.findFirst({ where: { code: normalized, isActive: true } })
  if (!coupon) throw new BusinessError('Invalid coupon code.')

  const now = new Date()
  if (coupon.startsAt && now < new Date(coupon.startsAt)) {
    throw new BusinessError('This coupon is not active yet.')
  }
  if (coupon.endsAt && now > new Date(coupon.endsAt)) {
    throw new BusinessError('This coupon has expired.')
  }
  if (coupon.usageLimit !== null && Number(coupon.usedCount) >= Number(coupon.usageLimit)) {
    throw new BusinessError('This coupon has reached its usage limit.')
  }

  return coupon
}

/**
 * PromotionService::eligibleItems.
 *
 * `applies_to` selects the scope. Everything downstream — minimum quantity, minimum cart
 * amount and the discount itself — is computed against this SUBSET, not the whole cart.
 * Computing them against the full cart would over-discount.
 */
function eligibleItems(coupon, items) {
  const appliesTo = coupon.appliesTo || 'all'
  const categoryIds = parseJsonArray(coupon.categoryIds).map(Number).filter(Boolean)
  const productIds = parseJsonArray(coupon.productIds).map(Number).filter(Boolean)

  return items.filter((item) => {
    if (appliesTo === 'products') return productIds.includes(Number(item.productId))
    if (appliesTo === 'categories') return categoryIds.includes(Number(item.categoryId))
    return true
  })
}

/** Coupon::getDiscountLabelAttribute equivalent — the badge shown next to the code. */
function discountLabel(coupon) {
  if (coupon.offerType === 'bogo') {
    const buy = Math.max(1, Number(coupon.bogoBuyQuantity ?? 1))
    const get = Math.max(1, Number(coupon.bogoGetQuantity ?? 1))
    return `Buy ${buy}, Get ${get}`
  }
  if (coupon.discountType === 'percent') return `${toNumber(coupon.discountPercent)}% OFF`
  return `${format(coupon.discountAmount)} OFF`
}

/**
 * PromotionService::quoteCoupon — the full eligibility gauntlet, in Laravel's order.
 *
 * @param user - the signed-in user, or null. Several rules depend on it.
 */
export async function quoteCoupon(coupon, items, user = null) {
  // 1. Members-only.
  if (coupon.membersOnly && !user) {
    throw new BusinessError('Please log in to use this member offer.')
  }

  // 2. New customers only. A GUEST is eligible: checkout creates the account after
  //    verifying the email is not already registered, so there is nothing to check yet.
  if (coupon.newCustomersOnly && user) {
    const hasPaidOrder = await prisma.order.findFirst({
      where: { userId: BigInt(user.id), paymentStatus: 'paid' },
      select: { id: true },
    })
    if (hasPaidOrder) throw new BusinessError('This offer is only for first-time customers.')
  }

  // 3. One use per user, tracked in coupon_redemptions.
  if (coupon.maxUsePerUser && user) {
    const used = await prisma.couponRedemption.findFirst({
      where: { couponId: coupon.id, userId: BigInt(user.id) },
      select: { id: true },
    })
    if (used) throw new BusinessError('You have already used this coupon.')
  }

  // 4. Scope.
  const eligible = eligibleItems(coupon, items)
  if (eligible.length === 0) {
    throw new BusinessError('This coupon does not apply to items in your cart.')
  }

  // 5. Minimum quantity, against the eligible subset.
  const eligibleQty = eligible.reduce((sum, item) => sum + Number(item.quantity), 0)
  if (coupon.minQuantity && eligibleQty < Number(coupon.minQuantity)) {
    throw new BusinessError(
      `Add at least ${coupon.minQuantity} eligible item(s) to use this coupon.`,
    )
  }

  // 6. Minimum cart amount, also against the eligible subset.
  const eligibleSubtotal = eligible.reduce((sum, item) => sum + toNumber(item.lineTotal), 0)
  if (coupon.minCartStatus && eligibleSubtotal < toNumber(coupon.minCartAmount)) {
    throw new BusinessError(
      `Minimum cart amount for this coupon is ${format(coupon.minCartAmount)}.`,
    )
  }

  // ---- discount ---------------------------------------------------------
  let discount = 0

  if (coupon.offerType === 'bogo') {
    // Computed PER LINE, deliberately. Grouping across the cart would let a cheap item
    // make an expensive one free.
    const buy = Math.max(1, Number(coupon.bogoBuyQuantity ?? 1))
    const get = Math.max(1, Number(coupon.bogoGetQuantity ?? 1))
    const groupSize = buy + get

    discount = eligible.reduce((sum, item) => {
      const quantity = Number(item.quantity ?? 0)
      const unitPrice = toNumber(item.unitPrice)
      const freeQuantity = Math.floor(quantity / groupSize) * get
      return sum + freeQuantity * unitPrice
    }, 0)
  } else if (coupon.discountType === 'percent') {
    discount = eligibleSubtotal * (toNumber(coupon.discountPercent) / 100)
    if (coupon.maxDiscountStatus && coupon.maxDiscountAmount !== null) {
      discount = Math.min(discount, toNumber(coupon.maxDiscountAmount))
    }
  } else if (coupon.discountType === 'amount') {
    // Never discount more than the eligible items are worth.
    discount = Math.min(toNumber(coupon.discountAmount), eligibleSubtotal)
  }

  discount = Math.max(0, round2(discount))

  // A coupon that produces nothing is an error — UNLESS it grants free shipping, which is
  // a benefit on its own.
  if (discount <= 0 && !coupon.freeShipping) {
    if (coupon.offerType === 'bogo') {
      const required =
        Math.max(1, Number(coupon.bogoBuyQuantity ?? 1)) + Math.max(1, Number(coupon.bogoGetQuantity ?? 1))
      throw new BusinessError(
        `Add ${required} matching eligible item(s) to use this Buy X, Get Y offer.`,
      )
    }
    throw new BusinessError('This coupon does not provide a discount for your cart.')
  }

  return {
    code: coupon.code,
    couponId: coupon.id,
    label: discountLabel(coupon) + (coupon.freeShipping ? ' + Free shipping' : ''),
    amount: discount,
    amountFormatted: format(discount),
    freeShipping: Boolean(coupon.freeShipping),
    message: null,
  }
}

/** Validate a code being applied. Throws with a customer-facing message on rejection. */
export async function applyCode(code, items, user = null) {
  const coupon = await findActiveCoupon(code)
  return quoteCoupon(coupon, items, user)
}

/**
 * PromotionService::quote — re-evaluate the applied code on every cart read.
 *
 * Never throws. A now-invalid coupon is dropped and its reason surfaced in `message`, so
 * the cart still renders. The caller is told to clear the stored code via `clear: true`.
 */
export async function quote(code, items, user = null) {
  const empty = emptyQuote()

  // An empty cart must not keep a sticky coupon for the next add-to-cart.
  if (!items || items.length === 0) return { ...empty, clear: true }
  if (!code) return empty

  try {
    const coupon = await findActiveCoupon(code)
    return { ...(await quoteCoupon(coupon, items, user)), clear: false }
  } catch (error) {
    return { ...empty, message: error.message, clear: true }
  }
}

/**
 * PromotionService::recordRedemption — writes the redemption row AND increments
 * `coupons.used_count`.
 *
 * Both happen inside the caller's transaction. Splitting them lets the counter drift away
 * from the redemption rows, which then breaks `usage_limit` enforcement.
 *
 * @param tx - a Prisma transaction client; falls back to the base client.
 */
export async function recordRedemption(order, userId = null, tx = prisma) {
  if (!order.couponId || !order.couponCode) return

  await tx.couponRedemption.create({
    data: {
      couponId: order.couponId,
      userId: userId ? BigInt(userId) : order.userId,
      orderId: order.id,
      code: order.couponCode,
      discountAmount: toDecimal(order.discountAmount),
    },
  })

  await tx.coupon.update({
    where: { id: order.couponId },
    data: { usedCount: { increment: 1 } },
  })
}

/**
 * Coupon::getBannerTextAttribute — the one line the header ticker shows.
 *
 * A ported accessor, not a new format: the fallback chain (rich-text description first,
 * then BOGO, free shipping, flat amount, percent, and finally "SPECIAL OFFER") and the
 * trailing-zero trimming are the original's, because these strings are what customers read
 * at the top of every page.
 */
function trimAmount(value) {
  return Number(value)
    .toFixed(2)
    .replace(/0+$/, '')
    .replace(/\.$/, '')
}

export function bannerText(coupon) {
  // strip_tags + html_entity_decode + collapse whitespace
  const described = String(coupon.description ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
  if (described !== '') return described

  const code = String(coupon.code ?? '').toUpperCase()

  if (coupon.offerType === 'bogo') {
    const buy = Number(coupon.bogoBuyQuantity) || 1
    const get = Number(coupon.bogoGetQuantity) || 1
    return `${code} | BUY ${buy} GET ${get} FREE`
  }

  if (coupon.freeShipping && !coupon.discountPercent && !coupon.discountAmount) {
    return `${code} | FREE SHIPPING`
  }

  if (coupon.discountType === 'amount' && coupon.discountAmount !== null && coupon.discountAmount !== undefined) {
    return `${code} | FLAT ₹${trimAmount(coupon.discountAmount)} OFF`
  }

  if (coupon.discountPercent !== null && coupon.discountPercent !== undefined) {
    return `${code} | ${trimAmount(coupon.discountPercent)}% OFF`
  }

  return `${code} | SPECIAL OFFER`
}

/** Publicly listable coupons — `is_public` gates what the storefront may advertise. */
export async function listPublicCoupons() {
  const now = new Date()
  const coupons = await prisma.coupon.findMany({
    where: {
      isActive: true,
      isPublic: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: { id: 'desc' },
  })

  return coupons.map((coupon) => ({
    id: coupon.id,
    code: coupon.code,
    description: coupon.description,
    bannerText: bannerText(coupon),
    label: discountLabel(coupon),
    freeShipping: Boolean(coupon.freeShipping),
    minCartAmount: coupon.minCartStatus ? toNumber(coupon.minCartAmount) : null,
    endsAt: coupon.endsAt,
  }))
}

export default {
  bannerText,
  applyCode,
  quote,
  quoteCoupon,
  recordRedemption,
  listPublicCoupons,
  emptyQuote,
}
