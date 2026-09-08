import prisma from '../../config/database.js'
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/api-error.js'
import { hashPassword } from '../../utils/password.js'
import { toDecimal, toNumber } from '../../utils/money.js'
import { stringifyJsonColumn } from '../../utils/json.js'
import { persist, remove, UPLOAD_DIRS } from '../upload.service.js'
import { isValidSitePage, SITE_PAGES } from '../../constants/cms.js'
import { ROLES } from '../../constants/roles.js'

/**
 * The remaining admin modules: users, banners, home sections, coupons, contacts and
 * settings.
 */

// ══════════════════════════════════════════════ users

const USER_SELECT = {
  id: true,
  name: true,
  username: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  loginProvider: true,
  createdAt: true,
}

export async function listUsers({ search = '', role = null, page = 1, perPage = 20 } = {}) {
  const term = String(search ?? '').trim()

  const where = {
    ...(role ? { role } : {}),
    ...(term
      ? {
          OR: [
            { name: { contains: term } },
            { email: { contains: term } },
            { phone: { contains: term } },
            { username: { contains: term } },
          ],
        }
      : {}),
  }

  const take = Math.min(Math.max(1, perPage), 100)
  const currentPage = Math.max(1, page)

  const [total, items] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: USER_SELECT, // never selects the password hash
      orderBy: { id: 'desc' },
      skip: (currentPage - 1) * take,
      take,
    }),
  ])

  return {
    items,
    pagination: { page: currentPage, perPage: take, total, lastPage: Math.max(1, Math.ceil(total / take)) },
  }
}

export async function findUser(id) {
  const user = await prisma.user.findUnique({ where: { id: BigInt(id) }, select: USER_SELECT })
  if (!user) throw new NotFoundError('User not found.')
  return user
}

async function assertEmailFree(email, ignoreId = null) {
  const clash = await prisma.user.findFirst({
    where: { email, ...(ignoreId ? { NOT: { id: BigInt(ignoreId) } } : {}) },
    select: { id: true },
  })
  if (clash) {
    throw new ValidationError(
      { email: ['This email is already registered.'] },
      'This email is already registered.',
    )
  }
}

export async function createUser(data) {
  const email = String(data.email).trim().toLowerCase()
  await assertEmailFree(email)

  return prisma.user.create({
    data: {
      name: data.name,
      username: data.username || null,
      email,
      phone: data.phone || null,
      password: await hashPassword(data.password),
      role: data.role ?? ROLES.CUSTOMER,
      isActive: data.is_active === undefined ? true : Boolean(data.is_active),
      loginProvider: 'email',
    },
    select: USER_SELECT,
  })
}

export async function updateUser(id, data) {
  await findUser(id)

  const update = {
    name: data.name,
    username: data.username || null,
    phone: data.phone || null,
  }

  if (data.email) {
    const email = String(data.email).trim().toLowerCase()
    await assertEmailFree(email, id)
    update.email = email
  }
  if (data.role) update.role = data.role
  if (data.is_active !== undefined) update.isActive = Boolean(data.is_active)

  // An admin resetting a password does NOT need the current one — they are acting on
  // another account, not their own.
  if (data.password) update.password = await hashPassword(data.password)

  return prisma.user.update({ where: { id: BigInt(id) }, data: update, select: USER_SELECT })
}

/**
 * Delete a user.
 *
 * An admin may not delete their own account — doing so would end their session mid-request
 * and can leave the panel with no administrator at all.
 */
export async function deleteUser(id, actingUserId) {
  if (String(id) === String(actingUserId)) {
    throw new ForbiddenError('You cannot delete your own account.')
  }
  await findUser(id)
  await prisma.user.delete({ where: { id: BigInt(id) } })
}

export async function toggleUser(id, actingUserId) {
  if (String(id) === String(actingUserId)) {
    throw new ForbiddenError('You cannot deactivate your own account.')
  }
  const user = await findUser(id)
  const updated = await prisma.user.update({
    where: { id: BigInt(id) },
    data: { isActive: !user.isActive },
    select: USER_SELECT,
  })
  return updated.isActive
}

export async function bulkUserAction(action, ids, actingUserId) {
  // Self is always excluded, so a bulk action can never lock the acting admin out.
  const keys = ids.map((id) => BigInt(id)).filter((id) => String(id) !== String(actingUserId))

  switch (action) {
    case 'enable':
      await prisma.user.updateMany({ where: { id: { in: keys } }, data: { isActive: true } })
      return `${keys.length} user(s) enabled.`
    case 'disable':
      await prisma.user.updateMany({ where: { id: { in: keys } }, data: { isActive: false } })
      return `${keys.length} user(s) disabled.`
    case 'delete':
      await prisma.user.deleteMany({ where: { id: { in: keys } } })
      return `${keys.length} user(s) deleted.`
    default:
      throw new ValidationError({ action: ['Unknown action.'] }, 'Unknown action.')
  }
}

