import prisma from '../../config/database.js'
import { createCrudService, slugify } from './crud.service.js'
import { NotFoundError, ValidationError } from '../../utils/api-error.js'
import { toDecimal, toNumber } from '../../utils/money.js'
import { stringifyJsonColumn, parseJsonArray } from '../../utils/json.js'
import { persist, persistMany, remove, removeMany, UPLOAD_DIRS } from '../upload.service.js'

/**
 * Admin catalog management.
 *
 * The simple taxonomies share the CRUD factory; products get their own service because
 * they own pivots with payload, multi-image galleries and four JSON columns.
 */

// ─────────────────────────────────────────── simple taxonomies

export const categories = createCrudService({
  model: 'category',
  label: 'Category',
  nameField: 'title',
  imageDir: UPLOAD_DIRS.categories,
  searchFields: ['title', 'slug'],
  uniqueFields: ['title'],
  uniqueMessages: { title: 'This category name already exists. Duplicate name not allowed.' },
})

export const subCategories = createCrudService({
  model: 'subCategory',
  label: 'Sub-category',
  nameField: 'title',
  imageDir: UPLOAD_DIRS.categories,
  searchFields: ['title', 'slug'],
  uniqueFields: ['title'],
  include: { category: { select: { id: true, title: true } } },
})

export const brands = createCrudService({
  model: 'brand',
  label: 'Brand',
  nameField: 'name',
  imageDir: UPLOAD_DIRS.brands,
  searchFields: ['name', 'slug'],
  uniqueFields: ['name'],
  orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
})

export const colors = createCrudService({
  model: 'color',
  label: 'Color',
  nameField: 'name',
  hasSlug: false,
  imageDir: null,
  searchFields: ['name'],
  uniqueFields: ['name'],
  orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
})

export const sizes = createCrudService({
  model: 'size',
  label: 'Size',
  nameField: 'name',
  hasSlug: false,
  imageDir: null,
  searchFields: ['name'],
  uniqueFields: ['name'],
  orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
})

export const offers = createCrudService({
  model: 'offer',
  label: 'Offer',
  nameField: 'title',
  imageDir: UPLOAD_DIRS.offers,
  searchFields: ['title', 'slug'],
  uniqueFields: ['title'],
})

export const newsTypes = createCrudService({
  model: 'newsType',
  label: 'News type',
  nameField: 'title',
  hasSlug: true,
  imageDir: null,
  searchFields: ['title', 'slug'],
  uniqueFields: [],
})

export const blogPosts = createCrudService({
  model: 'blogPost',
  label: 'Blog post',
  nameField: 'title',
  imageDir: UPLOAD_DIRS.blogPosts,
  // BlogPostController stored the wide detail banner under a nested directory.
  extraImageDirs: { bannerImage: UPLOAD_DIRS.blogPostBanners },
  searchFields: ['title', 'slug', 'authorName'],
  uniqueFields: [],
  include: { newsType: { select: { id: true, title: true } } },
  orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
})

// ─────────────────────────────────────────── products

const PRODUCT_INCLUDE = {
  category: { select: { id: true, title: true } },
  subCategory: { select: { id: true, title: true } },
  brand: { select: { id: true, name: true } },
  offer: { select: { id: true, title: true } },
  colors: { include: { color: { select: { id: true, name: true, code: true } } } },
  sizes: { include: { size: { select: { id: true, name: true } } } },
  images: { include: { color: { select: { id: true, name: true } } }, orderBy: { sortOrder: 'asc' } },
}

