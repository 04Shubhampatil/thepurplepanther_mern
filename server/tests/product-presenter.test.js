import { describe, it, expect } from 'vitest'
import {
  presentProductCard,
  presentProductDetail,
  buildGallery,
  summariseReviews,
  accessoryPackages,
  currentPrice,
  productDiscountPercent,
  hoverImageUrl,
} from '../src/utils/product-presenter.js'

/**
 * Presenter parity tests.
 *
 * These are pure functions, so they can be pinned exactly — and they carry the subtle
 * catalog logic that a rewrite loses silently: gallery assembly, offer-vs-computed
 * discount precedence, accessory-package normalisation and review aggregation. Every
 * expectation traces to FrontendController::shopSingle or a Product model accessor.
 */

const baseProduct = {
  id: 7n,
  title: 'Indigo Kurti',
  slug: 'indigo-kurti',
  mrp: 1999,
  sellingPrice: 1499,
  featuredImage: 'products/indigo.jpg',
  featuredImage2: null,
  maxUnitBuy: 5,
  deliveryCharge: 0,
  isActive: true,
  images: [],
  colors: [],
  sizes: [],
  reviews: [],
  category: { id: 2n, title: 'Kurtis', slug: 'kurtis' },
}

describe('pricing accessors', () => {
  it('uses selling price when set, MRP otherwise', () => {
    expect(currentPrice({ mrp: 1999, sellingPrice: 1499 })).toBe(1499)
    expect(currentPrice({ mrp: 1999, sellingPrice: 0 })).toBe(1999)
  })

  it('computes discount from mrp/selling price', () => {
    expect(productDiscountPercent({ mrp: 1000, sellingPrice: 750 })).toBe(25)
  })

  it('lets an attached offer OVERRIDE the computed discount', () => {
    // Product::getDiscountPercentAttribute checks $this->offer FIRST and returns early,
    // even when the computed discount would be larger. Easy to "fix" by accident.
    const product = { mrp: 1000, sellingPrice: 750, offer: { discountPercent: 10 } }
    expect(productDiscountPercent(product)).toBe(10) // not 25
  })

  it('reports no discount when the selling price is not lower', () => {
    expect(productDiscountPercent({ mrp: 500, sellingPrice: 500 })).toBe(0)
    expect(productDiscountPercent({ mrp: 0, sellingPrice: 100 })).toBe(0)
  })

  it('formats both prices for display', () => {
    const card = presentProductCard(baseProduct)
    expect(card.priceFormatted).toBe('₹ 1,499.00')
    expect(card.mrpFormatted).toBe('₹ 1,999.00')
    expect(card.discountPercent).toBe(25)
    expect(card.hasSellingPrice).toBe(true)
  })

  it('links to the preserved /product/{slug} URL', () => {
    expect(presentProductCard(baseProduct).url).toBe('/product/indigo-kurti')
  })
})

describe('image accessors', () => {
  it('falls back to the featured image when there is no second image', () => {
    expect(hoverImageUrl(baseProduct)).toBe(hoverImageUrl({ ...baseProduct, featuredImage2: null }))
    expect(hoverImageUrl(baseProduct)).toContain('products/indigo.jpg')
  })

  it('uses featured_image_2 as the hover image when present', () => {
    expect(hoverImageUrl({ ...baseProduct, featuredImage2: 'products/hover.jpg' })).toContain(
      'products/hover.jpg',
    )
  })

  it('resolves stored paths against the media base, not the app root', () => {
    expect(presentProductCard(baseProduct).image).toBe(
      'http://localhost:5000/storage/products/indigo.jpg',
    )
  })
})

