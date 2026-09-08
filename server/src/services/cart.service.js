import prisma from '../config/database.js'
import { BusinessError, NotFoundError } from '../utils/api-error.js'
import { toNumber, toDecimal, format } from '../utils/money.js'
import { productImageUrl } from '../utils/media.js'
import { accessoryPackages } from '../utils/product-presenter.js'
import * as shipping from './shipping.service.js'
import * as promotions from './promotion.service.js'

/**
 * Cart — port of App\Services\CartService (520 lines, the most business-critical file in
 * the application).
 *
 * Two backing stores, exactly as in Laravel:
 *   authenticated -> `cart_items` rows
 *   guest         -> a signed cookie (Laravel used the PHP session)
 *
 * The guest cart stores ONLY product ids, quantities and variant keys. Every price is
 * re-resolved from the database on read, so a tampered cookie cannot alter pricing, and
 * quantities are re-validated against stock on every mutation. Nothing authoritative
 * lives on the client.
 */

// ───────────────────────────────────────────── variant normalisation

/**
 * CartService::normalizeVariant.
 *
 * The sentinel values matter: the storefront's select elements submit '' or 'Select' when
 * nothing is chosen, and older markup submitted '?'. Treating those as real variant names
 * creates cart lines that can never be matched again — the customer cannot update or
 * remove them.
 */
export function normalizeVariant(color, size) {
  const clean = (value) => {
    if (value === null || value === undefined) return null
    const trimmed = String(value).trim()
    if (trimmed === '' || trimmed === '?' || trimmed.toLowerCase() === 'select') return null
    return trimmed
  }
  return [clean(color), clean(size)]
}

/**
 * CartService::lineKey — the cart's identity function.
 *
 * A line is (product, colour, size, package), lower-cased. Same product in two colours is
 * two lines. Get this wrong and add-to-cart either merges lines that should be separate or
 * endlessly creates duplicates.
 */
export function lineKey(productId, color, size, packageKey) {
  return [
    String(productId),
    String(color ?? '').toLowerCase(),
    String(size ?? '').toLowerCase(),
    String(packageKey ?? '').toLowerCase(),
  ].join('|')
}

// ───────────────────────────────────────────── product helpers

const PRODUCT_INCLUDE = {
  category: { select: { id: true, slug: true, title: true } },
  offer: { select: { id: true, discountPercent: true } },
  colors: { include: { color: { select: { id: true, name: true } } } },
  sizes: { include: { size: { select: { id: true, name: true } } } },
}

async function loadActiveProduct(productId) {
  const product = await prisma.product.findFirst({
    where: { id: BigInt(productId), isActive: true },
    include: PRODUCT_INCLUDE,
  })
  if (!product) throw new NotFoundError('This product is no longer available.')
  return product
}

/**
 * CartService::maximumQuantity.
 *
 * min(max_unit_buy or 99, colour stock if a colour is selected, size stock if a size is
 * selected). Variant names are matched case-insensitively because the stored cart value
 * may differ in case from the catalogue row.
 */
export function maximumQuantity(product, color, size) {
  const limits = [Math.max(1, Number(product.maxUnitBuy) || 99)]

  if (color && product.colors?.length) {
    const selected = product.colors.find(
      (pc) => pc.color?.name?.toLowerCase() === String(color).toLowerCase(),
    )
    if (selected) limits.push(Number(selected.quantity))
  }

  if (size && product.sizes?.length) {
    const selected = product.sizes.find(
      (ps) => ps.size?.name?.toLowerCase() === String(size).toLowerCase(),
    )
    if (selected) limits.push(Number(selected.quantity))
  }

  return Math.min(...limits)
}

/**
 * CartService::resolveVariants — when nothing is chosen, default to the product's FIRST
 * colour (upper-cased) and FIRST size.
 *
 * The upper-casing is not cosmetic: colour gallery keys are upper-cased too, so a
 * lower-cased default would fail to match its gallery.
 */
function resolveVariants(product, color, size) {
  let [c, s] = normalizeVariant(color, size)
  if (c === null && product.colors?.length) c = String(product.colors[0].color?.name ?? '').toUpperCase()
  if (s === null && product.sizes?.length) s = String(product.sizes[0].size?.name ?? '')
  return normalizeVariant(c, s)
}

/**
 * CartService::resolvePackage.
 *
 * Packages apply ONLY to products in the 'accessories' category, and the price is always
 * read from the product row — never from the request. An unmatched key falls back to the
 * first package rather than erroring.
 */
