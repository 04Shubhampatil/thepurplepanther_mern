import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Check, AlertCircle, Truck, RotateCcw, ChevronDown } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import { useCartStore, useRecentStore } from '../../store/index.js'
import ProductGallery from '../../components/product/ProductGallery.jsx'
import ProductVariants from '../../components/product/ProductVariants.jsx'
import ProductQuantity from '../../components/product/ProductQuantity.jsx'
import WishlistButton from '../../components/product/WishlistButton.jsx'
import ProductCarousel from '../../components/home/ProductCarousel.jsx'
import Button from '../../components/ui/Button.jsx'
import Container from '../../components/ui/Container.jsx'
import Badge from '../../components/ui/Badge.jsx'
import Seo from '../../components/common/Seo.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import NotFound from '../NotFound.jsx'
import ReviewSection from './ReviewSection.jsx'

/** Collapsible detail panel — replaces the theme's accordion. */
function Accordion({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-line">
      <h3>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between py-4 text-left text-[13px] font-semibold uppercase tracking-[0.1em] text-ink transition-colors hover:text-brand"
        >
          {title}
          <ChevronDown
            size={16}
            strokeWidth={1.5}
            aria-hidden="true"
            className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </h3>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-5 text-body">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Product detail.
 *
 * The variant rules mirror the server's cart service, because a mismatch surfaces as
 * add-to-cart failing with a 422 the customer cannot act on:
 *   · the first colour (upper-cased) and size are pre-selected
 *   · max quantity is min(max_unit_buy, colour stock, size stock)
 *   · packs are chosen by key only — the price is always the server's
 */
export default function ProductDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { add, openDrawer, loading: cartLoading } = useCartStore()
  const { ids: recentIds, push: pushRecent, exclude } = useRecentStore()

  const [color, setColor] = useState(null)
  const [size, setSize] = useState(null)
  const [packageKey, setPackageKey] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [feedback, setFeedback] = useState(null)

  const recentQuery = useMemo(() => exclude(slug).join(','), [recentIds, slug])

  const { data, error, loading, refetch } = useApi(
    () => api.catalog.product(slug, { ids: recentQuery }),
    [slug],
  )

  const product = data?.product

  useEffect(() => {
    if (!product) return
    setColor(product.colors?.[0]?.name ? String(product.colors[0].name).toUpperCase() : null)
    setSize(product.sizes?.[0]?.name ?? null)
    setPackageKey(product.accessoryPackages?.[0]?.key ?? null)
    setQuantity(1)
    setFeedback(null)
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

  if (error) {
    return (
      <Container className="py-24">
        <ErrorMessage error={error} onRetry={refetch} />
      </Container>
    )
  }

  if (loading || !product) {
    return (
      <Container className="py-10">
        <div className="grid gap-10 md:grid-cols-2">
          <Skeleton className="aspect-[3/4] w-full" />
          <div className="space-y-4 py-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </Container>
    )
  }

  const outOfStock = maxQuantity < 1
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

  return (
    <>
      <Seo
        title={product.seo?.title ?? product.title}
        description={product.seo?.description ?? product.shortDescription}
        keywords={product.seo?.keywords}
      />

      <Container className="pt-8 md:pt-12">
        <div className="grid gap-8 md:grid-cols-2 md:gap-12 lg:gap-16">
          <ProductGallery images={product.gallery} title={product.title} />

          <div className="md:py-4">
            {product.category && (
              <p className="pp-eyebrow mb-3 text-body">{product.category.title}</p>
            )}

            <h1 className="pp-heading">{product.title}</h1>

            <div className="mt-4 flex flex-wrap items-baseline gap-3">
              <span className="text-[22px] font-medium text-ink">{product.priceFormatted}</span>
              {product.discountPercent > 0 && (
                <>
                  <del className="text-[15px] text-body/70">{product.mrpFormatted}</del>
                  <Badge>{product.discountPercent}% off</Badge>
                </>
              )}
            </div>

            {product.shortDescription && (
              <p className="mt-5 max-w-lg text-body">{product.shortDescription}</p>
            )}

            <ProductVariants
              product={product}
              color={color}
              size={size}
              packageKey={packageKey}
              onColor={setColor}
              onSize={setSize}
              onPackage={setPackageKey}
            />

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <ProductQuantity
                value={quantity}
                onChange={setQuantity}
                max={Math.max(1, maxQuantity)}
                disabled={outOfStock}
              />

              {maxQuantity > 0 && maxQuantity <= 5 && (
                <p className="text-[13px] text-brand">Only {maxQuantity} left</p>
              )}
            </div>

            <AnimatePresence>
              {feedback && (
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  role="alert"
                  className={`mt-4 flex items-center gap-2 text-[13px] ${
                    feedback.ok ? 'text-brand' : 'text-red-700'
                  }`}
                >
                  {feedback.ok ? (
                    <Check size={15} strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <AlertCircle size={15} strokeWidth={2} aria-hidden="true" />
                  )}
                  {feedback.message}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                onClick={handleAdd}
                disabled={outOfStock || cartLoading}
                loading={cartLoading}
                className="flex-1 sm:flex-none"
              >
                {outOfStock ? 'Out of stock' : 'Add to cart'}
              </Button>

              <Button
                variant="outline"
                onClick={handleBuyNow}
                disabled={outOfStock || cartLoading}
                className="flex-1 sm:flex-none"
              >
                Buy now
              </Button>

              <WishlistButton
                productId={product.id}
                productTitle={product.title}
                className="!size-[52px] border border-line !bg-white"
              />
            </div>

            <ul className="mt-8 space-y-2.5 text-[13px] text-body">
              <li className="flex items-center gap-2.5">
                <Truck size={16} strokeWidth={1.5} aria-hidden="true" className="text-brand" />
                Free delivery on qualifying orders
              </li>
              <li className="flex items-center gap-2.5">
                <RotateCcw size={16} strokeWidth={1.5} aria-hidden="true" className="text-brand" />
                7-day returns on unused items
              </li>
            </ul>

            <div className="mt-8">
              {product.features && (
                <Accordion title="Description" defaultOpen>
                  <div dangerouslySetInnerHTML={{ __html: product.features }} />
                </Accordion>
              )}

              {product.informationItems?.length > 0 && (
                <Accordion title="Information">
                  <dl className="space-y-3">
                    {product.informationItems.map((item, i) => (
                      <div key={i}>
                        {item.title && <dt className="text-ink">{item.title}</dt>}
                        {item.content && <dd className="mt-0.5">{item.content}</dd>}
                      </div>
                    ))}
                  </dl>
                </Accordion>
              )}

              {product.specifications?.length > 0 && (
                <Accordion title="Specifications">
                  <dl className="divide-y divide-line">
                    {product.specifications.map((row, i) => (
                      <div key={i} className="flex justify-between gap-6 py-2.5">
                        <dt className="text-ink">{row.label ?? row.title}</dt>
                        <dd className="text-right">{row.value ?? row.content}</dd>
                      </div>
                    ))}
                  </dl>
                </Accordion>
              )}

              {product.showSizeGuide && product.sizeGuideContent && (
                <Accordion title="Size guide">
                  <div dangerouslySetInnerHTML={{ __html: product.sizeGuideContent }} />
                </Accordion>
              )}
            </div>
          </div>
        </div>
      </Container>

      <Container>
        <ReviewSection product={product} slug={slug} onSubmitted={refetch} />
      </Container>

      <ProductCarousel title="You may also like" products={data.related ?? []} />
      <ProductCarousel title="Recently viewed" products={data.recentlyViewed ?? []} />

      <div className="pb-16" />
    </>
  )
}