describe('buildGallery — FrontendController::shopSingle', () => {
  it('pads to at least 4 images with the featured image', () => {
    // The theme's slider breaks below 4 slides, which is why Laravel padded.
    const { gallery } = buildGallery(baseProduct)
    expect(gallery).toHaveLength(4)
    expect(new Set(gallery).size).toBe(1)
  })

  it('includes the hover image second when featured_image_2 is set', () => {
    const { gallery } = buildGallery({ ...baseProduct, featuredImage2: 'products/hover.jpg' })
    expect(gallery[0]).toContain('indigo.jpg')
    expect(gallery[1]).toContain('hover.jpg')
  })

  it('appends only images with NO colour attached', () => {
    const { gallery } = buildGallery({
      ...baseProduct,
      images: [
        { image: 'products/a.jpg', colorId: null, color: null },
        { image: 'products/b.jpg', colorId: 3n, color: { id: 3n, name: 'Red' } },
      ],
    })
    expect(gallery.some((u) => u.includes('a.jpg'))).toBe(true)
    expect(gallery.some((u) => u.includes('b.jpg'))).toBe(false)
  })

  it('groups colour galleries by UPPERCASED colour name', () => {
    const { colourGalleries } = buildGallery({
      ...baseProduct,
      images: [
        { image: 'products/r1.jpg', colorId: 3n, color: { id: 3n, name: 'Red' } },
        { image: 'products/r2.jpg', colorId: 3n, color: { id: 3n, name: 'Red' } },
      ],
    })
    expect(Object.keys(colourGalleries)).toEqual(['RED'])
    expect(colourGalleries.RED).toHaveLength(2)
  })

  it('REPLACES the gallery with the first colour\'s images when it has any', () => {
    // Without this rule a product whose images are all colour-tagged renders four copies
    // of the featured image — a visible regression.
    const { gallery } = buildGallery({
      ...baseProduct,
      colors: [{ colorId: 3n, quantity: 5, color: { id: 3n, name: 'Red' } }],
      images: [
        { image: 'products/r1.jpg', colorId: 3n, color: { id: 3n, name: 'Red' } },
        { image: 'products/r2.jpg', colorId: 3n, color: { id: 3n, name: 'Red' } },
      ],
    })
    expect(gallery[0]).toContain('r1.jpg')
    expect(gallery[1]).toContain('r2.jpg')
    expect(gallery).toHaveLength(4) // padded with the first colour image
    expect(gallery[2]).toContain('r1.jpg')
  })

  it('matches the first colour case-insensitively', () => {
    const { gallery } = buildGallery({
      ...baseProduct,
      colors: [{ colorId: 3n, quantity: 1, color: { id: 3n, name: 'red' } }],
      images: [{ image: 'products/r1.jpg', colorId: 3n, color: { id: 3n, name: 'RED' } }],
    })
    expect(gallery[0]).toContain('r1.jpg')
  })

  it('caps the gallery at 8', () => {
    const images = Array.from({ length: 20 }, (_, i) => ({
      image: `products/x${i}.jpg`,
      colorId: null,
      color: null,
    }))
    expect(buildGallery({ ...baseProduct, images }).gallery).toHaveLength(8)
  })
})

describe('summariseReviews', () => {
  it('averages to one decimal place', () => {
    const summary = summariseReviews([{ rating: 5 }, { rating: 4 }, { rating: 4 }])
    expect(summary.count).toBe(3)
    expect(summary.average).toBe(4.3) // 13/3 = 4.333 -> 4.3
  })

  it('builds a 5..1 breakdown with percentages', () => {
    const summary = summariseReviews([{ rating: 5 }, { rating: 5 }, { rating: 3 }, { rating: 1 }])
    expect(summary.breakdown[5]).toEqual({ count: 2, percent: 50 })
    expect(summary.breakdown[3]).toEqual({ count: 1, percent: 25 })
    expect(summary.breakdown[2]).toEqual({ count: 0, percent: 0 })
    expect(Object.keys(summary.breakdown)).toHaveLength(5)
  })

  it('reports zeroes rather than NaN for a product with no reviews', () => {
    const summary = summariseReviews([])
    expect(summary.count).toBe(0)
    expect(summary.average).toBe(0)
    expect(summary.breakdown[5].percent).toBe(0)
  })
})

