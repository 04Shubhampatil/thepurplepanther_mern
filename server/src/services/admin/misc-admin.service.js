import prisma from '../../config/database.js'
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/api-error.js'
import { hashPassword } from '../../utils/password.js'
import { toDecimal, toNumber } from '../../utils/money.js'
import { stringifyJsonColumn } from '../../utils/json.js'
import { persist, remove, UPLOAD_DIRS, BANNER_VIDEO_MIME } from '../upload.service.js'
import { isValidSitePage, SITE_PAGES } from '../../constants/cms.js'
import { COUPON_OFFER_TYPE_LABELS } from '../../constants/coupons.js'
import { ROLES } from '../../constants/roles.js'
import { statusLabel, statusBadgeClass } from '../../constants/order-statuses.js'

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
  // The list shows both: `platform` is its own column, and `avatar` feeds the row's
  // circle — `avatar_url` is an accessor, so the fallback is resolved on the client.
  platform: true,
  avatar: true,
}

/** `UserController::sortParams` — an unknown column falls back rather than erroring. */
const USER_SORTS = {
  platform: 'platform',
  name: 'name',
  email: 'email',
  created_at: 'createdAt',
  is_active: 'isActive',
}

export async function listUsers({
  search = '',
  role = null,
  page = 1,
  perPage = 10,
  sort = 'created_at',
  dir = 'desc',
} = {}) {
  const term = String(search ?? '').trim()

  const where = {
    ...(role ? { role } : {}),
    ...(term
      ? {
          OR: [
            { name: { contains: term } },
            { email: { contains: term } },
            { phone: { contains: term } },
            // The controller searches `platform`, not `username` — the list has a Platform
            // column and no username one.
            { platform: { contains: term } },
          ],
        }
      : {}),
  }

  const take = Math.min(Math.max(1, perPage), 100)
  const currentPage = Math.max(1, page)
  const column = USER_SORTS[sort] ?? 'createdAt'
  const direction = String(dir).toLowerCase() === 'asc' ? 'asc' : 'desc'

  const [total, items] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: USER_SELECT, // never selects the password hash
      // `->orderBy($sort, $dir)->orderBy('id', 'desc')` — the id keeps the order stable
      // when the sorted column ties, which it does on every same-day registration.
      orderBy: [{ [column]: direction }, { id: 'desc' }],
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

/**
 * `UserController::show` — the user plus ONE tab's worth of data.
 *
 * Only the active tab is queried, as Laravel queried it: a customer with hundreds of orders
 * should not pay for their wishlist, cart and reviews to render a page that shows none of
 * them. The tab is therefore part of the request, not a client-side filter over one big
 * payload.
 *
 * Sorting on a related column (product title, price) orders by the RELATION in Prisma —
 * Laravel reached the same columns through a leftJoin. Both order by the product's row, not
 * by the pivot's.
 */
/**
 * Admin\ProfileController::update — the signed-in admin editing their OWN row.
 *
 * Separate from `updateUser` because that one is the CUSTOMER screen: it pins the role,
 * refuses a non-customer, and has no username field. This one edits an administrator and
 * must not do any of that.
 *
 * `username` is UNIQUE alongside `email`, and both ignore the current row — an admin saving
 * without changing either would otherwise clash with themselves.
 */
export async function updateAdminProfile(userId, data, file = null) {
  const id = BigInt(userId)
  const email = String(data.email).trim().toLowerCase()
  const username = String(data.username).trim()

  const [emailClash, usernameClash] = await Promise.all([
    prisma.user.findFirst({ where: { email, NOT: { id } }, select: { id: true } }),
    prisma.user.findFirst({ where: { username, NOT: { id } }, select: { id: true } }),
  ])

  if (usernameClash) {
    throw new ValidationError(
      { username: ['This username is already taken.'] },
      'This username is already taken.',
    )
  }
  if (emailClash) {
    throw new ValidationError({ email: ['This email is already taken.'] }, 'This email is already taken.')
  }

  const existing = await prisma.user.findUnique({ where: { id }, select: { avatar: true } })

  const update = {
    name: data.name,
    username,
    email,
    phone: data.phone || null,
  }

  // Blank keeps the current password; the form says so under the field.
  if (data.password) update.password = await hashPassword(data.password)

  if (file) {
    update.avatar = persist(file, UPLOAD_DIRS.users)
    if (existing?.avatar) remove(existing.avatar)
  }

  return prisma.user.update({ where: { id }, data: update, select: USER_SELECT })
}

export async function findUserDetail(id, { tab = 'wishlist', q = '', page = 1, perPage = 10, sort = 'created_at', dir = 'desc' } = {}) {
  const user = await findUser(id)

  /*
   * `ensureCustomer` — UserController aborts with a 404 on any non-customer, and every
   * method of that controller calls it. The admin's own account is not a customer record,
   * and the tabs below would query an empty wishlist and cart for it while showing the
   * admin's email on a customer detail page.
   */
  if (user.role !== ROLES.CUSTOMER) throw new NotFoundError('User not found.')

  const userId = BigInt(id)
  const term = String(q ?? '').trim()
  const take = Math.min(Math.max(1, perPage), 100)
  const currentPage = Math.max(1, page)
  const skip = (currentPage - 1) * take
  const direction = String(dir).toLowerCase() === 'asc' ? 'asc' : 'desc'

  const paginate = (total, items) => ({
    items,
    pagination: { page: currentPage, perPage: take, total, lastPage: Math.max(1, Math.ceil(total / take)) },
  })

  const PRODUCT_SELECT = { select: { id: true, title: true, featuredImage: true, sellingPrice: true } }

  if (tab === 'profile') {
    const [addresses, bankAccounts] = await Promise.all([
      prisma.userAddress.findMany({ where: { userId }, orderBy: { id: 'desc' } }),
      prisma.userBankAccount.findMany({ where: { userId }, orderBy: { id: 'desc' } }),
    ])
    return { user, tab, addresses, bankAccounts }
  }

  if (tab === 'cart') {
    const where = {
      userId,
      ...(term ? { product: { title: { contains: term } } } : {}),
    }
    const orderBy =
      sort === 'product'
        ? { product: { title: direction } }
        : sort === 'price' || sort === 'total'
          ? { product: { sellingPrice: direction } }
          : sort === 'quantity'
            ? { quantity: direction }
            : { createdAt: direction }

    const [total, items] = await prisma.$transaction([
      prisma.cartItem.count({ where }),
      prisma.cartItem.findMany({ where, include: { product: PRODUCT_SELECT }, orderBy, skip, take }),
    ])
    return { user, tab, cart: paginate(total, items) }
  }

  if (tab === 'orders') {
    const where = {
      userId,
      ...(term
        ? {
            OR: [
              { orderNumber: { contains: term } },
              { userName: { contains: term } },
              { userPhone: { contains: term } },
              { status: { contains: term } },
            ],
          }
        : {}),
    }
    const columns = {
      order_number: 'orderNumber',
      user_name: 'userName',
      user_phone: 'userPhone',
      payable_amount: 'payableAmount',
      ordered_at: 'orderedAt',
      status: 'status',
    }

    const [total, rows] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: [{ [columns[sort] ?? 'orderedAt']: direction }, { id: 'desc' }],
        skip,
        take,
      }),
    ])

    return {
      user,
      tab,
      orders: paginate(
        total,
        rows.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          userName: order.userName,
          userPhone: order.userPhone,
          payableAmount: toNumber(order.payableAmount),
          orderedAt: order.orderedAt ?? order.createdAt,
          status: order.status,
          statusLabel: statusLabel(order.status),
          statusBadgeClass: statusBadgeClass(order.status),
        })),
      ),
    }
  }

  if (tab === 'reviews') {
    const where = {
      userId,
      ...(term
        ? {
            OR: [
              { comment: { contains: term } },
              { reviewerName: { contains: term } },
              { product: { title: { contains: term } } },
            ],
          }
        : {}),
    }
    const orderBy =
      sort === 'product'
        ? { product: { title: direction } }
        : sort === 'rating'
          ? { rating: direction }
          : sort === 'comment'
            ? { comment: direction }
            : { createdAt: direction }

    const [total, items] = await prisma.$transaction([
      prisma.productReview.count({ where }),
      prisma.productReview.findMany({ where, include: { product: PRODUCT_SELECT }, orderBy, skip, take }),
    ])
    return { user, tab, reviews: paginate(total, items) }
  }

  // wishlist — the default tab
  const where = {
    userId,
    ...(term ? { product: { title: { contains: term } } } : {}),
  }
  const orderBy =
    sort === 'product'
      ? { product: { title: direction } }
      : sort === 'price'
        ? { product: { sellingPrice: direction } }
        : { createdAt: direction }

  const [total, items] = await prisma.$transaction([
    prisma.wishlist.count({ where }),
    prisma.wishlist.findMany({ where, include: { product: PRODUCT_SELECT }, orderBy, skip, take }),
  ])
  return { user, tab: 'wishlist', wishlist: paginate(total, items) }
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

