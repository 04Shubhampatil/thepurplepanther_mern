import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCartStore } from '../../store/index.js'

/**
 * frontend/partials/cart-contents.blade.php.
 *
 * The line list is rendered TWICE — a `<table>` for `d-lg-table` and a stacked
 * `.cart-table-mobile` for `d-block d-lg-none`. That duplication is the theme's, not an
 * oversight: the two are laid out differently enough that CSS alone did not get there, and
 * collapsing them into one would change the mobile layout.
 *
 * Nothing here computes money. Every quantity change and coupon action goes to the server
 * and the whole summary is replaced with what comes back, which is the migration brief's
 * rule (§32) and the only way the page and checkout cannot disagree.
 */
export default function CartContents() {
  const { cart, update, remove, applyCoupon, removeCoupon, error, clearError } = useCartStore()

  const items = cart.items ?? []
  const discount = cart.discount ?? {}
  const shipping = cart.shipping ?? {}

  const [couponCode, setCouponCode] = useState(discount.code ?? '')
  const [couponMessage, setCouponMessage] = useState('')

  useEffect(() => {
    setCouponCode(discount.code ?? '')
  }, [discount.code])

  const hasDiscount = Boolean(discount.code) && (Number(discount.amount ?? 0) > 0 || discount.freeShipping)

  const variantOf = (item) => ({
    color: item.color ?? null,
    size: item.size ?? null,
    package_key: item.packageKey ?? null,
  })

  function setQuantity(item, quantity) {
    if (Number.isNaN(quantity) || quantity < 0) return
    if (quantity === 0) {
      remove(item.productId, variantOf(item))
      return
    }
    update(item.productId, { ...variantOf(item), quantity })
  }

  async function onApplyCoupon() {
    setCouponMessage('')
    clearError()
    try {
      const data = await applyCoupon(couponCode.trim())
      setCouponMessage(data?.message ?? '')
    } catch (couponError) {
      setCouponMessage(couponError.message || 'That code could not be applied.')
    }
  }

  async function onRemoveCoupon() {
    setCouponMessage('')
    clearError()
    await removeCoupon()
    setCouponCode('')
  }

  const meta = (item) => {
    const parts = []
    if (item.color) parts.push(`Colour: ${item.color}`)
    if (item.color && item.size) parts.push(' - ')
    if (item.size) parts.push(`Size: ${item.size}`)
    return parts.join('')
  }

  const unitPrice = (item) => (
    <span className="pp-price pp-price--has-selling-price">
      <span className="pp-price__mrp">
        {item.discountPercent ? <s>{item.mrpFormatted}</s> : item.mrpFormatted}
      </span>
      {item.discountPercent ? <span className="pp-price__discount">-{item.discountPercent}%</span> : null}
      <span className="pp-price__selling">{item.unitPriceFormatted}</span>
    </span>
  )

  return (
    <section className="shop-cart pt30 pp-cart-section">
      <div className="container">
        {error && <div className="alert alert-warning mb-4">{error}</div>}

        {items.length === 0 ? (
          <div className="pp-cart-empty text-center py-5">
            <h3 className="mb-3">Your cart is empty</h3>
            <p className="mb-4 text-muted">Browse the collection and add pieces you love.</p>
            <Link className="btn btn-dark" to="/shop">Continue shopping</Link>
          </div>
        ) : (
          <div className="row mt15">
            <div className="col-xl-8 col-lg-7">
              <div className="shopping_cart_table table-responsive mb-5 mb-xl-0">
                <table className="table table-borderless d-none d-lg-table w-100">
                  <thead>
                    <tr>
                      <th scope="col">PRODUCT</th>
                      <th scope="col">PRICE</th>
                      <th scope="col">QUANTITY</th>
                      <th scope="col">SUBTOTAL</th>
                      <th scope="col"></th>
                    </tr>
                  </thead>
                  <tbody className="table_body">
                    {items.map((item) => (
                      <tr
                        data-cart-row
                        data-product-id={item.productId}
                        data-color={item.color ?? ''}
                        data-size={item.size ?? ''}
                        data-package-key={item.packageKey ?? ''}
                        key={item.lineKey}
                      >
                        <td>
                          <div className="cart_list d-flex align-items-center gap-3">
                            <Link to={item.url}>
                              <img src={item.image} alt={item.title} width="90" height="110" style={{ objectFit: 'cover' }} />
                            </Link>
                            <div>
                              <Link className="cart_title" to={item.url}>{item.title}</Link>
                              {(item.color || item.size) && <div className="text small mt-1">{meta(item)}</div>}
                              {item.packageLabel && <div className="text small mt-1">Pack: {item.packageLabel}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="cart_price">{unitPrice(item)}</td>
                        <td>
                          <div className="quantity-block overflow-hidden">
                            <button
                              type="button"
                              className="quantity-arrow-minus inner_page"
                              data-cart-qty="minus"
                              aria-label="Decrease"
                              onClick={() => setQuantity(item, item.quantity - 1)}
                            >
                              <span className="fa fa-minus"></span>
                            </button>
                            <input
                              className="quantity-num inner_page"
                              type="number"
                              min="0"
                              max={item.maxQuantity}
                              value={item.quantity}
                              data-cart-qty-input
                              onChange={(event) => setQuantity(item, Number.parseInt(event.target.value, 10))}
                            />
                            <button
                              type="button"
                              className="quantity-arrow-plus inner_page"
                              data-cart-qty="plus"
                              aria-label="Increase"
                              onClick={() => setQuantity(item, item.quantity + 1)}
                            >
                              <span className="fas fa-plus"></span>
                            </button>
                          </div>
                        </td>
                        <td className="cart_price" data-cart-line-total>{item.lineTotalFormatted}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-link text-dark p-0"
                            data-cart-remove
                            onClick={() => remove(item.productId, variantOf(item))}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="cart-table-mobile d-block d-lg-none">
                  {items.map((item) => (
                    <div key={item.lineKey}>
                      <div
                        className="d-flex mb-4"
                        data-cart-row
                        data-product-id={item.productId}
                        data-color={item.color ?? ''}
                        data-size={item.size ?? ''}
                        data-package-key={item.packageKey ?? ''}
                      >
                        <div className="item-thumb">
                          <Link to={item.url}><img src={item.image} alt={item.title} width="90" /></Link>
                        </div>
                        <div className="item-details ms-3 position-relative flex-grow-1">
                          <Link className="cart_title" to={item.url}>{item.title}</Link>
                          <div className="cart_price mb-1" data-cart-line-total>{item.lineTotalFormatted}</div>
                          {(item.color || item.size) && <div className="text mb-2">{meta(item)}</div>}
                          {item.packageLabel && <div className="text mb-2">Pack: {item.packageLabel}</div>}
                          <div className="quantity-block overflow-hidden mx-0 mb-2">
                            <button
                              type="button"
                              className="quantity-arrow-minus inner_page"
                              data-cart-qty="minus"
                              onClick={() => setQuantity(item, item.quantity - 1)}
                            >
                              <span className="fa fa-minus"></span>
                            </button>
                            <input
                              className="quantity-num inner_page"
                              type="number"
                              min="0"
                              max={item.maxQuantity}
                              value={item.quantity}
                              data-cart-qty-input
                              onChange={(event) => setQuantity(item, Number.parseInt(event.target.value, 10))}
                            />
                            <button
                              type="button"
                              className="quantity-arrow-plus inner_page"
                              data-cart-qty="plus"
                              onClick={() => setQuantity(item, item.quantity + 1)}
                            >
                              <span className="fas fa-plus"></span>
                            </button>
                          </div>
                          <button
                            type="button"
                            className="remove border-0 bg-transparent p-0"
                            data-cart-remove
                            onClick={() => remove(item.productId, variantOf(item))}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <hr />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-xl-4 col-lg-5">
              <div className="shop_order_box border p-4">
                <h4 className="title mb-3">Order summary</h4>

                <div className="cart_coupon position-relative mb-3" data-coupon-box>
                  <div className="input-group">
                    <input
                      className="form-control coupon_input"
                      type="text"
                      name="coupon_code"
                      data-coupon-input
                      placeholder="Coupon code"
                      value={couponCode}
                      readOnly={Boolean(discount.code)}
                      aria-label="Coupon code"
                      onChange={(event) => setCouponCode(event.target.value)}
                    />
                    <button
                      className="btn btn-dark"
                      type="button"
                      data-coupon-apply
                      hidden={Boolean(discount.code)}
                      onClick={onApplyCoupon}
                    >
                      Apply
                    </button>
                    <button
                      className="btn btn-outline-dark"
                      type="button"
                      data-coupon-remove
                      hidden={!discount.code}
                      onClick={onRemoveCoupon}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="small mt-2" data-coupon-message hidden={!couponMessage}>{couponMessage}</div>
                </div>

                <ul className="list-unstyled mb-4">
                  <li className="d-flex justify-content-between mb-2">
                    <span data-cart-items-label>Items ({cart.count})</span>
                    <strong data-cart-subtotal>{cart.subtotalFormatted}</strong>
                  </li>
                  <li className="d-flex justify-content-between mb-2" data-cart-discount-row hidden={!hasDiscount}>
                    <span data-cart-discount-label>
                      Discount{discount.code ? ` (${discount.code})` : ''}
                    </span>
                    <strong data-cart-discount>-{discount.amountFormatted ?? '₹ 0.00'}</strong>
                  </li>
                  <li className="d-flex justify-content-between mb-2">
                    <span>Shipping</span>
                    <span data-cart-shipping>{shipping.amountFormatted}</span>
                  </li>
                  <li className="d-flex justify-content-between border-top pt-3 mt-2">
                    <span>Total</span>
                    <strong data-cart-total>{cart.totalFormatted}</strong>
                  </li>
                </ul>

                <p className="small text-muted mb-3" data-cart-shipping-message>
                  {shipping.isFree
                    ? 'Free shipping applied.'
                    : `Free shipping on orders of ₹ ${Math.round(Number(shipping.freeShippingThreshold ?? 0))} or more.`}
                </p>

                <Link className="btn btn-dark w-100 mb-2" to="/checkout">Checkout</Link>
                <Link className="btn btn-outline-dark w-100" to="/shop">Continue shopping</Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
