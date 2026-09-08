import { useState } from 'react'
import { useParams, Link, NavLink } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import { useAuthStore } from '../../store/index.js'
import Money from '../../components/common/Money.jsx'
import Loading from '../../components/common/Loading.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import Seo from '../../components/common/Seo.jsx'
import NotFound from '../NotFound.jsx'
import ProfileForm from './ProfileForm.jsx'
import AddressBook from './AddressBook.jsx'

const TABS = [
  ['overview', 'Overview'],
  ['orders', 'Orders'],
  ['information', 'Account Information'],
  ['addresses', 'Addresses'],
  ['wishlist', 'Wishlist'],
  ['reviews', 'My Reviews'],
]

/**
 * Account area.
 *
 * One request loads everything — the server's `bootstrap` returns the customer, orders,
 * addresses, wishlist and reviews together, exactly as AccountController::bootstrap did.
 * Switching tabs is therefore instant and does not re-fetch.
 */
export default function Account() {
  const { page = 'overview' } = useParams()
  const setUser = useAuthStore((s) => s.setUser)
  const { data, error, loading, refetch, setData } = useApi(() => api.account.page(page), [page])
  const [notice, setNotice] = useState(null)

  if (error?.status === 404) return <NotFound />
  if (loading && !data) return <Loading full />
  if (error) return <ErrorMessage error={error} onRetry={refetch} />
  if (!data) return null

  const { customer, orders = [], addresses = [], wishlist = [], reviews = [] } = data

  const removeWishlistItem = async (item) => {
    await api.account.removeWishlistItem(item.id)
    setData({ ...data, wishlist: wishlist.filter((w) => w.id !== item.id) })
  }

  const removeReview = async (review) => {
    await api.account.deleteReview(review.id)
    setData({ ...data, reviews: reviews.filter((r) => r.id !== review.id) })
  }

  return (
    <div className="container pp-account" style={{ padding: '32px 0' }}>
      <Seo title={data.title ?? 'Account'} noIndex />

      <div className="row">
        <nav className="col-md-3" aria-label="Account">
          <h1 style={{ fontSize: 22 }}>My account</h1>
          <p style={{ opacity: 0.75 }}>{customer.email}</p>

          <ul style={{ listStyle: 'none', padding: 0 }}>
            {TABS.map(([slug, label]) => (
              <li key={slug}>
                <NavLink to={`/account/${slug}`} className={({ isActive }) => (isActive ? 'is-active' : '')}>
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="col-md-9">
          {notice && (
            <div className="alert alert-success" role="status">
              {notice}
            </div>
          )}

          {page === 'overview' && (
            <section>
              <h2>Hello, {customer.firstName}</h2>
              <p style={{ opacity: 0.8 }}>
                You have {orders.length} order{orders.length === 1 ? '' : 's'},{' '}
                {addresses.length} saved address{addresses.length === 1 ? '' : 'es'} and{' '}
                {wishlist.length} wishlist item{wishlist.length === 1 ? '' : 's'}.
              </p>

              {orders.slice(0, 3).map((order) => (
                <article key={order.id} style={{ border: '1px solid #eee', padding: 16, marginTop: 12 }}>
                  <strong>{order.number}</strong> · {order.date} · {order.status}
                  <div style={{ float: 'right' }}>
                    <Money formatted={order.totalFormatted} />
                  </div>
                </article>
              ))}
            </section>
          )}

          {page === 'orders' && (
            <section>
              <h2>Orders</h2>
              {orders.length === 0 ? (
                <p style={{ opacity: 0.7 }}>
                  You have not placed any orders yet. <Link to="/shop">Start shopping</Link>.
                </p>
              ) : (
                orders.map((order) => (
                  <article key={order.id} style={{ border: '1px solid #eee', padding: 16, marginBottom: 16 }}>
                    <header style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <strong>{order.number}</strong>
                        <p style={{ margin: 0, opacity: 0.7 }}>
                          {order.date} · {order.itemsCount} item{order.itemsCount === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="pp-badge">{order.status}</span>
                        <p style={{ margin: 0, fontWeight: 700 }}>
                          <Money formatted={order.totalFormatted} />
                        </p>
                      </div>
                    </header>

                    <ul style={{ listStyle: 'none', padding: 0, marginTop: 12 }}>
                      {order.items.map((item, index) => (
                        <li key={index} style={{ display: 'flex', gap: 10, padding: '6px 0' }}>
                          <img src={item.image} alt="" width="48" height="64" loading="lazy" />
                          <span style={{ flex: 1 }}>
                            {item.title}
                            {(item.color || item.size) && (
                              <em style={{ display: 'block', fontSize: 12, opacity: 0.7 }}>
                                {[item.color, item.size].filter(Boolean).join(' / ')}
                              </em>
                            )}
                          </span>
                          <span>× {item.qty}</span>
                          <Money formatted={item.totalFormatted} />
                        </li>
                      ))}
                    </ul>

                    {order.expectedDeliveryDate && (
                      <p style={{ fontSize: 13, opacity: 0.8 }}>
                        Expected delivery: {new Date(order.expectedDeliveryDate).toLocaleDateString('en-GB')}
                      </p>
                    )}
                  </article>
                ))
              )}
            </section>
          )}

          {page === 'information' && (
            <ProfileForm
              customer={customer}
              onSaved={(updated) => {
                setData({ ...data, customer: updated })
                setUser({ ...updated, role: 'customer' })
                setNotice('Your information has been saved.')
              }}
            />
          )}

          {page === 'addresses' && (
            <AddressBook
              addresses={addresses}
              onChange={(next) => setData({ ...data, addresses: next })}
            />
          )}

          {page === 'wishlist' && (
            <section>
              <h2>Wishlist</h2>
              {wishlist.length === 0 ? (
                <p style={{ opacity: 0.7 }}>
                  Your wishlist is empty. <Link to="/shop">Find something you love</Link>.
                </p>
              ) : (
                <div className="row">
                  {wishlist.map((item) => (
                    <div className="col-sm-6 col-md-4" key={item.id}>
                      <div style={{ border: '1px solid #eee', padding: 12, marginBottom: 16 }}>
                        <Link to={item.url}>
                          <img src={item.image} alt="" style={{ width: '100%' }} loading="lazy" />
                          <h3 style={{ fontSize: 15 }}>{item.name}</h3>
                        </Link>
                        <Money formatted={item.priceFormatted} />
                        <p style={{ fontSize: 12, opacity: 0.7 }}>{item.availability}</p>
                        <button type="button" onClick={() => removeWishlistItem(item)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {page === 'reviews' && (
            <section>
              <h2>My reviews</h2>
              {reviews.length === 0 ? (
                <p style={{ opacity: 0.7 }}>You have not written any reviews yet.</p>
              ) : (
                reviews.map((review) => (
                  <article key={review.id} style={{ borderBottom: '1px solid #eee', padding: '14px 0' }}>
                    <Link to={review.productUrl}>{review.productName}</Link>
                    <p style={{ margin: '4px 0', color: '#e0a800' }}>{'★'.repeat(review.rating)}</p>
                    {review.comment && <p>{review.comment}</p>}
                    <p style={{ fontSize: 12, opacity: 0.6 }}>{review.date}</p>

                    {/* A review matched by email rather than user id cannot be deleted —
                        the control is hidden rather than offering an action that fails. */}
                    {review.canDelete && (
                      <button type="button" onClick={() => removeReview(review)}>
                        Delete
                      </button>
                    )}
                  </article>
                ))
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
