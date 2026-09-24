import prisma from '../config/database.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/api-error.js'
import { verifyPassword, hashPassword } from '../utils/password.js'
import { toNumber, format } from '../utils/money.js'
import { productImageUrl, mediaUrl } from '../utils/media.js'
import { ORDER_STATUSES, statusLabel, normaliseStatus } from '../constants/order-statuses.js'

/**
 * Account area — port of App\Http\Controllers\AccountController.
 *
 * Ownership is checked on EVERY mutation. Laravel used route-model binding plus an
 * assertOwned() helper; here each write re-reads the row and compares `user_id`, so a
 * customer can never touch another customer's address, wishlist entry or review by
 * guessing an id.
 */

const assertOwned = (ownerId, userId) => {
  if (String(ownerId) !== String(userId)) throw new ForbiddenError('This action is unauthorized.')
}

const nameParts = (name) => {
  const parts = String(name ?? '').trim().split(/\s+/)
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') }
}

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : null

// ─────────────────────────────────────────────────────── payloads

export function customerPayload(user) {
  const { firstName, lastName } = nameParts(user.name)
  return {
    id: user.id,
    firstName: firstName || user.name,
    lastName,
    email: user.email,
    phone: user.phone ?? '',
    birthDate: user.birthDate ? new Date(user.birthDate).toISOString().slice(0, 10) : '',
    marketing: user.marketingOptIn ?? true,
  }
}

export const addressPayload = (address) => ({
  id: address.id,
  name: address.name,
  line1: address.addressLine1,
  line2: address.addressLine2,
  city: address.city,
  state: address.state,
  postcode: address.pincode,
  country: address.country,
  phone: address.phone,
  type: address.label || 'Shipping',
  default: Boolean(address.isDefault),
})

function wishlistPayload(item) {
  const product = item.product
  const mrp = toNumber(product?.mrp)
  const price = toNumber(product?.sellingPrice)

  return {
    id: item.id,
    productId: item.productId,
    name: product?.title ?? 'Product',
    price,
    priceFormatted: format(price),
    mrp,
    mrpFormatted: format(mrp),
    discountPercent: mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0,
    availability: product?.isActive ? 'Available' : 'Unavailable',
    image: productImageUrl(product?.featuredImage),
    url: product ? `/product/${product.slug}` : '/shop',
  }
}

const reviewPayload = (review) => ({
  id: review.id,
  productId: review.productId,
  productName: review.product?.title ?? 'Product',
  productUrl: review.product ? `/product/${review.product.slug}` : '/shop',
  productImage: productImageUrl(review.product?.featuredImage),
  rating: Number(review.rating),
  comment: review.comment,
  date: formatDate(review.createdAt),
  // Reviews are matched by email as well as user_id (see listReviews), but only rows that
  // actually carry this user's id can be deleted. Surfaced so the UI can hide the control
  // rather than offering an action that 403s.
  canDelete: review.userId !== null,
})