// ══════════════════════════════════════════════ banners

const BANNER_INCLUDE = { images: { orderBy: { sortOrder: 'asc' } } }

export async function listBanners({ section = null } = {}) {
  return prisma.banner.findMany({
    where: section ? { section } : {},
    include: BANNER_INCLUDE,
    orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
  })
}

export async function findBanner(id) {
  const banner = await prisma.banner.findUnique({
    where: { id: BigInt(id) },
    include: BANNER_INCLUDE,
  })
  if (!banner) throw new NotFoundError('Banner not found.')
  return banner
}

const bannerScalars = (data) => ({
  title: data.title,
  section: data.section,
  subtitle: data.subtitle ?? null,
  description: data.description ?? null,
  buttonText: data.button_text ?? null,
  buttonLink: data.button_link ?? null,
  buttonText2: data.button_text_2 ?? null,
  buttonLink2: data.button_link_2 ?? null,
  isActive: data.is_active === undefined ? true : Boolean(data.is_active),
  sortOrder: Number(data.sort_order ?? 0),
})

export async function createBanner(data, files = {}) {
  const banner = await prisma.banner.create({ data: bannerScalars(data) })
  await syncBannerImages(banner.id, data, files)
  return findBanner(banner.id)
}

export async function updateBanner(id, data, files = {}) {
  await findBanner(id)
  await prisma.banner.update({ where: { id: BigInt(id) }, data: bannerScalars(data) })
  await syncBannerImages(BigInt(id), data, files)
  return findBanner(id)
}

/** Add uploaded slides and drop any the admin removed. */
async function syncBannerImages(bannerId, data, files) {
  const removeIds = (data.remove_images ?? []).map((v) => BigInt(v))

  if (removeIds.length) {
    const doomed = await prisma.bannerImage.findMany({
      where: { id: { in: removeIds }, bannerId },
    })
    await prisma.bannerImage.deleteMany({ where: { id: { in: doomed.map((d) => d.id) } } })
    doomed.forEach((d) => {
      remove(d.image)
      if (d.mobileImage) remove(d.mobileImage)
    })
  }

  const uploads = files.images ?? []
  if (uploads.length) {
    const last = await prisma.bannerImage.findFirst({
      where: { bannerId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })
    let sortOrder = (last?.sortOrder ?? -1) + 1

    for (const file of uploads) {
      await prisma.bannerImage.create({
        data: {
          bannerId,
          image: persist(file, UPLOAD_DIRS.banners),
          isActive: true,
          sortOrder: sortOrder++,
        },
      })
    }
  }
}

export async function deleteBanner(id) {
  const banner = await findBanner(id)
  await prisma.banner.delete({ where: { id: banner.id } })
  banner.images.forEach((image) => {
    remove(image.image)
    if (image.mobileImage) remove(image.mobileImage)
  })
}

export async function toggleBanner(id) {
  const banner = await findBanner(id)
  const updated = await prisma.banner.update({
    where: { id: banner.id },
    data: { isActive: !banner.isActive },
  })
  return updated.isActive
}

// ══════════════════════════════════════════════ home sections

export async function getHomeSection(section = 'shop_the_look') {
  return prisma.homeSectionProduct.findMany({
    where: { section },
    orderBy: { position: 'asc' },
    include: {
      product: { select: { id: true, title: true, slug: true, featuredImage: true } },
    },
  })
}

/**
 * Replace a home section's product list.
 *
 * `(section, position)` is UNIQUE, so the old rows are removed before the new ones are
 * written — inside one transaction, or a partial failure leaves the section empty.
 */
export async function updateHomeSection(section, productIds = []) {
  return prisma.$transaction(async (tx) => {
    await tx.homeSectionProduct.deleteMany({ where: { section } })

    for (const [index, productId] of productIds.entries()) {
      await tx.homeSectionProduct.create({
        data: { section, productId: BigInt(productId), position: index + 1 },
      })
    }

    return tx.homeSectionProduct.findMany({ where: { section }, orderBy: { position: 'asc' } })
  })
}

// ══════════════════════════════════════════════ coupons

export async function listCoupons({ search = '', page = 1, perPage = 20 } = {}) {
  const term = String(search ?? '').trim()
  const where = term ? { code: { contains: term } } : {}

  const take = Math.min(Math.max(1, perPage), 100)
  const currentPage = Math.max(1, page)

  const [total, items] = await prisma.$transaction([
    prisma.coupon.count({ where }),
    prisma.coupon.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (currentPage - 1) * take,
      take,
    }),
  ])

  return {
    items,
    pagination: { page: currentPage, perPage: take, total, lastPage: Math.max(1, Math.ceil(total / take)) },
  }
}