function resolvePackage(product, packageKey) {
  const none = { key: null, label: null, mrp: null, price: null }
  if (product.category?.slug !== 'accessories') return none

  const packages = accessoryPackages(product)
  if (packages.length === 0) return none

  const match = packages.find((p) => p.key === packageKey) ?? packages[0]
  return { key: match.key, label: match.label, mrp: match.mrp, price: match.price }
}

function ensureQuantityAvailable(quantity, maximum) {
  if (maximum < 1) throw new BusinessError('This product option is out of stock.')
  if (quantity > maximum) {
    throw new BusinessError(`Only ${maximum} item(s) are available for this product option.`)
  }
}

/** CartService::formatLine — the shape every cart consumer reads. */
function formatLine(product, quantity, color, size, pack, cartItemId = null) {
  const [c, s] = normalizeVariant(color, size)
  const unit = pack.price ?? toNumber(product.sellingPrice)
  const mrp = pack.mrp ?? toNumber(product.mrp)
  const lineTotal = unit * quantity

  return {
    id: cartItemId,
    productId: product.id,
    categoryId: product.categoryId,
    title: product.title,
    slug: product.slug,
    url: `/product/${product.slug}`,
    image: productImageUrl(product.featuredImage),
    color: c,
    size: s,
    packageKey: pack.key,
    packageLabel: pack.label,
    lineKey: lineKey(product.id, c, s, pack.key),
    quantity,
    unitPrice: unit,
    unitPriceFormatted: format(unit),
    mrp,
    mrpFormatted: format(mrp),
    discountPercent: mrp > unit ? Math.round(((mrp - unit) / mrp) * 100) : 0,
    lineTotal,
    lineTotalFormatted: format(lineTotal),
    maxQuantity: maximumQuantity(product, c, s),
  }
}

// ───────────────────────────────────────────── reading

/**
 * Guest cart state as held in the signed cookie.
 * @typedef {{lines: Array<{productId: string, quantity: number, color: ?string, size: ?string, packageKey: ?string}>, coupon: ?string}} GuestCart
 */

/** Read cart lines for a user (database) or a guest (cookie state). */
export async function getLines(user, guestCart) {
  if (user) {
    const items = await prisma.cartItem.findMany({
      where: { userId: BigInt(user.id) },
      include: { product: { include: PRODUCT_INCLUDE } },
      orderBy: { id: 'desc' }, // latest('id'), as in Laravel
    })

    return items
      .filter((item) => item.product && item.product.isActive)
      .map((item) => {
        // A stored package price wins over the current catalogue price, so an admin
        // changing a package does not silently reprice a cart already in progress.
        const resolved = resolvePackage(item.product, item.packageKey)
        const pack =
          item.packageKey && item.packagePrice !== null
            ? {
                key: item.packageKey,
                label: item.packageLabel || resolved.label,
                mrp: resolved.mrp ?? toNumber(item.packagePrice),
                price: toNumber(item.packagePrice),
              }
            : resolved

        return formatLine(item.product, Number(item.quantity), item.color, item.size, pack, item.id)
      })
  }

  const lines = guestCart?.lines ?? []
  if (lines.length === 0) return []

  const products = await prisma.product.findMany({
    where: { id: { in: lines.map((l) => BigInt(l.productId)) }, isActive: true },
    include: PRODUCT_INCLUDE,
  })
  const byId = new Map(products.map((p) => [String(p.id), p]))

  // Lines whose product has been deleted or deactivated are dropped, not errored.
  return lines
    .map((line) => {
      const product = byId.get(String(line.productId))
      if (!product) return null
      return formatLine(
        product,
        Number(line.quantity),
        line.color,
        line.size,
        resolvePackage(product, line.packageKey),
      )
    })
    .filter(Boolean)
}

/**
 * CartService::summary — the totals pipeline.
 *
 * ORDER IS LOAD-BEARING:
 *   subtotal
 *   -> discount (from the applied coupon)
 *   -> shipping quoted on (subtotal - discount)   <- NOT the raw subtotal
 *   -> free-shipping override
 *   -> total
 *
 * Quoting shipping against the pre-discount subtotal is a silent parity break: a customer
 * whose coupon drops them below the free-shipping threshold would still get free delivery.
 */