describe('accessoryPackages — server-authoritative pricing', () => {
  it('parses JSON-in-longtext and normalises each entry', () => {
    const packages = accessoryPackages({
      accessoryPackages: JSON.stringify([{ key: 'single', label: 'Single', mrp: 499, price: 399 }]),
    })
    expect(packages).toEqual([{ key: 'single', label: 'Single', mrp: 499, price: 399 }])
  })

  it('defaults mrp to price when mrp is absent', () => {
    const [pack] = accessoryPackages({
      accessoryPackages: JSON.stringify([{ label: 'Pair', price: 699 }]),
    })
    expect(pack.mrp).toBe(699)
  })

  it('defaults a missing key to package-N, 1-indexed', () => {
    const packs = accessoryPackages({
      accessoryPackages: JSON.stringify([
        { label: 'A', price: 1 },
        { label: 'B', price: 2 },
      ]),
    })
    expect(packs.map((p) => p.key)).toEqual(['package-1', 'package-2'])
  })

  it('drops entries missing a label or a price', () => {
    const packs = accessoryPackages({
      accessoryPackages: JSON.stringify([
        { label: 'Good', price: 10 },
        { label: '', price: 20 },
        { label: 'No price', price: '' },
        { price: 30 },
      ]),
    })
    expect(packs).toHaveLength(1)
    expect(packs[0].label).toBe('Good')
  })

  it('returns [] for null or malformed JSON rather than throwing', () => {
    expect(accessoryPackages({ accessoryPackages: null })).toEqual([])
    expect(accessoryPackages({ accessoryPackages: 'not json' })).toEqual([])
    expect(accessoryPackages({})).toEqual([])
  })
})

describe('presentProductDetail', () => {
  const detailed = {
    ...baseProduct,
    featuredImage2: 'products/hover.jpg',
    shortDescription: 'Soft cotton kurti',
    showSizeGuide: true,
    sizeGuideImage: 'products/guide.jpg',
    highlightsItems: JSON.stringify([{ title: 'Breathable', icon: 'products/icon.svg' }]),
    specifications: JSON.stringify([{ label: 'Fabric', value: 'Cotton' }]),
    informationItems: JSON.stringify([{ title: 'Care', content: 'Hand wash' }]),
    seoTitle: null,
    metaDescription: 'A kurti',
    colors: [{ colorId: 3n, quantity: 4, color: { id: 3n, name: 'Red', code: '#f00' } }],
    sizes: [{ sizeId: 9n, quantity: 2, size: { id: 9n, name: 'M' } }],
    reviews: [
      { id: 1n, rating: 5, comment: 'Great', isActive: true, reviewerName: 'A', image: null },
      { id: 2n, rating: 1, comment: 'Hidden', isActive: false, reviewerName: 'B', image: null },
    ],
  }

  it('excludes inactive reviews from both the list and the aggregates', () => {
    const detail = presentProductDetail(detailed)
    expect(detail.reviews.count).toBe(1)
    expect(detail.reviews.average).toBe(5)
    expect(detail.reviews.items).toHaveLength(1)
    expect(JSON.stringify(detail.reviews)).not.toContain('Hidden')
  })

  it('never leaks reviewer email addresses', () => {
    const withEmail = {
      ...detailed,
      reviews: [
        { id: 1n, rating: 5, isActive: true, reviewerName: 'A', reviewerEmail: 'a@b.com', image: null },
      ],
    }
    expect(JSON.stringify(presentProductDetail(withEmail))).not.toContain('a@b.com')
  })

  it('exposes per-variant stock, which the cart depends on', () => {
    const detail = presentProductDetail(detailed)
    expect(detail.colors).toEqual([{ id: 3n, name: 'Red', code: '#f00', quantity: 4 }])
    expect(detail.sizes).toEqual([{ id: 9n, name: 'M', quantity: 2 }])
  })

  it('computes the saving from MRP', () => {
    const detail = presentProductDetail(detailed)
    expect(detail.saving).toBe(500)
    expect(detail.savingFormatted).toBe('₹ 500.00')
  })

  it('falls back to the product title for the SEO title', () => {
    expect(presentProductDetail(detailed).seo.title).toBe('Indigo Kurti')
    expect(presentProductDetail({ ...detailed, seoTitle: 'Custom' }).seo.title).toBe('Custom')
  })

  it('parses all four JSON detail sections', () => {
    const detail = presentProductDetail(detailed)
    expect(detail.specifications).toEqual([{ label: 'Fabric', value: 'Cotton' }])
    expect(detail.informationItems).toEqual([{ title: 'Care', content: 'Hand wash' }])
    expect(detail.highlights.items[0].title).toBe('Breathable')
    expect(detail.highlights.items[0].icon).toContain('icon.svg')
  })

  it('falls back to the featured image for the highlights image', () => {
    const detail = presentProductDetail({ ...detailed, highlightsImage: null })
    expect(detail.highlights.image).toContain('indigo.jpg')
  })
})
