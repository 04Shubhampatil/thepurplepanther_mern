import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { X, ShoppingBag, Tag, ArrowLeft } from 'lucide-react'
import { useCartStore } from '../../store/index.js'
import Loading from '../../components/common/Loading.jsx'
import Seo from '../../components/common/Seo.jsx'
import Container from '../../components/ui/Container.jsx'
import Button from '../../components/ui/Button.jsx'
import Image from '../../components/ui/Image.jsx'
import Alert from '../../components/ui/Alert.jsx'
import ProductQuantity from '../../components/product/ProductQuantity.jsx'

/**
 * Cart page.
 *
 * Every figure shown is the server's. Changing a quantity sends the change and replaces
 * the whole summary with the response — the page never patches a total locally, so what
 * is displayed is always what checkout will charge.
 *
 * The desktop table becomes a stacked list below `md`: five columns cannot be read on a
 * phone, and both layouts render from the same loop over the same server data.
 */
export default function Cart() {
  const { cart, loading, error, refresh, update, remove, applyCoupon, removeCoupon, clearError } =
    useCartStore()

  const [couponCode, setCouponCode] = useState('')
  const [couponStatus, setCouponStatus] = useState(null)

  useEffect(() => {
    refresh()
  }, [refresh])

  const lineBody = (item) => ({
    color: item.color,
    size: item.size,
    package_key: item.packageKey,
  })

  const changeQuantity = async (item, quantity) => {
    clearError()
    try {
      // 0 is a removal, matching the server's update rule.
      await update(item.productId, { ...lineBody(item), quantity })
    } catch {
      // The store holds the message; the banner below renders it.
    }
  }

  const submitCoupon = async (event) => {
    event.preventDefault()
    setCouponStatus(null)
    try {
      await applyCoupon(couponCode)
      setCouponStatus({ ok: true, message: 'Coupon applied successfully.' })
      setCouponCode('')
    } catch (err) {
      // The server explains exactly why — expired, minimum not met, not eligible…
      setCouponStatus({ ok: false, message: err.message })
    }
  }

  if (loading && cart.items.length === 0) return <Loading full />

  if (cart.items.length === 0) {
    return (
      <Container className="py-20 text-center md:py-28">
        <Seo title="Cart" noIndex />
        <ShoppingBag
          size={40}
          strokeWidth={1}
          aria-hidden="true"
          className="mx-auto mb-5 text-body"
        />
        <h1 className="pp-heading">Your cart is empty</h1>
        <p className="mx-auto mt-3 max-w-sm text-body">
          Nothing here yet. Browse the collection and add something you love.
        </p>
        <Button to="/shop" className="mt-7">
          Continue shopping
        </Button>
      </Container>
    )
  }

  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0)

  const variantLine = (item) =>
    [item.color, item.size, item.packageLabel].filter(Boolean).join(' / ')

  const RemoveButton = ({ item, className = '' }) => (
    <button
      type="button"
      onClick={() => remove(item.productId, lineBody(item))}
      disabled={loading}
      aria-label={`Remove ${item.title} from your cart`}
      className={`grid size-8 place-items-center text-body transition-colors hover:text-brand disabled:opacity-40 ${className}`}
    >
      <X size={16} strokeWidth={1.5} aria-hidden="true" />
    </button>
  )

  return (
    <Container className="py-10 md:py-14">
      <Seo title="Cart" noIndex />

      <h1 className="pp-heading">Your cart</h1>
      <p className="mt-1 text-body">
        {itemCount} item{itemCount === 1 ? '' : 's'}
      </p>

      {error && (
        <Alert tone="error" className="mt-5">
          {error}
        </Alert>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-14">
        <div>
          {/* Desktop: a real table, so column meanings are announced. */}
          <table className="hidden w-full md:table">
            <caption className="sr-only">Items in your cart</caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="pp-eyebrow pb-3 text-ink">
                  Product
                </th>
                <th scope="col" className="pp-eyebrow pb-3 text-ink">
                  Price
                </th>
                <th scope="col" className="pp-eyebrow pb-3 text-ink">
                  Quantity
                </th>
                <th scope="col" className="pp-eyebrow pb-3 text-right text-ink">
                  Total
                </th>
                <th scope="col" className="pb-3">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>

            <tbody>
              <AnimatePresence initial={false}>
                {cart.items.map((item) => (
                  <motion.tr
                    key={item.lineKey}
                    layout
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-b border-line align-top"
                  >
                    <td className="py-5 pr-4">
                      <div className="flex gap-4">
                        <Link to={item.url} className="w-[72px] shrink-0" tabIndex={-1}>
                          <Image src={item.image} alt="" className="w-[72px]" />
                        </Link>
                        <div>
                          <Link
                            to={item.url}
                            className="text-[14px] text-ink transition-colors hover:text-brand"
                          >
                            {item.title}
                          </Link>
                          {variantLine(item) && (
                            <p className="mt-1 text-[13px] text-body">{variantLine(item)}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-5 pr-4 text-[14px] text-ink">
                      {item.unitPriceFormatted}
                      {item.discountPercent > 0 && (
                        <del className="ml-2 text-[13px] text-body">{item.mrpFormatted}</del>
                      )}
                    </td>

                    <td className="py-5 pr-4">
                      <ProductQuantity
                        id={`qty-${item.lineKey}`}
                        label={`Quantity for ${item.title}`}
                        value={item.quantity}
                        max={item.maxQuantity}
                        disabled={loading}
                        compact
                        onChange={(quantity) => changeQuantity(item, quantity)}
                      />
                      {item.maxQuantity < 10 && (
                        <p className="mt-1.5 text-[12px] text-body">Max {item.maxQuantity}</p>
                      )}
                    </td>

                    <td className="py-5 text-right text-[14px] text-ink">
                      {item.lineTotalFormatted}
                    </td>

                    <td className="py-5 pl-2 text-right">
                      <RemoveButton item={item} className="ml-auto" />
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>

          {/* Mobile: the same lines, stacked. */}
          <ul className="md:hidden">
            <AnimatePresence initial={false}>
              {cart.items.map((item) => (
                <motion.li
                  key={item.lineKey}
                  layout
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex gap-4 border-b border-line py-5 first:border-t"
                >
                  <Link to={item.url} className="w-[84px] shrink-0" tabIndex={-1}>
                    <Image src={item.image} alt="" className="w-[84px]" />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={item.url}
                        className="text-[14px] text-ink transition-colors hover:text-brand"
                      >
                        {item.title}
                      </Link>
                      <RemoveButton item={item} className="-mr-2 -mt-1 shrink-0" />
                    </div>

                    {variantLine(item) && (
                      <p className="mt-1 text-[13px] text-body">{variantLine(item)}</p>
                    )}

                    <p className="mt-1 text-[13px] text-body">
                      {item.unitPriceFormatted}
                      {item.discountPercent > 0 && <del className="ml-2">{item.mrpFormatted}</del>}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <ProductQuantity
                        id={`qty-m-${item.lineKey}`}
                        label={`Quantity for ${item.title}`}
                        value={item.quantity}
                        max={item.maxQuantity}
                        disabled={loading}
                        compact
                        onChange={(quantity) => changeQuantity(item, quantity)}
                      />
                      <span className="text-[14px] text-ink">{item.lineTotalFormatted}</span>
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          <Link
            to="/shop"
            className="mt-7 inline-flex items-center gap-2 text-[13px] uppercase tracking-[0.1em] text-ink transition-colors hover:text-brand"
          >
            <ArrowLeft size={15} strokeWidth={1.5} aria-hidden="true" />
            Continue shopping
          </Link>
        </div>

        {/* Below the lines on mobile; sticks alongside them on desktop. */}
        <aside className="h-fit border border-line p-6 lg:sticky lg:top-24">
          <h2 className="pp-eyebrow text-ink">Order summary</h2>

          <dl className="mt-5 space-y-2.5 text-[14px]">
            <div className="flex justify-between gap-4">
              <dt className="text-body">Subtotal</dt>
              <dd className="text-ink">{cart.subtotalFormatted}</dd>
            </div>

            {cart.discount.amount > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="flex flex-wrap items-center gap-x-2 text-body">
                  <span>Discount{cart.discount.code ? ` (${cart.discount.code})` : ''}</span>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="text-[12px] underline underline-offset-2 transition-colors hover:text-brand"
                  >
                    Remove
                    <span className="sr-only"> coupon</span>
                  </button>
                </dt>
                <dd className="text-brand">− {cart.discount.amountFormatted}</dd>
              </div>
            )}

            <div className="flex justify-between gap-4">
              <dt className="text-body">Delivery</dt>
              <dd className="text-ink">{cart.shipping.amountFormatted}</dd>
            </div>
          </dl>

          {!cart.shipping.isFree && cart.shipping.freeShippingThreshold > 0 && (
            <p className="mt-3 bg-brand-tint px-3 py-2 text-[13px] text-brand">
              Spend ₹
              {(
                cart.shipping.freeShippingThreshold -
                (cart.subtotal - cart.discount.amount)
              ).toFixed(2)}{' '}
              more for free delivery.
            </p>
          )}

          <div className="mt-5 flex justify-between gap-4 border-t border-line pt-5 text-[17px] font-semibold text-ink">
            <span>Total</span>
            <span>{cart.totalFormatted}</span>
          </div>

          <Button to="/checkout" size="sm" className="mt-6 w-full">
            Proceed to checkout
          </Button>

          <form onSubmit={submitCoupon} className="mt-7 border-t border-line pt-6" noValidate>
            <label
              htmlFor="coupon-code"
              className="mb-2 flex items-center gap-2 text-[13px] text-ink"
            >
              <Tag size={15} strokeWidth={1.5} aria-hidden="true" />
              Have a coupon?
            </label>

            <div className="flex">
              <input
                id="coupon-code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="Enter code"
                aria-describedby={couponStatus ? 'coupon-status' : undefined}
                className="min-w-0 flex-1 border border-line bg-white px-3 py-2.5 text-[14px] uppercase text-ink placeholder:normal-case placeholder:text-body/60 focus:border-brand focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="shrink-0 border border-ink px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink transition-colors hover:border-brand hover:bg-brand hover:text-white disabled:opacity-50"
              >
                Apply
              </button>
            </div>

            {couponStatus && (
              <p
                id="coupon-status"
                role="status"
                className={`mt-2 text-[13px] ${couponStatus.ok ? 'text-brand' : 'text-red-700'}`}
              >
                {couponStatus.message}
              </p>
            )}
          </form>
        </aside>
      </div>
    </Container>
  )
}