export async function getSummary(user, guestCart) {
  const items = await getLines(user, guestCart)
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)

  const discount = await promotions.quote(guestCart?.coupon ?? null, items, user)

  const shippingSubtotal = Math.max(0, subtotal - toNumber(discount.amount))
  let shippingQuote = await shipping.quote(shippingSubtotal)

  if (discount.freeShipping) {
    shippingQuote = { ...shippingQuote, amount: 0, isFree: true, amountFormatted: 'Free' }
  }

  const total = Math.max(0, subtotal - toNumber(discount.amount) + shippingQuote.amount)

  return {
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    subtotalFormatted: format(subtotal),
    discount,
    shipping: shippingQuote,
    total,
    totalFormatted: format(total),
    // Signals the caller to drop a coupon that no longer validates.
    clearCoupon: Boolean(discount.clear),
  }
}

// ───────────────────────────────────────────── mutations

/**
 * CartService::add. Quantity ACCUMULATES onto an existing matching line, and the combined
 * total is validated against stock — not just the increment.
 */
export async function addItem(user, guestCart, { productId, quantity = 1, color, size, packageKey }) {
  const product = await loadActiveProduct(productId)
  const qty = Math.max(1, Number(quantity) || 1)
  const [c, s] = resolveVariants(product, color, size)
  const max = maximumQuantity(product, c, s)
  const pack = resolvePackage(product, packageKey)

  if (user) {
    const existing = await findDbLine(user.id, product.id, c, s, pack.key)
    const requested = (existing ? Number(existing.quantity) : 0) + qty
    ensureQuantityAvailable(requested, max)

    const data = {
      color: c,
      size: s,
      packageKey: pack.key,
      packageLabel: pack.label,
      packagePrice: pack.price === null ? null : toDecimal(pack.price),
      quantity: requested,
    }

    if (existing) {
      await prisma.cartItem.update({ where: { id: existing.id }, data })
    } else {
      await prisma.cartItem.create({
        data: { userId: BigInt(user.id), productId: product.id, ...data },
      })
    }
    return { guestCart, message: 'Added to cart.' }
  }

  const lines = [...(guestCart?.lines ?? [])]
  const key = lineKey(product.id, c, s, pack.key)
  const index = lines.findIndex((l) => lineKey(l.productId, l.color, l.size, l.packageKey) === key)
  const requested = (index >= 0 ? Number(lines[index].quantity) : 0) + qty
  ensureQuantityAvailable(requested, max)

  const line = { productId: String(product.id), quantity: requested, color: c, size: s, packageKey: pack.key }
  if (index >= 0) lines[index] = line
  else lines.unshift(line)

  return { guestCart: { ...guestCart, lines }, message: 'Added to cart.' }
}

/** CartService::update. Quantity 0 is a removal, matching Laravel. */
export async function updateItem(user, guestCart, { productId, quantity, color, size, packageKey }) {
  const qty = Math.max(0, Number(quantity) || 0)
  const [c, s] = normalizeVariant(color, size)

  if (qty === 0) {
    return removeItem(user, guestCart, { productId, color: c, size: s, packageKey })
  }

  const product = await loadActiveProduct(productId)
  ensureQuantityAvailable(qty, maximumQuantity(product, c, s))
  const pack = resolvePackage(product, packageKey)

  if (user) {
    const existing = await findDbLine(user.id, product.id, c, s, pack.key)
    if (!existing) throw new NotFoundError('Cart item not found.')
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: qty } })
    return { guestCart, message: 'Cart updated.' }
  }

  const lines = [...(guestCart?.lines ?? [])]
  const key = lineKey(product.id, c, s, pack.key)
  const index = lines.findIndex((l) => lineKey(l.productId, l.color, l.size, l.packageKey) === key)
  if (index < 0) throw new NotFoundError('Cart item not found.')

  lines[index] = { ...lines[index], quantity: qty }
  return { guestCart: { ...guestCart, lines }, message: 'Cart updated.' }
}

/**
 * CartService::remove. Removing the last line also drops the applied coupon, so it cannot
 * reappear against a different cart later.
 */
export async function removeItem(user, guestCart, { productId, color, size, packageKey }) {
  const [c, s] = normalizeVariant(color, size)
  let nextGuestCart = guestCart

  if (user) {
    const existing = await findDbLine(user.id, productId, c, s, packageKey ?? null)
    if (existing) await prisma.cartItem.delete({ where: { id: existing.id } })
  } else {
    const key = lineKey(productId, c, s, packageKey ?? null)
    const lines = (guestCart?.lines ?? []).filter(
      (l) => lineKey(l.productId, l.color, l.size, l.packageKey) !== key,
    )
    nextGuestCart = { ...guestCart, lines }
  }

  const remaining = await countItems(user, nextGuestCart)
  if (remaining < 1) nextGuestCart = { ...nextGuestCart, coupon: null }

  return { guestCart: nextGuestCart, message: 'Removed from cart.' }
}

