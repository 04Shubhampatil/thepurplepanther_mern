import { useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import Loading from '../../components/common/Loading.jsx'
import ProfileForm from './ProfileForm.jsx'
import AddressBook from './AddressBook.jsx'
import { useAuthStore } from '../../store/index.js'
import { useBodyClass, usePageTitle } from '../../theme/page.js'
import * as api from '../../services/endpoints.js'

/**
 * The customer account area — frontend/pages/account.blade.php.
 *
 * That Blade file renders an empty `<div id="account-app">` and hands everything to
 * account-dashboard.js, so the markup being reproduced here comes from THAT file, not the
 * template. Every class name (`account-shell`, `account-panel`, `account-order-table`,
 * `address-card`, `account-product`) is styled in custom.css and is why this looks like
 * the rest of the site.
 *
 * Paging is six per page, in the URL as `?page=`, and applied CLIENT-side to a list the
 * server sends whole — which is what account-dashboard.js did. It holds while an account
 * has tens of orders; it would need to move server-side before it has thousands.
 */
const NAV_ITEMS = [
  ['overview', 'Overview', 'fa-grid-2'],
  ['orders', 'Order History', 'fa-bag-shopping'],
  ['information', 'Information', 'fa-user'],
  ['addresses', 'Addresses', 'fa-location-dot'],
  ['wishlist', 'Wishlist', 'fa-heart'],
  ['reviews', 'My Reviews', 'fa-star'],
]

const PAGE_SIZE = 6
const PAGES = new Set(NAV_ITEMS.map(([slug]) => slug))

function Panel({ title, action, children }) {
  return (
    <section className="account-panel">
      <div className="account-panel-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Empty({ title, copy }) {
  return (
    <div className="account-empty">
      <span aria-hidden="true">◇</span>
      <h3>{title}</h3>
      <p>{copy}</p>
    </div>
  )
}

function paginate(items, page) {
  const list = items ?? []
  const total = list.length
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const current = Math.min(Math.max(1, page), pages)
  const start = (current - 1) * PAGE_SIZE

  return {
    items: list.slice(start, start + PAGE_SIZE),
    page: current,
    pages,
    total,
    from: total ? start + 1 : 0,
    to: Math.min(start + PAGE_SIZE, total),
  }
}

function PaginationNav({ meta, base }) {
  if (!meta.total) return null

  const count = <p className="account-page-count">Showing {meta.from}–{meta.to} of {meta.total}</p>

  if (meta.pages <= 1) return <div className="account-pagination-wrap">{count}</div>

  return (
    <div className="account-pagination-wrap">
      {count}
      <nav className="account-pagination collection-pagination" aria-label="Pagination">
        {meta.page <= 1 ? (
          <span className="page-btn disabled">Prev</span>
        ) : (
          <Link className="page-btn" to={`${base}?page=${meta.page - 1}`}>Prev</Link>
        )}
        {Array.from({ length: meta.pages }, (_, index) => index + 1).map((n) =>
          n === meta.page ? (
            <span className="page-btn active" aria-current="page" key={n}>{n}</span>
          ) : (
            <Link className="page-btn" to={`${base}?page=${n}`} key={n}>{n}</Link>
          ),
        )}
        {meta.page >= meta.pages ? (
          <span className="page-btn disabled">Next</span>
        ) : (
          <Link className="page-btn" to={`${base}?page=${meta.page + 1}`}>Next</Link>
        )}
      </nav>
    </div>
  )
}

function OrderItemsTable({ items }) {
  return (
    <div className="account-table-wrap">
      <table className="account-order-table">
        <thead>
          <tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr>
        </thead>
        <tbody>
          {(items ?? []).length === 0 ? (
            <tr><td colSpan="4">No items</td></tr>
          ) : (
            items.map((item, index) => (
              <tr key={index}>
                <td className="account-order-item-cell">
                  <img src={item.image} alt="" width="52" height="68" />
                  <div>
                    <strong>{item.title}</strong>
                    {(item.color || item.size) && (
                      <span>
                        {item.color ? `Colour: ${item.color}` : ''}
                        {item.color && item.size ? ' · ' : ''}
                        {item.size ? `Size: ${item.size}` : ''}
                      </span>
                    )}
                    {item.packageLabel && <span>{`Pack: ${item.packageLabel}`}</span>}
                    <span>{item.status ?? ''}</span>
                  </div>
                </td>
                <td data-label="Qty">{item.qty}</td>
                <td data-label="Price">{item.priceFormatted}</td>
                <td data-label="Total">{item.totalFormatted}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function OrderDetail({ order, onClose }) {
  if (!order) return null

  return (
    <div className="account-order-detail" data-order-detail={order.id}>
      <div className="account-order-detail-head">
        <div><p>Order details</p><h3>{order.number}</h3></div>
        <button type="button" className="account-text-button" data-close-order onClick={onClose}>Close</button>
      </div>
      <div className="account-order-meta">
        <div><span>Date</span><strong>{order.date}</strong></div>
        <div><span>Status</span><strong className="account-status">{order.status}</strong></div>
        <div><span>Payment</span><strong>{order.paymentMode}</strong></div>
        <div><span>Total</span><strong>{order.totalFormatted}</strong></div>
      </div>
      <OrderItemsTable items={order.items} />
      <div className="account-order-totals">
        <div><span>Subtotal</span><strong>{order.subtotalFormatted}</strong></div>
        <div><span>Shipping</span><strong>{order.shippingFormatted}</strong></div>
        <div className="is-grand"><span>Total paid</span><strong>{order.totalFormatted}</strong></div>
      </div>
      <div className="account-order-ship">
        <h4><i className="far fa-truck" aria-hidden="true"></i> Shipping to</h4>
        <p>
          <strong>{order.shippingName ?? ''}</strong><br />
          {(order.shippingLines ?? []).map((line, index) => (
            <span key={index}>{line}<br /></span>
          ))}
          {order.shippingPhone ? `Phone: ${order.shippingPhone}` : ''}
        </p>
      </div>
    </div>
  )
}

function OrderTable({ orders, openOrderId, onOpen, onClose }) {
  if (!orders.length) {
    return <Empty title="No orders yet" copy="Your purchases will appear here after checkout." />
  }

  const openOrder = orders.find((order) => String(order.id) === String(openOrderId))

  return (
    <div className="account-orders-panel">
      <div className="account-table-wrap">
        <table className="account-orders-table">
          <thead>
            <tr><th>Order</th><th>Date</th><th>Items</th><th>Status</th><th>Total</th><th></th></tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                className="account-order-row is-clickable"
                data-open-order={order.id}
                role="button"
                tabIndex="0"
                onClick={() => onOpen(order.id)}
                key={order.id}
              >
                <td data-label="Order">
                  <span className="account-order-id"><i className="far fa-receipt" aria-hidden="true"></i>{order.number}</span>
                </td>
                <td data-label="Date">{order.date}</td>
                <td data-label="Items">{order.itemsCount ?? (order.items ?? []).length}</td>
                <td data-label="Status"><span className="account-status">{order.status}</span></td>
                <td data-label="Total"><strong>{order.totalFormatted}</strong></td>
                <td data-label="">
                  <button type="button" className="account-order-view" data-open-order={order.id}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div id="accountOrderDetail" className="account-order-detail-host" hidden={!openOrder}>
        <OrderDetail order={openOrder} onClose={onClose} />
      </div>
    </div>
  )
}

export default function Account() {
  const { page = 'overview' } = useParams()
  const [searchParams] = useSearchParams()
  const logout = useAuthStore((s) => s.logout)

  // One call for the whole area, as AccountController::bootstrap did — the payload does not
  // vary by page, so switching tabs re-renders rather than re-fetching.
  const { data, loading, refetch } = useApi(() => api.account.page('overview'), [])
  const [openOrderId, setOpenOrderId] = useState(null)
  const [feedback, setFeedback] = useState({ message: '', error: false })

  useBodyClass('customer-account-page')
  usePageTitle('My Account - The Purple Panther')

  if (!PAGES.has(page)) return <Navigate to="/account/overview" replace />
  if (loading) return <Loading full />
  if (!data) return null

  const customer = data.customer ?? {}
  const orders = data.orders ?? []
  const addresses = data.addresses ?? []
  const wishlist = data.wishlist ?? []
  const reviews = data.reviews ?? []

  const pageNumber = Number.parseInt(searchParams.get('page') ?? '1', 10) || 1
  const accountUrl = (slug) => `/account/${slug}`

  function announce(message, error = false) {
    setFeedback({ message, error })
  }

  async function removeWishlist(id) {
    try {
      await api.account.removeWishlistItem(id)
      announce('Removed from wishlist.')
      refetch()
    } catch (error) {
      announce(error.message || 'Could not remove that item.', true)
    }
  }

  async function removeReview(id) {
    try {
      await api.account.deleteReview(id)
      announce('Review deleted.')
      refetch()
    } catch (error) {
      announce(error.message || 'Could not delete that review.', true)
    }
  }

  const content = () => {
    switch (page) {
      case 'orders': {
        const meta = paginate(orders, pageNumber)
        return (
          <>
            <div className="account-title"><p>ACCOUNT</p><h1>Order History</h1></div>
            <Panel title="All orders">
              <OrderTable
                orders={meta.items}
                openOrderId={openOrderId}
                onOpen={setOpenOrderId}
                onClose={() => setOpenOrderId(null)}
              />
              <PaginationNav meta={meta} base={accountUrl('orders')} />
            </Panel>
          </>
        )
      }

      case 'information':
        return (
          <>
            <div className="account-title"><p>ACCOUNT</p><h1>Information</h1></div>
            <Panel title="Contact">
              <ProfileForm customer={customer} onSaved={(message) => { announce(message); refetch() }} />
            </Panel>
          </>
        )

      case 'addresses':
        return (
          <>
            <div className="account-title"><p>ACCOUNT</p><h1>Addresses</h1></div>
            <AddressBook addresses={addresses} onChanged={(message) => { announce(message); refetch() }} />
          </>
        )

      case 'wishlist': {
        const meta = paginate(wishlist, pageNumber)
        return (
          <>
            <div className="account-title"><p>ACCOUNT</p><h1>Wishlist</h1></div>
            <Panel title="Saved pieces">
              {meta.total === 0 ? (
                <Empty title="No wishlist items yet" copy="Select the heart on a product to save it here." />
              ) : (
                <>
                  <div id="wishlistList" className="account-products">
                    {meta.items.map((product) => (
                      <article className="account-product" data-wishlist-id={product.id} key={product.id}>
                        <Link to={product.url}><img src={product.image} alt={product.name} /></Link>
                        <div>
                          <h3><Link to={product.url}>{product.name}</Link></h3>
                          <p>
                            {product.price > 0 ? (
                              <span className="pp-price pp-price--has-selling-price">
                                {/* MRP only when it beats the price — otherwise the stylesheet strikes an equal figure. */}
                                {product.discountPercent > 0 && product.mrp > product.price ? (
                                  <>
                                    <span className="pp-price__mrp"><s>{product.mrpFormatted}</s></span>
                                    <span className="pp-price__discount">-{product.discountPercent}%</span>
                                  </>
                                ) : null}
                                <span className="pp-price__selling">{product.priceFormatted}</span>
                              </span>
                            ) : (
                              <span className="pp-price pp-price--mrp-only">
                                <span className="pp-price__mrp">{product.mrpFormatted}</span>
                              </span>
                            )}
                          </p>
                          <span className="account-availability">{product.availability}</span>
                          <Link className="account-primary" to={product.url}>View product</Link>
                          <button
                            className="account-remove"
                            type="button"
                            data-remove-wishlist={product.id}
                            onClick={() => removeWishlist(product.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  <PaginationNav meta={meta} base={accountUrl('wishlist')} />
                </>
              )}
            </Panel>
          </>
        )
      }

      case 'reviews': {
        const meta = paginate(reviews, pageNumber)
        return (
          <>
            <div className="account-title"><p>ACCOUNT</p><h1>My Reviews</h1></div>
            <Panel title="Your product reviews">
              {meta.total === 0 ? (
                <Empty title="No reviews yet" copy="Reviews you write on products will appear here." />
              ) : (
                <>
                  <div id="reviewList" className="account-products">
                    {meta.items.map((review) => (
                      <article className="account-product account-review-card" data-review-id={review.id} key={review.id}>
                        <Link to={review.productUrl}><img src={review.productImage} alt={review.productName} /></Link>
                        <div>
                          <h3><Link to={review.productUrl}>{review.productName}</Link></h3>
                          <div className="account-review-stars" aria-label={`Rated ${review.rating} out of 5`}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span className="account-star" style={{ opacity: star <= review.rating ? 1 : 0.25 }} key={star}>★</span>
                            ))}
                          </div>
                          <p className="account-review-comment">{review.comment}</p>
                          <span className="account-review-date">{review.date}</span>
                          {/* Reviews left as a guest match by email but carry no user id, and
                              the server refuses to delete those — so the control is hidden
                              rather than offered and then rejected. */}
                          {review.canDelete && (
                            <button
                              className="account-remove"
                              type="button"
                              data-remove-review={review.id}
                              onClick={() => removeReview(review.id)}
                            >
                              Delete review
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                  <PaginationNav meta={meta} base={accountUrl('reviews')} />
                </>
              )}
            </Panel>
          </>
        )
      }

      default:
        return (
          <>
            <div className="account-welcome">
              <p>WELCOME BACK</p>
              <h1>Hello, {customer.firstName}</h1>
              <span>Manage your details, orders, wishlist, and reviews.</span>
            </div>
            <div className="account-summary">
              {[
                ['Orders', orders.length, accountUrl('orders')],
                ['Addresses', addresses.length, accountUrl('addresses')],
                ['Wishlist', wishlist.length, accountUrl('wishlist')],
                ['Reviews', reviews.length, accountUrl('reviews')],
              ].map(([label, count, href]) => (
                <Link to={href} key={label}>
                  <strong>{count}</strong><span>{label}</span><small>View details →</small>
                </Link>
              ))}
            </div>
            <Panel
              title="Recent orders"
              action={<Link to={accountUrl('orders')} className="account-text-button">View all</Link>}
            >
              <OrderTable
                orders={orders.slice(0, 3)}
                openOrderId={openOrderId}
                onOpen={setOpenOrderId}
                onClose={() => setOpenOrderId(null)}
              />
            </Panel>
            <div className="account-quick">
              <Link to={accountUrl('information')}>Edit profile</Link>
              <Link to={accountUrl('addresses')}>Add an address</Link>
              <Link to="/collection">Continue shopping</Link>
            </div>
          </>
        )
    }
  }

  return (
    <div id="account-app" className="account-app" data-account-page={page}>
      <main className="account-shell">
        <div className="account-layout">
          <button className="account-nav-toggle" type="button" aria-expanded="false" aria-controls="accountNav">
            Account menu <span>+</span>
          </button>
          <nav id="accountNav" className="account-nav" aria-label="Customer account">
            <h2>Account</h2>
            {NAV_ITEMS.map(([slug, label, icon]) => (
              <Link
                to={accountUrl(slug)}
                className={slug === page ? 'active' : undefined}
                aria-current={slug === page ? 'page' : undefined}
                key={slug}
              >
                <i className={`far ${icon}`} aria-hidden="true"></i><span>{label}</span>
              </Link>
            ))}
            <button type="button" data-action="logout" onClick={() => logout()}>
              <i className="far fa-arrow-right-from-bracket" aria-hidden="true"></i><span>Logout</span>
            </button>
          </nav>
          <div className="account-content">
            <div
              className={`account-feedback${feedback.error ? ' is-error' : ''}`}
              role="status"
              hidden={!feedback.message}
            >
              {feedback.message}
            </div>
            {content()}
          </div>
        </div>
      </main>
    </div>
  )
}