/** Admin product list — paginate(10), with the same filters. */
export async function listProducts({ search = '', categoryId, brandId, offerId, page = 1, perPage = 10 } = {}) {
  const term = String(search ?? '').trim()

  const where = {
    ...(categoryId ? { categoryId: BigInt(categoryId) } : {}),
    ...(brandId ? { brandId: BigInt(brandId) } : {}),
    ...(offerId ? { offerId: BigInt(offerId) } : {}),
    ...(term
      ? {
          OR: [
            { title: { contains: term } },
            { slug: { contains: term } },
            { shortDescription: { contains: term } },
          ],
        }
      : {}),
  }

  const take = Math.min(Math.max(1, perPage), 100)
  const currentPage = Math.max(1, page)

  const [total, items] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, title: true } },
        subCategory: { select: { id: true, title: true } },
        brand: { select: { id: true, name: true } },
        // `discountPercent` is needed by the listing card's badge: Product's
        // getDiscountPercentAttribute prefers the OFFER's percent and only falls back to
        // mrp/selling_price. Without it the badge silently under-reports discounted items.
        offer: { select: { id: true, title: true, discountPercent: true } },
      },
      orderBy: { id: 'desc' }, // latest()
      skip: (currentPage - 1) * take,
      take,
    }),
  ])

  return {
    items,
    pagination: {
      page: currentPage,
      perPage: take,
      total,
      lastPage: Math.max(1, Math.ceil(total / take)),
    },
  }
}

/*
 * `_count` rides along on TOP of PRODUCT_INCLUDE rather than inside it.
 *
 * `show.blade.php` loads `reviews` only to print `$product->reviews->count()` in its header,
 * so a count is all the view ever needed — pulling the rows themselves would ship every
 * review body to render one number. The two write paths share PRODUCT_INCLUDE and have no
 * use for the count, which is why it is added here and not there.
 */
export async function findProduct(id) {
  const product = await prisma.product.findUnique({
    where: { id: BigInt(id) },
    include: { ...PRODUCT_INCLUDE, _count: { select: { reviews: true } } },
  })
  if (!product) throw new NotFoundError('Product not found.')
  return product
}

/** Admin\ProductController::checkTitle — `products.title` carries a UNIQUE constraint. */
export async function isTitleAvailable(title, ignoreId = null) {
  const value = String(title ?? '').trim()
  if (value === '') return true

  const clash = await prisma.product.findFirst({
    where: { title: value, ...(ignoreId ? { NOT: { id: BigInt(ignoreId) } } : {}) },
    select: { id: true },
  })
  return !clash
}

async function assertTitleAvailable(title, ignoreId = null) {
  if (!(await isTitleAvailable(title, ignoreId))) {
    const message = 'This product title already exists. Duplicate name not allowed.'
    throw new ValidationError({ title: [message] }, message)
  }
}

/** Scalar fields shared by create and update. */
function productScalars(data) {
  const out = {
    title: data.title,
    categoryId: BigInt(data.category_id),
    subCategoryId: data.sub_category_id ? BigInt(data.sub_category_id) : null,
    brandId: data.brand_id ? BigInt(data.brand_id) : null,
    offerId: data.offer_id ? BigInt(data.offer_id) : null,
    shortDescription: data.short_description ?? null,
    features: data.features ?? null,
    mrp: toDecimal(data.mrp),
    sellingPrice: toDecimal(data.selling_price ?? 0),
    maxUnitBuy: Number(data.max_unit_buy ?? 1),
    deliveryCharge: toDecimal(data.delivery_charge ?? 0),
    seoTitle: data.seo_title ?? null,
    metaDescription: data.meta_description ?? null,
    metaKeywords: data.meta_keywords ?? null,
    showSizeGuide: Boolean(data.show_size_guide),
    sizeGuideContent: data.size_guide_content ?? null,
    highlightsShortDescription: data.highlights_short_description ?? null,
    sortOrder: Number(data.sort_order ?? 0),
  }

  for (const [key, field] of [
    ['is_active', 'isActive'],
    ['is_featured', 'isFeatured'],
    ['is_todays_deal', 'isTodaysDeal'],
    ['is_popular_accessory', 'isPopularAccessory'],
    ['is_new_arrival', 'isNewArrival'],
  ]) {
    if (data[key] !== undefined) out[field] = Boolean(data[key])
  }

  // JSON-in-longtext columns. Written with the same encode/decode Laravel's 'array' cast
  // used, so both applications read them identically.
  for (const [key, field] of [
    ['highlights_items', 'highlightsItems'],
    ['information_items', 'informationItems'],
    ['specifications', 'specifications'],
    ['accessory_packages', 'accessoryPackages'],
  ]) {
    if (data[key] !== undefined) out[field] = stringifyJsonColumn(data[key])
  }

  return out
}

