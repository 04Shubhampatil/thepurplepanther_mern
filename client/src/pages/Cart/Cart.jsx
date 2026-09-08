import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCartStore } from '../../store/index.js'
import Money from '../../components/common/Money.jsx'
import Loading from '../../components/common/Loading.jsx'
import Seo from '../../components/common/Seo.jsx'

/**
 * Cart page.
 *
 * Every figure shown is the server's. Changing a quantity sends the change and replaces
 * the whole summary with the response — the page never patches a total locally, so what
 * is displayed is always what checkout will charge.
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
      <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
        <Seo title="Cart" noIndex />
        <h1>Your cart is empty</h1>
        <Link to="/shop" className="btn btn-primary" style={{ marginTop: 20 }}>
          Continue shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="container pp-cart" style={{ padding: '32px 0' }}>
      <Seo title="Cart" noIndex />
      <h1>Your cart</h1>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="row">
        <div className="col-lg-8">
          <table className="table pp-cart__table">
            <caption className="sr-only">Items in your cart</caption>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Price</th>
                <th scope="col">Quantity</th>
                <th scope="col">Total</th>
                <th scope="col"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {cart.items.map((item) => (
                <tr key={item.lineKey}>
                  <td>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <img src={item.image} alt="" width="72" height="96" loading="lazy" />
                      <div>
                        <Link to={item.url}>{item.title}</Link>
                        {(item.color || item.size || item.packageLabel) && (
                          <p style={{ fontSize: 13, opacity: 0.7, margin: '4px 0 0' }}>
                            {[item.color, item.size, item.packageLabel].filter(Boolean).join(' / ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  <td>
                    <Money formatted={item.unitPriceFormatted} />
                    {item.discountPercent > 0 && (
                      <del style={{ marginLeft: 6, opacity: 0.6, fontSize: 13 }}>
                        <Money formatted={item.mrpFormatted} />
                      </del>
                    )}
                  </td>

                  <td>
                    <label htmlFor={`qty-${item.lineKey}`} className="sr-only">
                      Quantity for {item.title}
                    </label>
                    <input
                      id={`qty-${item.lineKey}`}
                      type="number"
                      min="0"
                      max={item.maxQuantity}
                      value={item.quantity}
                      disabled={loading}
                      onChange={(e) => changeQuantity(item, Number(e.target.value))}
                      style={{ width: 76 }}
                      className="form-control"
                    />
                    {item.maxQuantity < 10 && (
                      <span style={{ fontSize: 12, opacity: 0.6 }}>Max {item.maxQuantity}</span>
                    )}
                  </td>

                  <td>
                    <Money formatted={item.lineTotalFormatted} />
                  </td>

                  <td>
                    <button
                      type="button"
                      onClick={() => remove(item.productId, lineBody(item))}
                      disabled={loading}
                      aria-label={`Remove ${item.title}`}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Link to="/shop">← Continue shopping</Link>
        </div>

        <div className="col-lg-4">
          <aside className="pp-cart__summary" style={{ border: '1px solid #eee', padding: 20 }}>
            <h2 style={{ fontSize: 18 }}>Order summary</h2>

            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
              <span>Subtotal</span>
              <Money formatted={cart.subtotalFormatted} />
            </div>

            {cart.discount.amount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
                <span>
                  Discount{cart.discount.code ? ` (${cart.discount.code})` : ''}
                  <button
                    type="button"
                    onClick={removeCoupon}
                    style={{ marginLeft: 8, fontSize: 12 }}
                    aria-label="Remove coupon"
                  >
                    remove
                  </button>
                </span>
                <span>− <Money formatted={cart.discount.amountFormatted} /></span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
              <span>Delivery</span>
              <Money formatted={cart.shipping.amountFormatted} />
            </div>

            {!cart.shipping.isFree && cart.shipping.freeShippingThreshold > 0 && (
              <p style={{ fontSize: 13, opacity: 0.7 }}>
                Spend ₹ {(cart.shipping.freeShippingThreshold - (cart.subtotal - cart.discount.amount)).toFixed(2)}{' '}
                more for free delivery.
              </p>
            )}

            <hr />

            <div
              style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 18 }}
            >
              <span>Total</span>
              <Money formatted={cart.totalFormatted} />
            </div>

            <form onSubmit={submitCoupon} style={{ marginTop: 20 }} noValidate>
              <label htmlFor="coupon-code">Have a coupon?</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="coupon-code"
                  className="form-control"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Enter code"
                />
                <button type="submit" className="btn btn-outline-dark" disabled={loading}>
                  Apply
                </button>
              </div>
              {couponStatus && (
                <p role="status" style={{ marginTop: 8, color: couponStatus.ok ? '#146c43' : '#b00' }}>
                  {couponStatus.message}
                </p>
              )}
            </form>

            <Link to="/checkout" className="btn btn-primary" style={{ width: '100%', marginTop: 20 }}>
              Proceed to checkout
            </Link>
          </aside>
        </div>
      </div>
    </div>
  )
}