export function orderPayload(order) {
  const status = normaliseStatus(order.status)
  const shippingLines = [
    order.shippingAddress,
    order.shippingCity,
    order.shippingState,
    order.shippingPincode,
    order.shippingCountry,
  ].filter(Boolean)

  return {
    id: order.id,
    number: order.orderNumber,
    date: formatDate(order.orderedAt ?? order.createdAt),
    status: statusLabel(status),
    statusKey: status,
    // `status` is normalised for display (pending -> placed), so the raw values are
    // carried too. Callers that gate on whether payment actually happened — the order
    // confirmation page in particular — must use these, not statusKey.
    rawStatus: order.status,
    paymentStatus: order.paymentStatus,
    total: toNumber(order.payableAmount),
    totalFormatted: format(order.payableAmount),
    subtotal: toNumber(order.subtotal),
    subtotalFormatted: format(order.subtotal),
    discount: toNumber(order.discountAmount),
    discountFormatted: format(order.discountAmount),
    couponCode: order.couponCode,
    shipping: toNumber(order.deliveryCharge),
    shippingFormatted: format(order.deliveryCharge),
    paymentMode: String(order.paymentMode || 'razorpay').toUpperCase(),
    paymentId: order.paymentId,
    expectedDeliveryDate: order.expectedDeliveryDate,
    itemsCount: (order.items ?? []).reduce((sum, item) => sum + Number(item.quantity), 0),
    shippingName: order.shippingName,
    shippingPhone: order.shippingPhone,
    shippingEmail: order.shippingEmail || order.userEmail,
    shippingLines,
    items: (order.items ?? []).map((item) => ({
      title: item.productTitle,
      image: mediaUrl(item.productImage),
      color: item.color,
      size: item.size,
      packageLabel: item.packageLabel,
      qty: Number(item.quantity),
      price: toNumber(item.price),
      priceFormatted: format(item.price),
      total: toNumber(item.totalPrice),
      totalFormatted: format(item.totalPrice),
      status: statusLabel(normaliseStatus(item.status || status)),
    })),
  }
}

// ─────────────────────────────────────────────────────── reads

export async function listAddresses(userId) {
  const rows = await prisma.userAddress.findMany({
    where: { userId: BigInt(userId) },
    orderBy: { id: 'desc' },
  })
  return rows.map(addressPayload)
}

export async function listWishlist(userId) {
  const rows = await prisma.wishlist.findMany({
    where: { userId: BigInt(userId) },
    include: { product: true },
    orderBy: { id: 'desc' },
  })
  // A wishlist row whose product was deleted is skipped rather than rendered as a blank.
  return rows.filter((row) => row.product).map(wishlistPayload)
}

/**
 * Reviews are matched by `user_id` **OR** `reviewer_email`.
 *
 * That second clause is deliberate in the source: a review left as a guest, before the
 * account existed, still shows up under "My Reviews" once the addresses match.
 */
export async function listReviews(user) {
  const rows = await prisma.productReview.findMany({
    where: { OR: [{ userId: BigInt(user.id) }, { reviewerEmail: user.email }] },
    include: { product: true },
    orderBy: { id: 'desc' },
  })
  return rows.map(reviewPayload)
}

/**
 * Order history.
 *
 * Only orders that were actually paid, or have progressed past payment, are shown. A
 * `pending` order is one where checkout started but Razorpay never confirmed — surfacing
 * those would show customers "orders" they never completed.
 */
export async function listOrders(userId) {
  const rows = await prisma.order.findMany({
    where: {
      userId: BigInt(userId),
      OR: [
        { paymentStatus: 'paid' },
        {
          status: {
            in: [
              ORDER_STATUSES.PLACED,
              ORDER_STATUSES.PACKED,
              ORDER_STATUSES.SHIPPED,
              ORDER_STATUSES.DELIVERED,
            ],
          },
        },
      ],
    },
    include: { items: true },
    orderBy: [{ orderedAt: 'desc' }, { id: 'desc' }],
  })
  return rows.map(orderPayload)
}

/** AccountController::bootstrap — everything the account area renders, in one call. */
export async function bootstrap(user) {
  const [orders, addresses, wishlist, reviews] = await Promise.all([
    listOrders(user.id),
    listAddresses(user.id),
    listWishlist(user.id),
    listReviews(user),
  ])

  return { customer: customerPayload(user), orders, addresses, wishlist, reviews }
}

// ─────────────────────────────────────────────────────── profile

/**
 * AccountController::updateProfile.
 *
 * The password change is guarded by `current_password`, so a hijacked session cannot
 * silently change the password and lock the owner out.
 */