/**
 * Sync the colour/size pivots.
 *
 * CRITICAL: this must be a delete-missing / upsert-present pass, NOT delete-all +
 * recreate. `product_color.quantity` and `product_size.quantity` are the per-variant
 * stock the cart reads — wiping and recreating them would zero live inventory on every
 * product save.
 */
async function syncPivot(tx, { table, productId, foreignKey, entries }) {
  if (!entries) return

  const wanted = new Map(
    entries
      .filter((e) => e?.id !== undefined && e.id !== null && e.id !== '')
      .map((e) => [String(e.id), Math.max(0, Number(e.quantity ?? 0))]),
  )

  const existing = await tx[table].findMany({ where: { productId } })

  for (const row of existing) {
    const key = String(row[foreignKey])
    if (!wanted.has(key)) {
      await tx[table].delete({ where: { id: row.id } })
      continue
    }
    const quantity = wanted.get(key)
    if (Number(row.quantity) !== quantity) {
      await tx[table].update({ where: { id: row.id }, data: { quantity } })
    }
    wanted.delete(key)
  }

  for (const [id, quantity] of wanted) {
    await tx[table].create({ data: { productId, [foreignKey]: BigInt(id), quantity } })
  }
}

/**
 * Colour-specific gallery uploads.
 *
 * The Blade posts `color_gallery[<colorId>][]`, so the field name carries the colour and
 * multer's `fields()` cannot declare it up front — the routes use `any()` and the client
 * flattens the name to `color_gallery_<colorId>`. Images filed under a colour swap in when
 * the customer picks that colour; images with a NULL colour_id are the shared gallery, and
 * that null is the whole distinction, so it has to survive the round trip.
 */
function colourGalleryFiles(files) {
  const out = []

  for (const [field, list] of Object.entries(files)) {
    const match = /^color_gallery_(\d+)$/.exec(field)
    if (!match) continue

    for (const file of list) out.push({ colorId: BigInt(match[1]), file })
  }

  return out
}

/**
 * Per-highlight icon uploads, posted as `highlight_icon_<row index>`.
 *
 * A row that gets no new file keeps `existing_icon`, which is why the client sends that
 * back inside the JSON row rather than the server inferring it — a highlight whose icon is
 * left alone must not lose it.
 */
function applyHighlightIcons(data, files) {
  const rows = data.highlights_items
  if (!Array.isArray(rows)) return

  data.highlights_items = rows.map((row, index) => {
    const uploaded = files[`highlight_icon_${index}`]?.[0]
    // `|| null`, not `??` — the client sends '' for a row that has never had an icon, and
    // storing that instead of null is drift for no reason: both are falsy to every reader.
    const icon = uploaded
      ? persist(uploaded, UPLOAD_DIRS.products)
      : (row.existing_icon || row.icon || null)

    const { existing_icon: _drop, ...rest } = row
    return { ...rest, icon }
  })
}

