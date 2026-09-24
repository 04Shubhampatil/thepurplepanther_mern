import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PpPrice from '../../components/product/PpPrice.jsx'
import WishlistButton from '../../components/product/WishlistButton.jsx'
import ProductRecommendations from '../../components/product/ProductRecommendations.jsx'
import SizeGuideDrawer from '../../components/product/SizeGuideDrawer.jsx'
import ReviewSection from './ReviewSection.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import Loading from '../../components/common/Loading.jsx'
import NotFound from '../NotFound.jsx'
import { useApi } from '../../hooks/useApi.js'
import { useCartStore, useRecentStore } from '../../store/index.js'
import { useBodyClass, usePageTitle } from '../../theme/page.js'
import { useBodyClasses } from '../../theme/chrome.js'
import { slugify } from '../../utils/slug.js'
import * as api from '../../services/endpoints.js'

/**
 * frontend/pages/shop-single.blade.php, plus the `productDesignInteractions()` block from
 * script.js (line 3313) which is what made the page work.
 *
 * The interactions ported here, and why each one matters:
 *
 *   - Choosing a colour swaps the whole gallery when that colour has its own images, then
 *     pads the set back up to four. The theme's grid expects four tiles; three leaves a
 *     hole and five reflows the row.
 *   - The quantity ceiling is `min(max_unit_buy, selected colour stock, selected size
 *     stock)`, recomputed on every change, and it disables ADD TO CART at zero. This is
 *     the only thing stopping someone adding more than exists.
 *   - Choosing an accessory pack rewrites the displayed price from that pack's own
 *     mrp/price, and the pack key travels with the add-to-cart call.
 *
 * TWO SECTIONS OF THE BLADE FILE ARE DELIBERATELY NOT PORTED: `.legacy-product-section`
 * and `.legacy-related-section`, roughly 400 lines between them. Both carry
 * `display: none !important` in style.css (lines 42941 and 43676) — they are the previous
 * design left in the file, and they render nothing on the live site.
 */
const GALLERY_MIN = 4
const GALLERY_MAX = 8

