import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import { useCartStore, useRecentStore, useAuthStore } from '../../store/index.js'
import ProductGrid from '../../components/product/ProductGrid.jsx'
import Money from '../../components/common/Money.jsx'
import Loading from '../../components/common/Loading.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import Seo from '../../components/common/Seo.jsx'
import NotFound from '../NotFound.jsx'
import ReviewSection from './ReviewSection.jsx'

/**
 * Product detail.
 *
 * The variant rules here mirror the server's cart service, because a mismatch shows up as
 * "add to cart" failing with a 422 the customer cannot act on:
 *   - the first colour and size are pre-selected, matching resolveVariants()
 *   - the maximum quantity is min(max_unit_buy, colour stock, size stock)
 *   - accessory packages are chosen by KEY only; the price is always the server's
 *
 * The client still never decides the price. It selects, the server prices.
 */
export default function ProductDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { add, openDrawer, loading: cartLoading } = useCartStore()
  const { ids: recentIds, push: pushRecent, exclude } = useRecentStore()
  const user = useAuthStore((s) => s.user)

  const [color, setColor] = useState(null)
  const [size, setSize] = useState(null)
  const [packageKey, setPackageKey] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState(0)
  const [feedback, setFeedback] = useState(null)

  // The recently-viewed list is sent as ids; the server resolves and re-orders them.
  const recentQuery = useMemo(() => exclude(slug).join(','), [recentIds, slug])

  const { data, error, loading, refetch } = useApi(
    () => api.catalog.product(slug, { ids: recentQuery }),
    [slug],
  )

  const product = data?.product

  // Pre-select the first colour and size, matching CartService::resolveVariants — so the
  // displayed price and stock correspond to what will actually be added.
  useEffect(() => {
    if (!product) return
    setColor(product.colors?.[0]?.name ? String(product.colors[0].name).toUpperCase() : null)
    setSize(product.sizes?.[0]?.name ?? null)
    setPackageKey(product.accessoryPackages?.[0]?.key ?? null)
    setQuantity(1)
    setActiveImage(0)
    pushRecent(product.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id])

  const maxQuantity = useMemo(() => {
    if (!product) return 1
    const limits = [Math.max(1, product.maxUnitBuy || 99)]

    if (color && product.colors?.length) {
      const match = product.colors.find(
        (c) => String(c.name).toLowerCase() === String(color).toLowerCase(),
      )
      if (match) limits.push(Number(match.quantity))
    }
    if (size && product.sizes?.length) {
      const match = product.sizes.find(
        (s) => String(s.name).toLowerCase() === String(size).toLowerCase(),
      )
      if (match) limits.push(Number(match.quantity))
    }

    return Math.min(...limits)
  }, [product, color, size])

  if (error?.status === 404) return <NotFound />
  if (loading && !data) return <Loading full />
  if (error) return <ErrorMessage error={error} onRetry={refetch} />
  if (!product) return <NotFound />

  const outOfStock = maxQuantity < 1
  const selectedPackage = product.accessoryPackages?.find((p) => p.key === packageKey) ?? null

  const payload = () => ({
    product_id: product.id,
    quantity,
    color,
    size,
    package_key: packageKey,
  })

  const handleAdd = async () => {
    setFeedback(null)
    try {
      await add(payload())
      openDrawer()
    } catch (err) {
      // The server's message names the actual limit, e.g. "Only 2 item(s) are available".
      setFeedback({ ok: false, message: err.message })
    }
  }

  const handleBuyNow = async () => {
    setFeedback(null)
    try {
      await api.cart.buyNow(payload())
      navigate('/checkout')
    } catch (err) {
      setFeedback({ ok: false, message: err.message })
    }
  }

  const handleWishlist = async () => {
    if (!user) {
      navigate('/login', { state: { from: `/product/${slug}` } })
      return
    }
    try {
      await api.account.addToWishlist(product.id)
      setFeedback({ ok: true, message: 'Added to wishlist.' })
    } catch (err) {
      setFeedback({ ok: false, message: err.message })
    }
  }

  return (
    <div className="container pp-product">
      <Seo
        title={product.seo?.title ?? product.title}
        description={product.seo?.description ?? product.shortDescription}
        keywords={product.seo?.keywords}
      />

      <div className="row" style={{ padding: '32px 0' }}>
        {/* gallery */}
        <div className="col-md-6">
          <div className="pp-product__gallery">
            <img
              src={product.gallery?.[activeImage] ?? product.image}
              alt={product.title}
              style={{ width: '100%', display: 'block' }}
            />

            {product.gallery?.length > 1 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {product.gallery.map((src, index) => (
                  <button
                    key={`${src}-${index}`}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    aria-label={`View image ${index + 1}`}
                    aria-current={index === activeImage}
                    style={{
                      border: index === activeImage ? '2px solid #3a1651' : '1px solid #ddd',
                      padding: 0,
                      background: 'none',
                    }}
                  >
                    <img src={src} alt="" width="72" height="96" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* details */}
        <div className="col-md-6">
          <h1>{product.title}</h1>

          <div className="pp-product__price" style={{ margin: '12px 0' }}>
            <Money formatted={product.priceFormatted} className="pp-price" />
            {product.discountPercent > 0 && (
              <>
                <del style={{ marginLeft: 10, opacity: 0.6 }}>
                  <Money formatted={product.mrpFormatted} />
                </del>
                <span style={{ marginLeft: 10, color: '#3a1651' }}>
                  {product.discountPercent}% OFF
                </span>
              </>
            )}
          </div>

          {product.shortDescription && <p>{product.shortDescription}</p>}

          {product.colors?.length > 0 && (
            <fieldset style={{ margin: '18px 0', border: 0, padding: 0 }}>
              <legend style={{ fontSize: 14, fontWeight: 600 }}>Colour</legend>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {product.colors.map((option) => {
                  const value = String(option.name).toUpperCase()
                  const disabled = Number(option.quantity) < 1
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setColor(value)}
                      disabled={disabled}
                      aria-pressed={color === value}
                      title={disabled ? `${option.name} — out of stock` : option.name}
                      style={{
                        padding: '6px 14px',
                        border: color === value ? '2px solid #3a1651' : '1px solid #ccc',
                        opacity: disabled ? 0.4 : 1,
                        background: '#fff',
                      }}
                    >
                      {option.name}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )}

          {product.sizes?.length > 0 && (
            <fieldset style={{ margin: '18px 0', border: 0, padding: 0 }}>
              <legend style={{ fontSize: 14, fontWeight: 600 }}>Size</legend>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {product.sizes.map((option) => {
                  const disabled = Number(option.quantity) < 1
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSize(option.name)}
                      disabled={disabled}
                      aria-pressed={size === option.name}
                      style={{
                        padding: '6px 14px',
                        border: size === option.name ? '2px solid #3a1651' : '1px solid #ccc',
                        opacity: disabled ? 0.4 : 1,
                        background: '#fff',
                      }}
                    >
                      {option.name}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )}

          {product.accessoryPackages?.length > 0 && (
            <fieldset style={{ margin: '18px 0', border: 0, padding: 0 }}>
              <legend style={{ fontSize: 14, fontWeight: 600 }}>Pack</legend>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {product.accessoryPackages.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setPackageKey(option.key)}
                    aria-pressed={packageKey === option.key}
                    style={{
                      padding: '8px 14px',
                      border: packageKey === option.key ? '2px solid #3a1651' : '1px solid #ccc',
                      background: '#fff',
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {/* Shown for reference only — the server re-resolves the price on add. */}
              {selectedPackage && (
                <p style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>
                  {selectedPackage.label} — ₹ {Number(selectedPackage.price).toFixed(2)}
                </p>
              )}
            </fieldset>
          )}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '18px 0' }}>
            <label htmlFor="pp-qty">Quantity</label>
            <input
              id="pp-qty"
              type="number"
              min="1"
              max={Math.max(1, maxQuantity)}
              value={quantity}
              disabled={outOfStock}
              onChange={(e) =>
                setQuantity(Math.max(1, Math.min(maxQuantity, Number(e.target.value) || 1)))
              }
              style={{ width: 80 }}
              className="form-control"
            />
            {maxQuantity > 0 && maxQuantity < 10 && (
              <span style={{ fontSize: 13, opacity: 0.7 }}>Only {maxQuantity} left</span>
            )}
          </div>

          {feedback && (
            <p role="alert" style={{ color: feedback.ok ? '#146c43' : '#b00', margin: '8px 0' }}>
              {feedback.message}
            </p>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAdd}
              disabled={outOfStock || cartLoading}
            >
              {outOfStock ? 'Out of stock' : 'Add to cart'}
            </button>
            <button
              type="button"
              className="btn btn-outline-dark"
              onClick={handleBuyNow}
              disabled={outOfStock || cartLoading}
            >
              Buy now
            </button>
            <button type="button" className="btn btn-link" onClick={handleWishlist}>
              ♥ Wishlist
            </button>
          </div>

          {product.showSizeGuide && product.sizeGuideContent && (
            <details style={{ marginTop: 24 }}>
              <summary>Size guide</summary>
              <div dangerouslySetInnerHTML={{ __html: product.sizeGuideContent }} />
            </details>
          )}
        </div>
      </div>

      {product.specifications?.length > 0 && (
        <section className="pp-section">
          <h2>Specifications</h2>
          <table className="table">
            <tbody>
              {product.specifications.map((row, index) => (
                <tr key={index}>
                  <th scope="row">{row.label ?? row.title}</th>
                  <td>{row.value ?? row.content}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <ReviewSection product={product} slug={slug} onSubmitted={refetch} />

      {data.related?.length > 0 && (
        <section className="pp-section">
          <h2>You may also like</h2>
          <ProductGrid products={data.related} />
        </section>
      )}

      {data.recentlyViewed?.length > 0 && (
        <section className="pp-section">
          <h2>Recently viewed</h2>
          <ProductGrid products={data.recentlyViewed} />
        </section>
      )}
    </div>
  )
}