export async function createProduct(data, files = {}) {
  await assertTitleAvailable(data.title)

  applyHighlightIcons(data, files)

  const scalars = productScalars(data)
  scalars.slug = data.slug ? slugify(data.slug) : slugify(data.title)

  if (files.featured_image?.[0]) {
    scalars.featuredImage = persist(files.featured_image[0], UPLOAD_DIRS.products)
  }
  if (files.featured_image_2?.[0]) {
    scalars.featuredImage2 = persist(files.featured_image_2[0], UPLOAD_DIRS.products)
  }
  if (files.size_guide_image?.[0]) {
    scalars.sizeGuideImage = persist(files.size_guide_image[0], UPLOAD_DIRS.products)
  }
  if (files.highlights_image?.[0]) {
    scalars.highlightsImage = persist(files.highlights_image[0], UPLOAD_DIRS.products)
  }

  const galleryPaths = persistMany(files.gallery ?? [], UPLOAD_DIRS.products)
  const colourGallery = colourGalleryFiles(files).map(({ colorId, file }) => ({
    colorId,
    image: persist(file, UPLOAD_DIRS.products),
  }))

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({ data: scalars })

    await syncPivot(tx, {
      table: 'productColor',
      productId: product.id,
      foreignKey: 'colorId',
      entries: data.colors,
    })
    await syncPivot(tx, {
      table: 'productSize',
      productId: product.id,
      foreignKey: 'sizeId',
      entries: data.sizes,
    })

    if (galleryPaths.length || colourGallery.length) {
      await tx.productImage.createMany({
        data: [
          // colorId stays NULL for these — that is what makes them the shared gallery.
          ...galleryPaths.map((image, index) => ({ productId: product.id, image, sortOrder: index })),
          ...colourGallery.map(({ colorId, image }, index) => ({
            productId: product.id,
            colorId,
            image,
            sortOrder: galleryPaths.length + index,
          })),
        ],
      })
    }

    return tx.product.findUnique({ where: { id: product.id }, include: PRODUCT_INCLUDE })
  })
}

export async function updateProduct(id, data, files = {}) {
  const existing = await findProduct(id)
  await assertTitleAvailable(data.title, id)

  applyHighlightIcons(data, files)

  const scalars = productScalars(data)
  if (data.slug) scalars.slug = slugify(data.slug)

  const replaced = []
  for (const [fileKey, field] of [
    ['featured_image', 'featuredImage'],
    ['featured_image_2', 'featuredImage2'],
    ['size_guide_image', 'sizeGuideImage'],
    ['highlights_image', 'highlightsImage'],
  ]) {
    if (files[fileKey]?.[0]) {
      scalars[field] = persist(files[fileKey][0], UPLOAD_DIRS.products)
      if (existing[field]) replaced.push(existing[field])
    }
  }

  const galleryPaths = persistMany(files.gallery ?? [], UPLOAD_DIRS.products)
  const colourGallery = colourGalleryFiles(files).map(({ colorId, file }) => ({
    colorId,
    image: persist(file, UPLOAD_DIRS.products),
  }))
  const removeIds = (data.remove_gallery ?? []).map((v) => BigInt(v))

  const product = await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id: BigInt(id) }, data: scalars })

    await syncPivot(tx, {
      table: 'productColor',
      productId: BigInt(id),
      foreignKey: 'colorId',
      entries: data.colors,
    })
    await syncPivot(tx, {
      table: 'productSize',
      productId: BigInt(id),
      foreignKey: 'sizeId',
      entries: data.sizes,
    })

    if (removeIds.length) {
      const doomed = await tx.productImage.findMany({
        where: { id: { in: removeIds }, productId: BigInt(id) },
      })
      await tx.productImage.deleteMany({ where: { id: { in: doomed.map((d) => d.id) } } })
      replaced.push(...doomed.map((d) => d.image))
    }

    if (galleryPaths.length || colourGallery.length) {
      const last = await tx.productImage.findFirst({
        where: { productId: BigInt(id) },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      })
      const start = (last?.sortOrder ?? -1) + 1

      await tx.productImage.createMany({
        data: [
          ...galleryPaths.map((image, index) => ({
            productId: BigInt(id),
            image,
            sortOrder: start + index,
          })),
          ...colourGallery.map(({ colorId, image }, index) => ({
            productId: BigInt(id),
            colorId,
            image,
            sortOrder: start + galleryPaths.length + index,
          })),
        ],
      })
    }

    return tx.product.findUnique({ where: { id: BigInt(id) }, include: PRODUCT_INCLUDE })
  })

  // Only after the transaction commits — a rollback must not have destroyed live files.
  removeMany(replaced)

  return product
}

export async function deleteProduct(id) {
  const product = await findProduct(id)

  await prisma.product.delete({ where: { id: BigInt(id) } })

  removeMany(
    [
      product.featuredImage,
      product.featuredImage2,
      product.sizeGuideImage,
      product.highlightsImage,
      ...(product.images ?? []).map((i) => i.image),
    ].filter(Boolean),
  )
}