export async function createUser(data, file = null) {
  const email = String(data.email).trim().toLowerCase()
  await assertEmailFree(email)

  return prisma.user.create({
    data: {
      name: data.name,
      username: data.username || null,
      email,
      phone: data.phone || null,
      password: await hashPassword(data.password),
      /*
       * `UserController::store` hard-codes these three — it is the CUSTOMER screen, and the
       * form has no role field. Taking the role from the request would let a POST to this
       * endpoint mint an administrator.
       */
      role: ROLES.CUSTOMER,
      isActive: true,
      loginProvider: 'email',
      platform: data.platform || 'Web',
      ...(file ? { avatar: persist(file, UPLOAD_DIRS.users) } : {}),
    },
    select: USER_SELECT,
  })
}

export async function updateUser(id, data, file = null) {
  const existing = await findUser(id)

  // `ensureCustomer` — the customer screens refuse any other role outright.
  if (existing.role !== ROLES.CUSTOMER) throw new NotFoundError('User not found.')

  const update = {
    name: data.name,
    username: data.username || null,
    phone: data.phone || null,
    ...(data.platform ? { platform: data.platform } : {}),
  }

  if (file) {
    update.avatar = persist(file, UPLOAD_DIRS.users)
    // Write the new file first, then drop the old one — the other order leaves the row
    // pointing at nothing if the write fails.
    if (existing.avatar) remove(existing.avatar)
  }

  if (data.email) {
    const email = String(data.email).trim().toLowerCase()
    await assertEmailFree(email, id)
    update.email = email
  }
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

/**
 * BannerController's per-file closure: a video is only allowed on Home — Main Hero.
 *
 * Checked before anything is written, so a rejected upload leaves neither a row nor a file
 * behind — the multer filter cannot do this itself, because `section` is a sibling field
 * and only reaches `req.body` if the client happened to send it before the files.
 */
function assertVideosAllowed(section, files) {
  if (section === 'home_hero') return

  const video = (files.images ?? []).find((file) => BANNER_VIDEO_MIME.has(file.mimetype))
  if (video) {
    throw new ValidationError({
      images: ['Videos can only be uploaded to the Home — Main Hero section.'],
    })
  }
}

export async function createBanner(data, files = {}) {
  assertVideosAllowed(data.section, files)

  const banner = await prisma.banner.create({ data: bannerScalars(data) })
  await syncBannerImages(banner.id, data, files)
  return findBanner(banner.id)
}

export async function updateBanner(id, data, files = {}) {
  assertVideosAllowed(data.section, files)

  await findBanner(id)
  await prisma.banner.update({ where: { id: BigInt(id) }, data: bannerScalars(data) })
  await syncBannerImages(BigInt(id), data, files)
  return findBanner(id)
}

/** `null` for a blank string, so clearing a field in the form actually clears the column. */
const slideText = (value) => {
  const text = value == null ? '' : String(value).trim()
  return text === '' ? null : text
}

/**
 * Drop removed slides, re-save the metadata of the ones that stayed, then add the uploads.
 *
 * Mirrors BannerController::deleteImages + updateExistingImages + storeImages. The ordering
 * differs from Laravel's only in that removals happen first, which saves a write to a row
 * that is about to disappear; the end state is the same.
 *
 * The two metadata shapes are not interchangeable. `existing_*` are maps keyed by
 * banner_images.id — the slide already has one. `image_*` are POSITIONAL arrays, because a
 * file being uploaded has no id yet and index i simply describes the i-th file.
 */
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

  await updateExistingSlides(bannerId, data)

  const uploads = files.images ?? []
  if (uploads.length) {
    const last = await prisma.bannerImage.findFirst({
      where: { bannerId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })
    let sortOrder = (last?.sortOrder ?? -1) + 1

    const titles = data.image_titles ?? []
    const subtitles = data.image_subtitles ?? []
    const buttonTexts = data.image_button_texts ?? []
    const buttonLinks = data.image_button_links ?? []

    for (const [index, file] of uploads.entries()) {
      await prisma.bannerImage.create({
        data: {
          bannerId,
          image: persist(file, UPLOAD_DIRS.banners),
          title: slideText(titles[index]),
          subtitle: slideText(subtitles[index]),
          buttonText: slideText(buttonTexts[index]),
          buttonLink: slideText(buttonLinks[index]),
          isActive: true,
          sortOrder: sortOrder++,
        },
      })
    }
  }
}

/**
 * Laravel skipped any slide the form did not mention (`array_key_exists`), so a partial
 * submit left the rest alone. The same guard is kept here: only ids present in one of the
 * maps are written, and a key that is absent from a given map falls back to the stored
 * value rather than to null.
 */
async function updateExistingSlides(bannerId, data) {
  const titles = data.existing_titles ?? {}
  const subtitles = data.existing_subtitles ?? {}
  const buttonTexts = data.existing_button_texts ?? {}
  const buttonLinks = data.existing_button_links ?? {}
  const sorts = data.existing_sort ?? {}

  const ids = new Set(
    [titles, subtitles, buttonTexts, buttonLinks, sorts].flatMap((map) => Object.keys(map)),
  )
  if (!ids.size) return

  const slides = await prisma.bannerImage.findMany({
    where: { bannerId, id: { in: [...ids].map((id) => BigInt(id)) } },
  })

  for (const slide of slides) {
    const key = String(slide.id)
    const sort = sorts[key]

    await prisma.bannerImage.update({
      where: { id: slide.id },
      data: {
        title: key in titles ? slideText(titles[key]) : slide.title,
        subtitle: key in subtitles ? slideText(subtitles[key]) : slide.subtitle,
        buttonText: key in buttonTexts ? slideText(buttonTexts[key]) : slide.buttonText,
        buttonLink: key in buttonLinks ? slideText(buttonLinks[key]) : slide.buttonLink,
        sortOrder: sort === undefined || sort === '' ? slide.sortOrder : Number(sort) || 0,
      },
    })
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

/*
 * `paginate(9)`, so the grid fills three rows of three at the widest breakpoint. The search
 * spans five columns in CouponController — code, description, offer type and both discount
 * figures — not just the code, which is what lets "10" find FLAT10 and the 10% coupons alike.
 */
export async function listCoupons({ search = '', page = 1, perPage = 9 } = {}) {
  const term = String(search ?? '').trim()
  const where = term
    ? {
        OR: [
          { code: { contains: term } },
          { description: { contains: term } },
          { offerType: { contains: term } },
          ...(Number.isNaN(Number(term))
            ? []
            : [{ discountPercent: Number(term) }, { discountAmount: Number(term) }]),
        ],
      }
    : {}

  const take = Math.min(Math.max(1, perPage), 100)
  const currentPage = Math.max(1, page)

  const [total, items] = await prisma.$transaction([
    prisma.coupon.count({ where }),
    prisma.coupon.findMany({
      where,
      // CouponController::index is a bare `latest()` — created_at descending. Ordering
      // by id instead reversed the coupons that share a timestamp.
      orderBy: { createdAt: 'desc' },
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

/**
 * The tail of `CouponController::validated` — the part that runs AFTER validation passes.
 *
 * It is not a straight field copy, and the conditionals are the point: a field the form
 * hid must be stored as null rather than as whatever the browser last held, or a coupon
 * keeps applying a rule its own edit screen no longer shows. So BOGO clears both discount
 * figures and the cap; the cap survives only alongside a PERCENT discount; the cart minimum
 * survives only with its status on; and the id lists are kept only for the `applies_to`
 * that uses them.
 *
 * `discount_type` is derived here for the same reason — it is not a form field, and letting
 * a client send it lets it disagree with the figure actually stored.
 */
function couponScalars(data) {
  const isBogo = data.offer_type === 'bogo'
  const percent = data.discount_percent == null ? null : Number(data.discount_percent)
  const amount = data.discount_amount == null ? null : Number(data.discount_amount)
  const maxDiscountStatus = !isBogo && Boolean(data.max_discount_status)
  const minCartStatus = Boolean(data.min_cart_status)
  const appliesTo = data.applies_to ?? 'all'

  return {
    code: String(data.code).trim().toUpperCase(),
    offerType: data.offer_type ?? 'coupon',
    description: data.description ?? null,
    discountType: percent !== null ? 'percent' : 'amount',
    discountPercent: isBogo || percent === null ? null : toDecimal(percent),
    discountAmount: isBogo || amount === null ? null : toDecimal(amount),
    maxDiscountStatus,
    maxDiscountAmount:
      maxDiscountStatus && percent !== null && data.max_discount_amount != null
        ? toDecimal(data.max_discount_amount)
        : null,
    minCartStatus,
    minCartAmount:
      minCartStatus && data.min_cart_amount != null ? toDecimal(data.min_cart_amount) : null,
    appliesTo,
    categoryIds:
      appliesTo === 'categories'
        ? stringifyJsonColumn((data.category_ids ?? []).map(Number))
        : null,
    productIds:
      appliesTo === 'products' ? stringifyJsonColumn((data.product_ids ?? []).map(Number)) : null,
    minQuantity: data.min_quantity == null ? null : Number(data.min_quantity),
    bogoBuyQuantity: isBogo && data.bogo_buy_quantity != null ? Number(data.bogo_buy_quantity) : null,
    bogoGetQuantity: isBogo && data.bogo_get_quantity != null ? Number(data.bogo_get_quantity) : null,
    newCustomersOnly: Boolean(data.new_customers_only),
    membersOnly: Boolean(data.members_only),
    freeShipping: Boolean(data.free_shipping),
    prepaidOnly: Boolean(data.prepaid_only),
    // Wall clocks from `datetime-local`, stored as typed — see utils/admin-date.js on the
    // client for the other half of this.
    startsAt: wallClockDate(data.starts_at),
    endsAt: wallClockDate(data.ends_at),
    usageLimit: data.usage_limit == null ? null : Number(data.usage_limit),
    maxUsePerUser: Boolean(data.max_use_per_user),
    isActive: data.is_active === undefined ? true : Boolean(data.is_active),
    isPublic: data.is_public === undefined ? true : Boolean(data.is_public),
  }
}

/**
 * "2026-08-09T20:27" is a wall clock with no zone. Read as local it would be written back
 * shifted by the server's offset, so the Z is appended to store the digits the admin typed
 * — the same treatment blogPostSchema gives `published_at`.
 */
function wallClockDate(value) {
  if (!value) return null
  const text = String(value)
  const bare = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(text)
  const date = new Date(bare ? `${text}${text.length === 16 ? ':00' : ''}Z` : text)
  return Number.isNaN(date.getTime()) ? null : date
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

/**
 * `CouponController::formData` — every category and product, id and title only, ordered by
 * title. Unpaginated on purpose: these fill the form's two multi-selects, and a page of ten
 * would silently hide the rest.
 */
export async function couponFormData() {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({ select: { id: true, title: true }, orderBy: { title: 'asc' } }),
    prisma.product.findMany({ select: { id: true, title: true }, orderBy: { title: 'asc' } }),
  ])

  return { offerTypes: COUPON_OFFER_TYPE_LABELS, categories, products }
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

/** Both contact tables sort on their own columns; an unknown one falls back to the date. */
const SUBSCRIBER_SORTS = { email: 'email', created_at: 'createdAt' }
const MESSAGE_SORTS = {
  name: 'name',
  email: 'email',
  subject: 'subject',
  message: 'message',
  created_at: 'createdAt',
}

const sortClause = (map, sort, dir, fallback = 'createdAt') => [
  { [map[sort] ?? fallback]: String(dir).toLowerCase() === 'asc' ? 'asc' : 'desc' },
  { id: 'desc' },
]

export async function listSubscribers({
  search = '',
  page = 1,
  perPage = 10,
  sort = 'created_at',
  dir = 'desc',
} = {}) {
  const term = String(search ?? '').trim()
  const where = term ? { email: { contains: term } } : {}

  const take = Math.min(Math.max(1, perPage), 200)
  const currentPage = Math.max(1, page)

  const [total, items] = await prisma.$transaction([
    prisma.subscriber.count({ where }),
    prisma.subscriber.findMany({
      where,
      orderBy: sortClause(SUBSCRIBER_SORTS, sort, dir),
      skip: (currentPage - 1) * take,
      take,
    }),
  ])

  return {
    items,
    pagination: { page: currentPage, perPage: take, total, lastPage: Math.max(1, Math.ceil(total / take)) },
  }
}

export async function listContactMessages({
  search = '',
  page = 1,
  perPage = 10,
  sort = 'created_at',
  dir = 'desc',
} = {}) {
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
      orderBy: sortClause(MESSAGE_SORTS, sort, dir),
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
  findUserDetail,
  updateAdminProfile,
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
  couponFormData,
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