/** CartService::clear — empties the cart and the applied coupon together. */
export async function clearCart(user) {
  if (user) await prisma.cartItem.deleteMany({ where: { userId: BigInt(user.id) } })
  return { guestCart: { lines: [], coupon: null } }
}

export async function countItems(user, guestCart) {
  if (user) {
    const result = await prisma.cartItem.aggregate({
      where: { userId: BigInt(user.id) },
      _sum: { quantity: true },
    })
    return Number(result._sum.quantity ?? 0)
  }
  return (guestCart?.lines ?? []).reduce((sum, l) => sum + Number(l.quantity), 0)
}

/**
 * CartService::mergeSessionIntoUser — called on login and registration.
 *
 * Quantities are summed and then CAPPED at max_unit_buy. Note Laravel used the plain
 * max_unit_buy cap here rather than the full per-variant stock check used by add() —
 * preserved, because being stricter would silently drop items a customer expects to still
 * be in their cart after signing in.
 *
 * Unknown or inactive products are skipped rather than failing the login.
 */
export async function mergeGuestCartIntoUser(user, guestCart) {
  const lines = guestCart?.lines ?? []
  if (lines.length === 0) return

  for (const line of lines) {
    const product = await prisma.product.findFirst({
      where: { id: BigInt(line.productId), isActive: true },
      include: PRODUCT_INCLUDE,
    })
    if (!product) continue

    const [c, s] = normalizeVariant(line.color, line.size)
    const pack = resolvePackage(product, line.packageKey)
    const max = Math.max(1, Number(product.maxUnitBuy) || 99)

    const existing = await findDbLine(user.id, product.id, c, s, pack.key)
    const quantity = Math.min(max, (existing ? Number(existing.quantity) : 0) + Math.max(1, Number(line.quantity) || 1))

    const data = {
      color: c,
      size: s,
      packageKey: pack.key,
      packageLabel: pack.label,
      packagePrice: pack.price === null ? null : toDecimal(pack.price),
      quantity,
    }

    if (existing) {
      await prisma.cartItem.update({ where: { id: existing.id }, data })
    } else {
      await prisma.cartItem.create({ data: { userId: BigInt(user.id), productId: product.id, ...data } })
    }
  }
}

/**
 * CartService::assertInventoryAvailable — the pre-checkout gate.
 *
 * Re-checks every line against live stock, because a cart can sit for days while stock
 * moves. Called before an order is created, never trusting the cart's own maxQuantity.
 */
export async function assertInventoryAvailable(items) {
  for (const item of items) {
    const product = await prisma.product.findFirst({
      where: { id: BigInt(item.productId), isActive: true },
      include: PRODUCT_INCLUDE,
    })
    if (!product) throw new BusinessError('A product in your cart is no longer available.')

    const maximum = maximumQuantity(product, item.color, item.size)
    const quantity = Number(item.quantity ?? 0)

    if (maximum < 1) throw new BusinessError(`${product.title} is out of stock.`)
    if (quantity > maximum) {
      throw new BusinessError(`Only ${maximum} item(s) of ${product.title} are available.`)
    }
  }
}

/**
 * CartService::findDbLine.
 *
 * NULL and '' must both count as "no variant". Laravel wrote this as
 * `whereNull(col)->orWhere(col, '')` because historic rows contain both, and a plain
 * equality check would fail to find them — producing duplicate lines that the customer
 * cannot remove.
 */
async function findDbLine(userId, productId, color, size, packageKey) {
  const emptyOr = (field) => ({ OR: [{ [field]: null }, { [field]: '' }] })

  return prisma.cartItem.findFirst({
    where: {
      userId: BigInt(userId),
      productId: BigInt(productId),
      AND: [
        color === null ? emptyOr('color') : { color },
        size === null ? emptyOr('size') : { size },
        packageKey === null || packageKey === undefined
          ? emptyOr('packageKey')
          : { packageKey },
      ],
    },
  })
}

export default {
  getLines,
  getSummary,
  addItem,
  updateItem,
  removeItem,
  clearCart,
  countItems,
  mergeGuestCartIntoUser,
  assertInventoryAvailable,
  maximumQuantity,
  normalizeVariant,
  lineKey,
}