/** Admin\ProductController::bulkAction. */
export async function bulkProductAction(action, ids) {
  const keys = ids.map((id) => BigInt(id))

  switch (action) {
    case 'enable':
      await prisma.product.updateMany({ where: { id: { in: keys } }, data: { isActive: true } })
      return `${keys.length} product(s) enabled.`
    case 'disable':
      await prisma.product.updateMany({ where: { id: { in: keys } }, data: { isActive: false } })
      return `${keys.length} product(s) disabled.`
    case 'set_todays_deal':
      await prisma.product.updateMany({ where: { id: { in: keys } }, data: { isTodaysDeal: true } })
      return `${keys.length} product(s) set to today's deal.`
    case 'remove_todays_deal':
      await prisma.product.updateMany({ where: { id: { in: keys } }, data: { isTodaysDeal: false } })
      return `${keys.length} product(s) removed from today's deal.`
    case 'delete':
      // One at a time so each product's files are cleaned up.
      for (const id of keys) await deleteProduct(id)
      return `${keys.length} product(s) deleted.`
    default:
      throw new ValidationError({ action: ['Unknown action.'] }, 'Unknown action.')
  }
}

export async function toggleProduct(id, field) {
  const product = await findProduct(id)
  const updated = await prisma.product.update({
    where: { id: BigInt(id) },
    data: { [field]: !product[field] },
  })
  return updated[field]
}

// ─────────────────────────────────────────── product reviews

export async function listProductReviews(productId, { page = 1, perPage = 10 } = {}) {
  const where = { productId: BigInt(productId) }
  const take = Math.min(Math.max(1, perPage), 100)
  const currentPage = Math.max(1, page)

  const [total, items] = await prisma.$transaction([
    prisma.productReview.count({ where }),
    prisma.productReview.findMany({
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

export async function createProductReview(productId, data) {
  await findProduct(productId)
  return prisma.productReview.create({
    data: {
      productId: BigInt(productId),
      reviewerName: data.reviewer_name,
      reviewerEmail: data.reviewer_email ?? null,
      rating: Number(data.rating),
      comment: data.comment ?? null,
      isActive: true,
    },
  })
}

/** The review must belong to the product in the URL — abort_unless(..., 404). */
async function findOwnedReview(productId, reviewId) {
  const review = await prisma.productReview.findUnique({ where: { id: BigInt(reviewId) } })
  if (!review || String(review.productId) !== String(productId)) {
    throw new NotFoundError('Review not found.')
  }
  return review
}

export async function toggleProductReview(productId, reviewId) {
  const review = await findOwnedReview(productId, reviewId)
  const updated = await prisma.productReview.update({
    where: { id: review.id },
    data: { isActive: !review.isActive },
  })
  return updated.isActive
}

export async function deleteProductReview(productId, reviewId) {
  const review = await findOwnedReview(productId, reviewId)
  await prisma.productReview.delete({ where: { id: review.id } })
}

/** Form data for the product editor. */
export async function productFormData() {
  const [categoryList, brandList, offerList, colorList, sizeList, subCategoryList] =
    await Promise.all([
      prisma.category.findMany({ where: { isActive: true }, orderBy: { title: 'asc' } }),
      prisma.brand.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      prisma.offer.findMany({ where: { isActive: true }, orderBy: { title: 'asc' } }),
      prisma.color.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.size.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.subCategory.findMany({ where: { isActive: true }, orderBy: { title: 'asc' } }),
    ])

  return {
    categories: categoryList,
    brands: brandList,
    offers: offerList,
    colors: colorList,
    sizes: sizeList,
    subCategories: subCategoryList,
  }
}

export default {
  categories,
  subCategories,
  brands,
  colors,
  sizes,
  offers,
  newsTypes,
  blogPosts,
  listProducts,
  findProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkProductAction,
  toggleProduct,
  isTitleAvailable,
  listProductReviews,
  createProductReview,
  toggleProductReview,
  deleteProductReview,
  productFormData,
}
