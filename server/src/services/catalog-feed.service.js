import prisma from '../config/database.js'
import env from '../config/env.js'
import { toNumber } from '../utils/money.js'
import { productImageUrl } from '../utils/media.js'

/**
 * Meta product catalog feed — port of MetaCatalogFeedController.
 *
 * The header row and column ORDER must be byte-identical to the original or Meta rejects
 * the feed, so the column list is written out explicitly rather than derived.
 */

/** All 31 columns, in Meta's required order. */
export const FEED_COLUMNS = Object.freeze([
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'link',
  'image_link',
  'brand',
  'price',
  'google_product_category',
  'fb_product_category',
  'quantity_to_sell_on_facebook',
  'sale_price',
  'sale_price_effective_date',
  'item_group_id',
  'gender',
  'color',
  'size',
  'age_group',
  'material',
  'pattern',
  'shipping',
  'shipping_weight',
  'offer_disclaimer',
  'offer_disclaimer_url',
  'video[0].url',
  'video[0].tag[0]',
  'gtin',
  'product_tags[0]',
  'product_tags[1]',
  'style[0]',
])

/** RFC 4180 quoting, matching PHP's fputcsv. */
function csvCell(value) {
  const str = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

const csvRow = (cells) => cells.map(csvCell).join(',')

/**
 * Sellable quantity — MetaCatalogFeedController::inventoryQuantity.
 *
 * With both colours and sizes it is the MINIMUM of the two sums, not their product: the
 * two dimensions describe the same stock, so multiplying would overstate it wildly.
 */
export function inventoryQuantity(product) {
  const colourQty = (product.colors ?? []).reduce((s, c) => s + Math.max(0, Number(c.quantity)), 0)
  const sizeQty = (product.sizes ?? []).reduce((s, x) => s + Math.max(0, Number(x.quantity)), 0)

  const hasColours = (product.colors ?? []).length > 0
  const hasSizes = (product.sizes ?? []).length > 0

  if (hasColours && hasSizes) return Math.min(colourQty, sizeQty)
  if (hasColours) return colourQty
  if (hasSizes) return sizeQty

  return Math.max(1, Number(product.maxUnitBuy) || 99)
}

const money = (value) =>
  `${toNumber(value).toFixed(2)} ${env.META_CATALOG_CURRENCY}`

/** Feed row for one product. */
export function feedRow(product) {
  const mrp = toNumber(product.mrp)
  const selling = toNumber(product.sellingPrice)
  const hasSale = selling > 0 && mrp > 0 && selling < mrp
  const currentPrice = selling > 0 ? selling : mrp
  const quantity = inventoryQuantity(product)

  const description =
    String(product.shortDescription || product.features || product.title || '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 9999) || String(product.title ?? '')

  return [
    String(product.id),
    product.title,
    description,
    quantity > 0 ? 'in stock' : 'out of stock',
    'new',
    `${env.FRONTEND_URL.replace(/\/+$/, '')}/product/${product.slug}`,
    productImageUrl(product.featuredImage),
    product.brand?.name || env.metaCatalogDefaultBrand,
    // On sale, `price` carries the MRP and `sale_price` the reduced price — that is how
    // Meta renders a strikethrough. Sending the sale price as `price` loses the discount.
    money(hasSale ? mrp : currentPrice),
    '', // google_product_category
    '', // fb_product_category
    String(quantity),
    hasSale ? money(selling) : '',
    '', // sale_price_effective_date
    '', // item_group_id
    '', // gender
    '', // color
    '', // size
    '', // age_group
    '', // material
    '', // pattern
    `IN::Standard:${money(Math.max(0, toNumber(product.deliveryCharge)))}`,
    '', // shipping_weight
    '', // offer_disclaimer
    '', // offer_disclaimer_url
    '', // video[0].url
    '', // video[0].tag[0]
    '', // gtin
    product.category?.title ?? '',
    product.subCategory?.title ?? '',
    '', // style[0]
  ]
}

const FEED_INCLUDE = {
  brand: { select: { id: true, name: true } },
  category: { select: { id: true, title: true } },
  subCategory: { select: { id: true, title: true } },
  colors: { select: { quantity: true } },
  sizes: { select: { quantity: true } },
}

/**
 * Stream the feed as CSV.
 *
 * Keyset pagination in pages of 250, matching Laravel's chunkById — memory stays flat no
 * matter how large the catalogue grows. Offset pagination would degrade quadratically.
 */
export async function* streamFeedRows(pageSize = 250) {
  yield `${csvRow(FEED_COLUMNS)}\n`

  let cursor = null

  for (;;) {
    const products = await prisma.product.findMany({
      where: { isActive: true, ...(cursor ? { id: { gt: cursor } } : {}) },
      include: FEED_INCLUDE,
      orderBy: { id: 'asc' },
      take: pageSize,
    })

    if (products.length === 0) break

    for (const product of products) yield `${csvRow(feedRow(product))}\n`

    cursor = products[products.length - 1].id
    if (products.length < pageSize) break
  }
}

export default { streamFeedRows, feedRow, inventoryQuantity, FEED_COLUMNS }