export async function updateProfile(user, data) {
  const email = String(data.email).trim().toLowerCase()

  const taken = await prisma.user.findFirst({
    where: { email, NOT: { id: BigInt(user.id) } },
    select: { id: true },
  })
  if (taken) {
    throw new ValidationError(
      { email: ['This email is already registered.'] },
      'This email is already registered.',
    )
  }

  const update = {
    name: `${data.first_name} ${data.last_name ?? ''}`.trim(),
    email,
    phone: data.phone || null,
    birthDate: data.birth_date ? new Date(data.birth_date) : null,
  }

  if (data.marketing_opt_in !== undefined) update.marketingOptIn = Boolean(data.marketing_opt_in)

  if (data.new_password) {
    if (!data.current_password || !(await verifyPassword(data.current_password, user.password))) {
      throw new ValidationError(
        { current_password: ['Current password is incorrect.'] },
        'Current password is incorrect.',
      )
    }
    update.password = await hashPassword(data.new_password)
  }

  const updated = await prisma.user.update({ where: { id: BigInt(user.id) }, data: update })
  return customerPayload(updated)
}

// ─────────────────────────────────────────────────────── addresses

/**
 * The columns an address write sets.
 *
 * `addressLine2`, `state` and `phone` are only written when the caller actually sent them.
 * They used to be written unconditionally as `?? null`, and the account area's address
 * form does not include those three fields — so a customer editing an address created at
 * checkout silently lost their apartment line, state and contact number, and their next
 * order shipped without them. Absent means "leave it", which is what a partial update
 * means; sending an empty string still clears the field deliberately.
 *
 * `create` passes a fresh object, so an omitted field simply falls to the column default.
 */
const addressData = (data, fallbackLabel = 'Shipping') => ({
  name: data.name,
  addressLine1: data.address_line1,
  city: data.city,
  pincode: data.pincode,
  country: data.country,
  label: data.label || fallbackLabel,
  ...(data.address_line2 === undefined ? {} : { addressLine2: data.address_line2 || null }),
  ...(data.state === undefined ? {} : { state: data.state || null }),
  ...(data.phone === undefined ? {} : { phone: data.phone || null }),
})

/**
 * AccountController::storeAddress.
 *
 * Two rules, both preserved: marking an address default un-defaults the others first, and
 * the FIRST address a customer creates becomes default automatically — otherwise checkout
 * has no address to pre-fill.
 */
export async function createAddress(userId, data) {
  const key = BigInt(userId)

  return prisma.$transaction(async (tx) => {
    if (data.is_default) {
      await tx.userAddress.updateMany({ where: { userId: key }, data: { isDefault: false } })
    }

    const existingCount = await tx.userAddress.count({ where: { userId: key } })

    const address = await tx.userAddress.create({
      data: {
        userId: key,
        ...addressData(data),
        isDefault: Boolean(data.is_default) || existingCount === 0,
      },
    })

    return addressPayload(address)
  })
}

export async function updateAddress(userId, addressId, data) {
  const key = BigInt(userId)
  const existing = await prisma.userAddress.findUnique({ where: { id: BigInt(addressId) } })
  if (!existing) throw new NotFoundError('Address not found.')
  assertOwned(existing.userId, userId)

  return prisma.$transaction(async (tx) => {
    if (data.is_default) {
      await tx.userAddress.updateMany({
        where: { userId: key, NOT: { id: existing.id } },
        data: { isDefault: false },
      })
    }

    const address = await tx.userAddress.update({
      where: { id: existing.id },
      data: {
        ...addressData(data, existing.label),
        isDefault: data.is_default === undefined ? existing.isDefault : Boolean(data.is_default),
      },
    })

    return addressPayload(address)
  })
}

export async function deleteAddress(userId, addressId) {
  const existing = await prisma.userAddress.findUnique({ where: { id: BigInt(addressId) } })
  if (!existing) throw new NotFoundError('Address not found.')
  assertOwned(existing.userId, userId)

  await prisma.userAddress.delete({ where: { id: existing.id } })
}

