import { Link } from 'react-router-dom'
import { useCartStore } from '../../store/index.js'
import Money from '../common/Money.jsx'

/**
 * Slide-out cart, replacing the jQuery drawer in site-drawers.js.
 *
 * Totals come straight from the server's summary; nothing here adds anything up.
 */
export default function CartDrawer() {
  const { cart, drawerOpen, closeDrawer, remove, loading } = useCartStore()

  if (!drawerOpen) return null

  const removeLine = (item) =>
    remove(item.productId, {
      color: item.color,
      size: item.size,
      package_key: item.packageKey,
    })

  return (
    <>
      <div
        className="pp-drawer__backdrop"
        onClick={closeDrawer}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 1040 }}
      />

      <aside
        className="pp-drawer pp-drawer--cart is-open"
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(420px, 100%)',
          background: '#fff',
          zIndex: 1050,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header
          className="pp-drawer__head"
          style={{ display: 'flex', justifyContent: 'space-between', padding: 20 }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>Your cart ({cart.count})</h2>
          <button type="button" onClick={closeDrawer} aria-label="Close cart">
            ×
          </button>
        </header>

        <div className="pp-drawer__body" style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
          {cart.items.length === 0 ? (
            <p style={{ opacity: 0.7, padding: '40px 0', textAlign: 'center' }}>
              Your cart is empty.
            </p>
          ) : (
            cart.items.map((item) => (
              <div
                key={item.lineKey}
                className="pp-drawer__line"
                style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid #eee' }}
              >
                <img src={item.image} alt="" width="64" height="85" loading="lazy" />

                <div style={{ flex: 1 }}>
                  <Link to={item.url} onClick={closeDrawer}>
                    {item.title}
                  </Link>

                  {(item.color || item.size || item.packageLabel) && (
                    <p style={{ fontSize: 12, opacity: 0.7, margin: '4px 0' }}>
                      {[item.color, item.size, item.packageLabel].filter(Boolean).join(' / ')}
                    </p>
                  )}

                  <p style={{ margin: 0, fontSize: 13 }}>
                    {item.quantity} × <Money formatted={item.unitPriceFormatted} />
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => removeLine(item)}
                  disabled={loading}
                  aria-label={`Remove ${item.title}`}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        {cart.items.length > 0 && (
          <footer className="pp-drawer__foot" style={{ padding: 20, borderTop: '1px solid #eee' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal</span>
              <Money formatted={cart.subtotalFormatted} />
            </div>

            {cart.discount.amount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Discount{cart.discount.code ? ` (${cart.discount.code})` : ''}</span>
                <span>− <Money formatted={cart.discount.amountFormatted} /></span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Delivery</span>
              <Money formatted={cart.shipping.amountFormatted} />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                marginTop: 8,
              }}
            >
              <span>Total</span>
              <Money formatted={cart.totalFormatted} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Link to="/cart" className="btn btn-outline-dark" onClick={closeDrawer} style={{ flex: 1 }}>
                View cart
              </Link>
              <Link to="/checkout" className="btn btn-primary" onClick={closeDrawer} style={{ flex: 1 }}>
                Checkout
              </Link>
            </div>
          </footer>
        )}
      </aside>
    </>
  )
}
