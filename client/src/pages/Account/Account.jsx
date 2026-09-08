import { useState } from 'react'
import { useParams, Link, NavLink } from 'react-router-dom'
import { Package, Heart, MapPin, Trash2 } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import { useAuthStore } from '../../store/index.js'
import Loading from '../../components/common/Loading.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import Seo from '../../components/common/Seo.jsx'
import NotFound from '../NotFound.jsx'
import ProfileForm from './ProfileForm.jsx'
import AddressBook from './AddressBook.jsx'
import Container from '../../components/ui/Container.jsx'
import Image from '../../components/ui/Image.jsx'
import Badge from '../../components/ui/Badge.jsx'
import Alert from '../../components/ui/Alert.jsx'
import Rating from '../../components/product/Rating.jsx'

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
 *
 * The tab rail is a sidebar on desktop and a horizontally scrolling row on mobile, which
 * keeps every section one tap away without a dropdown.
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

  const tabClass = ({ isActive }) =>
    [
      'block whitespace-nowrap border-b-2 px-1 py-2 text-[14px] transition-colors md:border-b-0 md:border-l-2 md:px-4 md:py-2.5',
      isActive
        ? 'border-brand text-brand'
        : 'border-transparent text-body hover:text-ink md:hover:border-line',
    ].join(' ')

  const statLink = (to, Icon, value, label) => (
    <Link
      to={to}
      className="flex items-center gap-3 border border-line p-5 transition-colors hover:border-brand"
    >
      <Icon size={20} strokeWidth={1.5} aria-hidden="true" className="text-brand" />
      <span>
        <span className="block text-[20px] font-semibold text-ink">{value}</span>
        <span className="text-[13px] text-body">{label}</span>
      </span>
    </Link>
  )

  return (
    <Container className="py-10 md:py-14">
      <Seo title={data.title ?? 'Account'} noIndex />

      <div className="grid gap-8 md:grid-cols-[220px_1fr] md:gap-12">
        <nav aria-label="Account" className="md:border-r md:border-line md:pr-6">
          <h1 className="pp-heading">My account</h1>
          <p className="mt-1 break-words text-[13px] text-body">{customer.email}</p>

          {/* Scrolls horizontally on narrow screens rather than wrapping into a block. */}
          <ul className="-mx-4 mt-6 flex gap-5 overflow-x-auto px-4 md:mx-0 md:block md:space-y-0.5 md:overflow-visible md:px-0">
            {TABS.map(([slug, label]) => (
              <li key={slug} className="shrink-0 md:shrink">
                <NavLink to={`/account/${slug}`} className={tabClass} end>
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          {notice && (
            <Alert tone="success" className="mb-6">
              {notice}
            </Alert>
          )}

          {page === 'overview' && (
            <section>
              <h2 className="pp-heading">Hello, {customer.firstName}</h2>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {statLink('/account/orders', Package, orders.length, orders.length === 1 ? 'Order' : 'Orders')}
                {statLink(
                  '/account/addresses',
                  MapPin,
                  addresses.length,
                  addresses.length === 1 ? 'Saved address' : 'Saved addresses',
                )}
                {statLink(
                  '/account/wishlist',
                  Heart,
                  wishlist.length,
                  wishlist.length === 1 ? 'Wishlist item' : 'Wishlist items',
                )}
              </div>

              {orders.length > 0 && (
                <>
                  <h3 className="pp-eyebrow mt-10 text-ink">Recent orders</h3>
                  <ul className="mt-4 space-y-3">
                    {orders.slice(0, 3).map((order) => (
                      <li key={order.id}>
                        <article className="flex flex-wrap items-center justify-between gap-3 border border-line p-4">
                          <div>
                            <span className="text-[14px] font-semibold text-ink">
                              {order.number}
                            </span>
                            <p className="text-[13px] text-body">
                              {order.date} · {order.status}
                            </p>
                          </div>
                          <span className="text-[14px] text-ink">{order.totalFormatted}</span>
                        </article>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {page === 'orders' && (
            <section>
              <h2 className="pp-heading">Orders</h2>

              {orders.length === 0 ? (
                <p className="mt-4 text-body">
                  You have not placed any orders yet.{' '}
                  <Link to="/shop" className="text-brand underline underline-offset-2">
                    Start shopping
                  </Link>
                  .
                </p>
              ) : (
                <ul className="mt-6 space-y-5">
                  {orders.map((order) => (
                    <li key={order.id}>
                      <article className="border border-line p-5">
                        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                          <div>
                            <span className="text-[15px] font-semibold text-ink">
                              {order.number}
                            </span>
                            <p className="text-[13px] text-body">
                              {order.date} · {order.itemsCount} item
                              {order.itemsCount === 1 ? '' : 's'}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge tone="outline">{order.status}</Badge>
                            <p className="mt-1.5 text-[15px] font-semibold text-ink">
                              {order.totalFormatted}
                            </p>
                          </div>
                        </header>

                        <ul className="mt-4 space-y-3">
                          {order.items.map((item, index) => (
                            <li key={index} className="flex items-start gap-3">
                              <Image src={item.image} alt="" className="w-[48px] shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-[14px] text-ink">{item.title}</p>
                                {(item.color || item.size) && (
                                  <p className="text-[12px] text-body">
                                    {[item.color, item.size].filter(Boolean).join(' / ')}
                                  </p>
                                )}
                              </div>
                              <span className="shrink-0 text-[13px] text-body">× {item.qty}</span>
                              <span className="w-20 shrink-0 text-right text-[14px] text-ink">
                                {item.totalFormatted}
                              </span>
                            </li>
                          ))}
                        </ul>

                        {order.expectedDeliveryDate && (
                          <p className="mt-4 border-t border-line pt-3 text-[13px] text-body">
                            Expected delivery:{' '}
                            {new Date(order.expectedDeliveryDate).toLocaleDateString('en-GB')}
                          </p>
                        )}
                      </article>
                    </li>
                  ))}
                </ul>
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
              <h2 className="pp-heading">Wishlist</h2>

              {wishlist.length === 0 ? (
                <p className="mt-4 text-body">
                  Your wishlist is empty.{' '}
                  <Link to="/shop" className="text-brand underline underline-offset-2">
                    Find something you love
                  </Link>
                  .
                </p>
              ) : (
                <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3">
                  {wishlist.map((item) => (
                    <li key={item.id}>
                      <Link to={item.url} className="group block">
                        <Image src={item.image} alt="" />
                        <h3 className="mt-3 text-[14px] text-ink transition-colors group-hover:text-brand">
                          {item.name}
                        </h3>
                      </Link>
                      <p className="mt-1 text-[14px] text-ink">{item.priceFormatted}</p>
                      <p className="text-[12px] text-body">{item.availability}</p>
                      <button
                        type="button"
                        onClick={() => removeWishlistItem(item)}
                        className="mt-2 inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.08em] text-body transition-colors hover:text-brand"
                      >
                        <Trash2 size={13} strokeWidth={1.5} aria-hidden="true" />
                        Remove
                        <span className="sr-only"> {item.name} from wishlist</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {page === 'reviews' && (
            <section>
              <h2 className="pp-heading">My reviews</h2>

              {reviews.length === 0 ? (
                <p className="mt-4 text-body">You have not written any reviews yet.</p>
              ) : (
                <ul className="mt-6">
                  {reviews.map((review) => (
                    <li key={review.id} className="border-b border-line py-5 first:border-t">
                      <Link
                        to={review.productUrl}
                        className="text-[14px] text-ink transition-colors hover:text-brand"
                      >
                        {review.productName}
                      </Link>

                      <Rating value={review.rating} className="mt-1" />

                      {review.comment && <p className="mt-1 text-body">{review.comment}</p>}
                      <p className="mt-1 text-[12px] text-body">{review.date}</p>

                      {/* A review matched by email rather than user id cannot be deleted —
                          the control is hidden rather than offering an action that fails. */}
                      {review.canDelete && (
                        <button
                          type="button"
                          onClick={() => removeReview(review)}
                          className="mt-2 inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.08em] text-body transition-colors hover:text-brand"
                        >
                          <Trash2 size={13} strokeWidth={1.5} aria-hidden="true" />
                          Delete
                          <span className="sr-only"> review of {review.productName}</span>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </Container>
  )
}