export async function findCoupon(id) {
  const coupon = await prisma.coupon.findUnique({
    where: { id: BigInt(id) },
    include: {
      redemptions: {
        orderBy: { id: 'desc' },
        take: 50,
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  })
  if (!coupon) throw new NotFoundError('Coupon not found.')
  return coupon
}

function couponScalars(data) {
  return {
    code: String(data.code).trim().toUpperCase(),
    offerType: data.offer_type ?? 'coupon',
    description: data.description ?? null,
    discountType: data.discount_type ?? 'percent',
    discountPercent: data.discount_percent == null ? null : toDecimal(data.discount_percent),
    discountAmount: data.discount_amount == null ? null : toDecimal(data.discount_amount),
    maxDiscountStatus: Boolean(data.max_discount_status),
    maxDiscountAmount: data.max_discount_amount == null ? null : toDecimal(data.max_discount_amount),
    minCartStatus: Boolean(data.min_cart_status),
    minCartAmount: data.min_cart_amount == null ? null : toDecimal(data.min_cart_amount),
    appliesTo: data.applies_to ?? 'all',
    categoryIds: stringifyJsonColumn(data.category_ids ?? null),
    productIds: stringifyJsonColumn(data.product_ids ?? null),
    minQuantity: data.min_quantity == null ? null : Number(data.min_quantity),
    bogoBuyQuantity: data.bogo_buy_quantity == null ? null : Number(data.bogo_buy_quantity),
    bogoGetQuantity: data.bogo_get_quantity == null ? null : Number(data.bogo_get_quantity),
    newCustomersOnly: Boolean(data.new_customers_only),
    membersOnly: Boolean(data.members_only),
    freeShipping: Boolean(data.free_shipping),
    prepaidOnly: Boolean(data.prepaid_only),
    startsAt: data.starts_at ? new Date(data.starts_at) : null,
    endsAt: data.ends_at ? new Date(data.ends_at) : null,
    usageLimit: data.usage_limit == null ? null : Number(data.usage_limit),
    maxUsePerUser: Boolean(data.max_use_per_user),
    isActive: data.is_active === undefined ? true : Boolean(data.is_active),
    isPublic: data.is_public === undefined ? true : Boolean(data.is_public),
  }
}

async function assertCodeFree(code, ignoreId = null) {
  const clash = await prisma.coupon.findFirst({
    where: { code, ...(ignoreId ? { NOT: { id: BigInt(ignoreId) } } : {}) },
    select: { id: true },
  })
  if (clash) {
    throw new ValidationError(
      { code: ['This coupon code already exists.'] },
      'This coupon code already exists.',
    )
  }
}

export async function createCoupon(data, file = null) {
  const scalars = couponScalars(data)
  await assertCodeFree(scalars.code)
  if (file) scalars.image = persist(file, UPLOAD_DIRS.coupons)

  return prisma.coupon.create({ data: scalars })
}

export async function updateCoupon(id, data, file = null) {
  const existing = await prisma.coupon.findUnique({ where: { id: BigInt(id) } })
  if (!existing) throw new NotFoundError('Coupon not found.')

  const scalars = couponScalars(data)
  await assertCodeFree(scalars.code, id)

  if (file) {
    scalars.image = persist(file, UPLOAD_DIRS.coupons)
    if (existing.image) remove(existing.image)
  }

  // `used_count` is never writable from the admin form — it is derived from redemptions,
  // and editing it would break usage_limit enforcement.
  return prisma.coupon.update({ where: { id: BigInt(id) }, data: scalars })
}

export async function deleteCoupon(id) {
  const coupon = await prisma.coupon.findUnique({ where: { id: BigInt(id) } })
  if (!coupon) throw new NotFoundError('Coupon not found.')

  await prisma.coupon.delete({ where: { id: coupon.id } })
  if (coupon.image) remove(coupon.image)
}

export async function toggleCoupon(id) {
  const coupon = await prisma.coupon.findUnique({ where: { id: BigInt(id) } })
  if (!coupon) throw new NotFoundError('Coupon not found.')

  const updated = await prisma.coupon.update({
    where: { id: coupon.id },
    data: { isActive: !coupon.isActive },
  })
  return updated.isActive
}

// ══════════════════════════════════════════════ contacts

export async function listSubscribers({ search = '', page = 1, perPage = 50 } = {}) {
  const term = String(search ?? '').trim()
  const where = term ? { email: { contains: term } } : {}

  const take = Math.min(Math.max(1, perPage), 200)
  const currentPage = Math.max(1, page)

  const [total, items] = await prisma.$transaction([
    prisma.subscriber.count({ where }),
    prisma.subscriber.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (currentPage - 1) * take,
      take,
    }),
  ])

  return {
    items,
    pagination: { page: currentPage, perPage: take, total, lastPage: Math.max(1, Math.ceil(total / take)) },
  }
}