export async function setDefaultAddress(userId, addressId) {
  const key = BigInt(userId)
  const existing = await prisma.userAddress.findUnique({ where: { id: BigInt(addressId) } })
  if (!existing) throw new NotFoundError('Address not found.')
  assertOwned(existing.userId, userId)

  return prisma.$transaction(async (tx) => {
    await tx.userAddress.updateMany({ where: { userId: key }, data: { isDefault: false } })
    const address = await tx.userAddress.update({
      where: { id: existing.id },
      data: { isDefault: true },
    })
    return addressPayload(address)
  })
}

// ─────────────────────────────────────────────────────── wishlist

/**
 * AccountController::storeWishlist — idempotent, matching firstOrCreate.
 *
 * The table has a unique key on (user_id, product_id), so adding twice must not error.
 * `created` tells the caller whether this was genuinely new, which gates the Meta
 * AddToWishlist event in phase 12.
 */
export async function addToWishlist(userId, productId) {
  const key = BigInt(userId)
  const product = BigInt(productId)

  const exists = await prisma.product.findUnique({ where: { id: product }, select: { id: true } })
  if (!exists) throw new NotFoundError('Product not found.')

  const existing = await prisma.wishlist.findFirst({ where: { userId: key, productId: product } })
  if (existing) {
    const withProduct = await prisma.wishlist.findFirst({
      where: { id: existing.id },
      include: { product: true },
    })
    return { item: wishlistPayload(withProduct), created: false }
  }

  const created = await prisma.wishlist.create({
    data: { userId: key, productId: product },
    include: { product: true },
  })

  return { item: wishlistPayload(created), created: true }
}

export async function removeFromWishlist(userId, wishlistId) {
  const existing = await prisma.wishlist.findUnique({ where: { id: BigInt(wishlistId) } })
  if (!existing) throw new NotFoundError('Wishlist item not found.')
  assertOwned(existing.userId, userId)

  await prisma.wishlist.delete({ where: { id: existing.id } })
}

/** Remove by PRODUCT id — the product page toggles a wishlist without knowing the row id. */
export async function removeProductFromWishlist(userId, productId) {
  const existing = await prisma.wishlist.findFirst({
    where: { userId: BigInt(userId), productId: BigInt(productId) },
  })
  if (!existing) throw new NotFoundError('Wishlist item not found.')

  await prisma.wishlist.delete({ where: { id: existing.id } })
}

// ─────────────────────────────────────────────────────── reviews

/**
 * AccountController::destroyReview.
 *
 * Ownership is checked against `user_id` only. A review matched into the list by email but
 * carrying a NULL user_id therefore cannot be deleted — a quirk of the source, preserved,
 * and surfaced to the UI as `canDelete` so it does not offer an action that 403s.
 */
export async function deleteReview(userId, reviewId) {
  const existing = await prisma.productReview.findUnique({ where: { id: BigInt(reviewId) } })
  if (!existing) throw new NotFoundError('Review not found.')
  assertOwned(existing.userId, userId)

  await prisma.productReview.delete({ where: { id: existing.id } })
}

// ─────────────────────────────────────────────────────── orders

/** A single order for the customer. Admins may view any order. */
export async function getOrderByNumber(orderNumber, user = null) {
  const order = await prisma.order.findFirst({
    where: { orderNumber },
    include: { items: true, statusLogs: { orderBy: { id: 'asc' } } },
  })
  if (!order) throw new NotFoundError('Order not found.')

  if (user && user.role !== 'admin' && String(order.userId) !== String(user.id)) {
    throw new ForbiddenError('This action is unauthorized.')
  }

  return {
    ...orderPayload(order),
    statusLogs: (order.statusLogs ?? []).map((log) => ({
      status: log.status,
      title: log.title,
      description: log.description,
      loggedAt: log.loggedAt,
    })),
  }
}

export default {
  bootstrap,
  customerPayload,
  updateProfile,
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  listWishlist,
  addToWishlist,
  removeFromWishlist,
  removeProductFromWishlist,
  listReviews,
  deleteReview,
  listOrders,
  getOrderByNumber,
}
