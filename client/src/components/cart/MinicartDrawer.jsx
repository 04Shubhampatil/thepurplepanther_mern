import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useCartStore } from '../../store/index.js'

/**
 * frontend/partials/minicart-drawer.blade.php, plus renderMinicart() from cart.js.
 *
 * The row markup is cart.js's string template turned into JSX — same elements, same
 * classes, same `data-cart-*` hooks — so `site-drawers.css` styles it without a single
 * rule changing. The `−` on the decrement button is the theme's U+2212 minus, not a
 * hyphen; it is noticeably wider and the button is sized for it.
 *
 * Opening and closing is `.show` + `pp-minicart-open` on <html> and <body>, exactly as
 * openBagDrawer()/closeBagDrawer() did, because that pair is what drives the slide
 * transition and the scroll lock.
 */
export default function MinicartDrawer() {
  const { cart, drawerOpen, closeDrawer, update, remove } = useCartStore()

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('pp-minicart-open', drawerOpen)
    document.body.classList.toggle('pp-minicart-open', drawerOpen)

    return () => {
      root.classList.remove('pp-minicart-open')
      document.body.classList.remove('pp-minicart-open')
    }
  }, [drawerOpen])

  const items = cart.items ?? []

  function variantOf(item) {
    return { color: item.color ?? null, size: item.size ?? null, package_key: item.packageKey ?? null }
  }

  function setQuantity(item, quantity) {
    if (quantity < 0) return
    if (quantity === 0) {
      remove(item.productId, variantOf(item))
      return
    }
    update(item.productId, { ...variantOf(item), quantity })
  }

  return (
    <div className={`minicart-16${drawerOpen ? ' show' : ''}`} data-minicart-root aria-hidden={drawerOpen ? 'false' : 'true'}>
      <div className="minicart-16-overlay" data-minicart-close onClick={closeDrawer}></div>
      <aside className="cart-main" role="dialog" aria-modal="true" aria-label="Shopping bag">
        <div className="cart-headers d-flex align-items-center justify-content-between">
          <h4 className="title">SHOPPING BAG <span className="pp-minicart-count" data-minicart-count-label>{cart.count ? `(${cart.count})` : ''}</span></h4>
          <button type="button" className="minicart-close-icon" data-minicart-close aria-label="Close bag" onClick={closeDrawer}>&times;</button>
        </div>

        <div className="ship-bar text-center">
          <h4 className="ship-title" data-minicart-ship>Free shipping calculated at checkout</h4>
          <div className="progress" role="progressbar" aria-valuenow="40" aria-valuemin="0" aria-valuemax="100">
            <div className="progress-bar" data-minicart-ship-bar style={{ width: '40%' }}></div>
          </div>
        </div>

        <div className="cart-content">
          <ul className="product pp-minicart-live" data-minicart-items>
            {items.length === 0 ? (
              <li className="list-content pp-minicart-empty">Your bag is empty.</li>
            ) : (
              items.map((item) => {
                const meta = [
                  item.color ? `Colour: ${item.color}` : '',
                  item.color && item.size ? ' - ' : '',
                  item.size ? `Size: ${item.size}` : '',
                ].join('')

                return (
                  <li
                    className="list-content"
                    data-cart-row
                    data-product-id={item.productId}
                    data-color={item.color ?? ''}
                    data-size={item.size ?? ''}
                    data-package-key={item.packageKey ?? ''}
                    key={item.lineKey ?? `${item.productId}-${item.color ?? ''}-${item.size ?? ''}-${item.packageKey ?? ''}`}
                  >
                    <div className="prd-item">
                      <div className="img">
                        <Link to={item.url} onClick={closeDrawer}><img src={item.image} alt="" /></Link>
                      </div>
                      <div className="cart_btn">
                        <Link className="product-name" to={item.url} onClick={closeDrawer}>{item.title}</Link>
                        <span className="price" data-cart-line-total>{item.lineTotalFormatted}</span>
                        {meta && <span className="product-size d-block">{meta}</span>}
                        {item.packageLabel && <span className="product-size d-block">{`Pack: ${item.packageLabel}`}</span>}
                        <div className="pp-minicart-row-actions">
                          <div className="quantity-block">
                            <button
                              type="button"
                              className="quantity-arrow-minus"
                              data-cart-qty="minus"
                              aria-label="Decrease"
                              onClick={() => setQuantity(item, item.quantity - 1)}
                            >
                              −
                            </button>
                            <input
                              className="quantity-num"
                              type="number"
                              min="0"
                              max={item.maxQuantity}
                              value={item.quantity}
                              data-cart-qty-input
                              onChange={(event) => setQuantity(item, Number(event.target.value))}
                            />
                            <button
                              type="button"
                              className="quantity-arrow-plus"
                              data-cart-qty="plus"
                              aria-label="Increase"
                              onClick={() => setQuantity(item, item.quantity + 1)}
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            className="close_icon"
                            data-cart-remove
                            onClick={() => remove(item.productId, variantOf(item))}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })
            )}
          </ul>

          <div className="pp-minicart-footer">
            <div className="total_price">
              <h5 className="sub-title">SUBTOTAL: <span className="total_price" data-cart-subtotal>{cart.subtotalFormatted}</span></h5>
            </div>
            <div className="minicart-btn-wrap">
              <Link className="cart-btn" to="/cart" onClick={closeDrawer}>VIEW CART</Link>
              <Link className="checkout-btn" to="/checkout" onClick={closeDrawer}>CHECKOUT</Link>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