export async function listContactMessages({ search = '', page = 1, perPage = 25 } = {}) {
  const term = String(search ?? '').trim()
  const where = term
    ? {
        OR: [
          { name: { contains: term } },
          { email: { contains: term } },
          { subject: { contains: term } },
        ],
      }
    : {}

  const take = Math.min(Math.max(1, perPage), 100)
  const currentPage = Math.max(1, page)

  const [total, items] = await prisma.$transaction([
    prisma.contactMessage.count({ where }),
    prisma.contactMessage.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (currentPage - 1) * take,
      take,
    }),
  ])

  return {
    items,
    pagination: { page: currentPage, perPage: take, total, lastPage: Math.max(1, Math.ceil(total / take)) },
  }
}

export const deleteSubscriber = async (id) => {
  await prisma.subscriber.delete({ where: { id: BigInt(id) } }).catch(() => {
    throw new NotFoundError('Subscriber not found.')
  })
}

export const deleteContactMessage = async (id) => {
  await prisma.contactMessage.delete({ where: { id: BigInt(id) } }).catch(() => {
    throw new NotFoundError('Message not found.')
  })
}

export async function bulkDeleteSubscribers(ids) {
  const result = await prisma.subscriber.deleteMany({
    where: { id: { in: ids.map((id) => BigInt(id)) } },
  })
  return `${result.count} subscriber(s) deleted.`
}

export async function bulkDeleteContactMessages(ids) {
  const result = await prisma.contactMessage.deleteMany({
    where: { id: { in: ids.map((id) => BigInt(id)) } },
  })
  return `${result.count} message(s) deleted.`
}

// ══════════════════════════════════════════════ settings

export async function listSitePages() {
  const pages = await prisma.page.findMany({ orderBy: { id: 'asc' } })

  // Laravel's PageSettingController::ensurePages seeded any missing row on load. Reported
  // rather than written, so a GET stays a read.
  const existing = new Set(pages.map((p) => p.slug))
  const missing = Object.entries(SITE_PAGES)
    .filter(([slug]) => !existing.has(slug))
    .map(([slug, title]) => ({ slug, title, content: null, missing: true }))

  return [...pages, ...missing]
}

export async function updateSitePage(slug, data) {
  if (!isValidSitePage(slug)) throw new NotFoundError('Page not found.')

  return prisma.page.upsert({
    where: { slug },
    create: {
      slug,
      title: data.title ?? SITE_PAGES[slug],
      content: data.content ?? null,
      isActive: true,
    },
    update: {
      ...(data.title ? { title: data.title } : {}),
      content: data.content ?? null,
      ...(data.is_active === undefined ? {} : { isActive: Boolean(data.is_active) }),
    },
  })
}

export async function getShippingSettings() {
  const row = await prisma.shippingSetting.findFirst({ orderBy: { id: 'asc' } })
  return {
    id: row?.id ?? null,
    freeShippingThreshold: row ? toNumber(row.freeShippingThreshold) : 899,
    flatShippingRate: row ? toNumber(row.flatShippingRate) : 60,
  }
}

/** Single-row settings table — update the existing row, or seed it on first save. */
export async function updateShippingSettings(data) {
  const existing = await prisma.shippingSetting.findFirst({ orderBy: { id: 'asc' } })

  const payload = {
    freeShippingThreshold: toDecimal(data.free_shipping_threshold),
    flatShippingRate: toDecimal(data.flat_shipping_rate),
  }

  const row = existing
    ? await prisma.shippingSetting.update({ where: { id: existing.id }, data: payload })
    : await prisma.shippingSetting.create({ data: payload })

  return {
    id: row.id,
    freeShippingThreshold: toNumber(row.freeShippingThreshold),
    flatShippingRate: toNumber(row.flatShippingRate),
  }
}

export default {
  listUsers,
  findUser,
  createUser,
  updateUser,
  deleteUser,
  toggleUser,
  bulkUserAction,
  listBanners,
  findBanner,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBanner,
  getHomeSection,
  updateHomeSection,
  listCoupons,
  findCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCoupon,
  listSubscribers,
  listContactMessages,
  deleteSubscriber,
  deleteContactMessage,
  bulkDeleteSubscribers,
  bulkDeleteContactMessages,
  listSitePages,
  updateSitePage,
  getShippingSettings,
  updateShippingSettings,
}