export default function ProductDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  // Selecting the raw array matters: a selector that CALLS exclude() builds a new array on
  // every render, zustand sees a changed snapshot each time, and the component re-renders
  // itself to death ("Maximum update depth exceeded").
  const recentIds = useRecentStore((s) => s.ids)
  const pushRecent = useRecentStore((s) => s.push)
  const add = useCartStore((s) => s.add)
  const openDrawer = useCartStore((s) => s.openDrawer)

  // Frozen per slug on purpose: `recentIds` gains this product the moment the page loads,
  // and re-reading it in the fetcher would make the page request itself back as its own
  // "recently viewed" on the next render.
  const recentParam = useMemo(() => recentIds.join(','), [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data, error, loading, refetch } = useApi(
    () => api.catalog.product(slug, { ids: recentParam }),
    [slug],
  )

  // The endpoint returns the product alongside its related and recently-viewed lists, so
  // the page still renders in one round trip the way the Blade view did.
  const product = data?.product ?? null
  const related = data?.related ?? []
  const recentlyViewed = data?.recentlyViewed ?? []

  const [colour, setColour] = useState(null)
  const [size, setSize] = useState(null)
  const [packageKey, setPackageKey] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState(0)
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false)

  // Blade printed the first colour, size and pack as pre-selected, so the page always has
  // a complete selection and ADD TO CART never needs the customer to choose anything.
  useEffect(() => {
    if (!product) return
    setColour(product.colors?.[0]?.name ? product.colors[0].name.toUpperCase() : null)
    setSize(product.sizes?.[0]?.name ?? null)
    setPackageKey(product.accessoryPackages?.[0]?.key ?? null)
    setQuantity(1)
    setActiveImage(0)
    pushRecent(product.id)
  }, [product, pushRecent])

  useBodyClass(
    'product-detail-page',
    product?.category ? `category-${slugify(product.category.title)}` : '',
  )

  /*
   * script.js:3321 puts `product-size-closed` on <body> at load and takes it off the moment
   * the size guide opens, swapping in `header-active`; closing reverses both. That is not
   * bookkeeping — `body.product-size-closed .cloth-size-sidebar` forces
   * `visibility: hidden !important` (style.css:44307), so leaving the class on permanently
   * meant the drawer could never be seen however many `active` classes it collected.
   */
  useBodyClasses(['product-size-closed'], !sizeGuideOpen)
  useBodyClasses(['header-active'], sizeGuideOpen)
  usePageTitle(
    product ? `${product.title} - The Purple Panther` : 'Product - The Purple Panther',
    product?.seo?.description,
  )

  // showColourGallery(): a colour with its own images replaces the gallery, padded to four
  // and capped at eight — script.js:3381.
  const gallery = useMemo(() => {
    if (!product) return []

    const forColour = colour ? product.colourGalleries?.[colour.toUpperCase()] : null
    if (!Array.isArray(forColour) || forColour.length === 0) return product.gallery ?? []

    const images = [...forColour]
    while (images.length < GALLERY_MIN) images.push(images[0])
    return images.slice(0, GALLERY_MAX)
  }, [product, colour])

  const packages = product?.accessoryPackages ?? []
  const selectedPackage = packages.find((p) => p.key === packageKey) ?? packages[0] ?? null

  // selectedStockLimit() — script.js:3324.
  const stockLimit = useMemo(() => {
    if (!product) return 0

    const limits = [Number(product.maxUnitBuy) || 99]
    const selectedColour = product.colors?.find((c) => c.name?.toUpperCase() === colour)
    const selectedSize = product.sizes?.find((s) => s.name === size)
    if (selectedColour) limits.push(Number(selectedColour.quantity) || 0)
    if (selectedSize) limits.push(Number(selectedSize.quantity) || 0)

    return Math.min(...limits)
  }, [product, colour, size])

  // applyStockLimit() clamped the visible quantity whenever the selection changed.
  useEffect(() => {
    setQuantity((current) => (stockLimit > 0 ? Math.min(current, stockLimit) : 0))
  }, [stockLimit])

  if (error?.status === 404) return <NotFound />

  /*
   * Any OTHER failure used to fall through to `loading || !product`, which is false-then-
   * null — a spinner that never stops. Say what happened and let the customer retry.
   */
  if (error) {
    return (
      <main className="body_content_wrapper">
        <div className="container py-5">
          <ErrorMessage error={error} onRetry={refetch} />
        </div>
      </main>
    )
  }

  if (loading || !product) return <Loading full />

  const soldOut = stockLimit < 1
  const packageDiscount =
    selectedPackage && selectedPackage.mrp > selectedPackage.price && selectedPackage.mrp > 0
      ? Math.round(((selectedPackage.mrp - selectedPackage.price) / selectedPackage.mrp) * 100)
      : 0

  const highlightItems = (product.highlights?.items ?? []).filter(
    (item) => item?.title || item?.subtitle || item?.description,
  )
  const highlightIntro = product.highlights?.shortDescription || product.shortDescription
  const showHighlights = Boolean(highlightIntro || highlightItems.length > 0 || product.highlights?.image)

  // Blade split `features` on newlines into the highlights list.
  const featureLines = String(product.features ?? '')
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const informationItems = (product.informationItems ?? []).filter((item) => item?.title || item?.text)
  const specificationItems = (product.specifications ?? []).filter((item) => item?.key || item?.value)

  const cartPayload = () => ({
    product_id: product.id,
    quantity: Math.max(1, quantity),
    ...(colour ? { color: colour } : {}),
    ...(size ? { size } : {}),
    ...(packageKey ? { package_key: packageKey } : {}),
  })

  async function onAddToCart() {
    if (soldOut) return
    try {
      await add(cartPayload())
      openDrawer()
    } catch {
      // The store holds the error; the bag stays shut.
    }
  }

  async function onBuyNow(event) {
    event.preventDefault()
    if (soldOut) return
    try {
      await api.cart.buyNow(cartPayload())
      navigate('/checkout')
    } catch {
      // Same as above — checkout is not entered on a failed line.
    }
  }

  function step(delta) {
    setQuantity((current) => {
      const next = current + delta
      return Math.max(stockLimit > 0 ? 1 : 0, Math.min(stockLimit, next))
    })
  }

  return (
    <main className="body_content_wrapper position-relative product-detail-main">
      <section
        className="product-design"
        aria-labelledby="product-design-title"
        data-product-id={product.id}
        data-max-unit-buy={product.maxUnitBuy || 99}
      >
        <div className="product-design__top">
          <div className="product-design__gallery" aria-label="Product image gallery">
            {gallery.map((imageUrl, index) => (
              <button
                className={`product-design__image${index < 2 ? ' product-design__image--half' : ''}${index === activeImage ? ' is-active' : ''}`}
                type="button"
                data-product-image={imageUrl}
                onClick={() => setActiveImage(index)}
                key={`${imageUrl}-${index}`}
              >
                <img src={imageUrl} alt={product.title} />
              </button>
            ))}
          </div>

          <div className="product-design__details" data-product-id={product.id}>
            <div className="product-design__details-inner">
              <div className="product-design__head">
                <p className="product-design__eyebrow">
                  {product.isNewArrival ? 'NEW ARRIVAL' : (product.category?.title ?? 'SHOP').toUpperCase()}
                </p>
                <h1 id="product-design-title">{product.title}</h1>
                <p className="product-design__price" data-product-price>
                  {selectedPackage ? (
                    <span className="pp-price pp-price--has-selling-price">
                      {/*
                        Same three-state rule as PpPrice / product-price.blade.php: the MRP is
                        rendered only when the pack is cheaper than it. custom.css strikes every
                        `.pp-price__mrp` in this wrapper, so an equal MRP showed as "₹519 ₹519"
                        with the first crossed out.
                      */}
                      {packageDiscount > 0 && (
                        <>
                          <span className="pp-price__mrp"><s>₹ {selectedPackage.mrp.toFixed(2)}</s></span>
                          <span className="pp-price__discount">-{packageDiscount}%</span>
                        </>
                      )}
                      <span className="pp-price__selling">₹ {selectedPackage.price.toFixed(2)}</span>
                    </span>
                  ) : (
                    <PpPrice product={product} />
                  )}
                </p>
                <WishlistButton product={product} className="product-design__wish">
                  <i className="far fa-heart" aria-hidden="true"></i>
                </WishlistButton>
              </div>

              <p className="product-design__intro">
                {product.shortDescription || product.features || 'Premium Purple Panther piece.'}
              </p>

              <fieldset className="product-design__choice product-design__colours">
                {product.colors?.length > 0 && (
                  <>
                    <legend>COLORS: <span data-selected-colour>{colour}</span></legend>
                    <div className="product-design__colour-list">
                      {product.colors.map((color) => {
                        const name = String(color.name ?? '').toUpperCase()
                        return (
                          <button
                            className={name === colour ? 'is-active' : ''}
                            type="button"
                            data-colour={name}
                            data-stock={color.quantity}
                            aria-label={`${color.name} (${color.quantity} available)`}
                            aria-pressed={name === colour ? 'true' : 'false'}
                            style={{ background: color.code }}
                            onClick={() => {
                              setColour(name)
                              setActiveImage(0)
                            }}
                            key={color.id}
                          ></button>
                        )
                      })}
                    </div>
                  </>
                )}
              </fieldset>

              {packages.length > 0 && (
                <fieldset className="product-design__choice product-design__packages">
                  <legend>CHOOSE PACK: <span data-selected-package>{selectedPackage?.label}</span></legend>
                  <div className="product-design__package-list" role="group" aria-label="Choose accessory package">
                    {packages.map((pack) => (
                      <button
                        type="button"
                        className={pack.key === packageKey ? 'is-active' : ''}
                        data-accessory-package={pack.key}
                        data-package-label={pack.label}
                        data-package-mrp={pack.mrp}
                        data-package-price={pack.price}
                        aria-pressed={pack.key === packageKey ? 'true' : 'false'}
                        onClick={() => setPackageKey(pack.key)}
                        key={pack.key}
                      >
                        <span>{pack.label}</span>
                        <strong>
                          {pack.mrp > pack.price && <s>₹ {Math.round(pack.mrp)}</s>}
                          {' '}₹ {Math.round(pack.price)}
                        </strong>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              {product.sizes?.length > 0 && (
                <fieldset className="product-design__choice product-design__sizes">
                  <div className="product-design__size-head">
                    <legend>SELECT SIZE: <span data-selected-size>{size}</span></legend>
                    {product.showSizeGuide && (
                      <button
                        type="button"
                        className="color-title guide-btn cloth-size-btn border-0 bg-transparent"
                        onClick={() => setSizeGuideOpen(true)}
                      >
                        View the Size Guide
                      </button>
                    )}
                  </div>
                  <div className="product-design__size-list" role="group" aria-label="Choose size">
                    {product.sizes.map((entry) => (
                      <button
                        type="button"
                        className={entry.name === size ? 'is-active' : ''}
                        data-size={entry.name}
                        data-stock={entry.quantity}
                        aria-label={`${entry.name} (${entry.quantity} available)`}
                        aria-pressed={entry.name === size ? 'true' : 'false'}
                        onClick={() => setSize(entry.name)}
                        key={entry.id}
                      >
                        {entry.name}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              <div className="product-design__quantity" aria-label="Quantity selector">
                <button type="button" data-product-qty="minus" aria-label="Decrease quantity" onClick={() => step(-1)}>-</button>
                <span data-product-qty-value>{quantity}</span>
                <button
                  type="button"
                  data-product-qty="plus"
                  aria-label="Increase quantity"
                  disabled={stockLimit < 1 || quantity >= stockLimit}
                  onClick={() => step(1)}
                >
                  +
                </button>
              </div>

              <div className="product-design__actions">
                <button
                  className={`product-design__cart${soldOut ? ' is-disabled' : ''}`}
                  type="button"
                  data-add-to-cart
                  data-product-id={product.id}
                  data-default-color={colour ?? ''}
                  data-default-size={size ?? ''}
                  data-default-package={packageKey ?? ''}
                  aria-disabled={soldOut ? 'true' : 'false'}
                  onClick={onAddToCart}
                >
                  ADD TO CART
                </button>
                <a
                  className={`product-design__buy${soldOut ? ' is-disabled' : ''}`}
                  href="/checkout"
                  data-buy-now
                  data-product-id={product.id}
                  data-default-color={colour ?? ''}
                  data-default-size={size ?? ''}
                  data-default-package={packageKey ?? ''}
                  aria-disabled={soldOut ? 'true' : 'false'}
                  onClick={onBuyNow}
                >
                  BUY NOW
                </a>
              </div>
            </div>
          </div>
        </div>

        {showHighlights && (
          <section className="product-care" aria-labelledby="product-care-title">
            <div className="product-care__media">
              <img src={product.highlights.image} alt={`${product.title} highlights`} />
            </div>
            <div className="product-care__content">
              <div className="product-care__intro">
                <h2 id="product-care-title">Product Highlights</h2>
              </div>
              {highlightItems.length > 0 && (
                <div className="product-care__grid">
                  {highlightItems.map((item, index) => (
                    <article className="product-care__item" key={index}>
                      <span className="product-care__icon">
                        <img src={item.icon} alt="" />
                      </span>
                      {item.title && <h3>{item.title}</h3>}
                      {item.subtitle && <strong>{item.subtitle}</strong>}
                      {item.description && <p>{item.description}</p>}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <section className="product-design__information" aria-label="Product information">
          <article>
            <h2>DESCRIPTION</h2>
            {product.shortDescription && (
              <p style={{ whiteSpace: 'pre-line' }}>{product.shortDescription}</p>
            )}
            {featureLines.length > 0 ? (
              <>
                <h3>Product Highlights</h3>
                <ul className="product-design__highlights">
                  {featureLines.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ul>
              </>
            ) : (
              !product.shortDescription && <p>Details coming soon.</p>
            )}
          </article>

          {/*
            The INFORMATION column is the theme's fixed copy, not the product's
            `information_items` — Blade commented the dynamic version out and shipped this.
            The stored items still gate whether the column appears at all, which is why the
            condition reads the data it does not print.
          */}
          {informationItems.length > 0 && (
            <article>
              <h2>INFORMATION</h2>
              <h3>Shipping</h3>
              <p>We offer free shipping across India on orders above ₹799.</p>
              <h3>Sizing</h3>
              <p>Fits true to size. Do you need size advice?</p>
              <h3>Return &amp; exchange</h3>
              <p>If you are not satisfied with your purchase you can return it to us within 7 days for an exchange</p>
              <h3>Assistance</h3>
              <p>Contact us on +91 87886 05592, or email us info@thepurplepanther.in</p>
            </article>
          )}

          {specificationItems.length > 0 && (
            <article>
              <h2>SPECIFICATIONS</h2>
              <dl>
                {specificationItems.map((spec, index) => (
                  <div key={index}>
                    <dt>{spec.key ?? ''}</dt>
                    <dd>{spec.value ?? ''}</dd>
                  </div>
                ))}
              </dl>
            </article>
          )}
        </section>

        {product.showSizeGuide && (
          <SizeGuideDrawer product={product} open={sizeGuideOpen} onClose={() => setSizeGuideOpen(false)} />
        )}
      </section>

      <ReviewSection product={product} slug={slug} onSubmitted={refetch} />

      <ProductRecommendations
        items={related}
        heading="YOU MAY ALSO LIKE"
        titleId="related-products-title"
        variant="related"
      />

      <ProductRecommendations
        items={recentlyViewed}
        heading="RECENTLY VIEWED"
        titleId="recent-products-title"
        variant="recent"
      />
    </main>
  )
}
