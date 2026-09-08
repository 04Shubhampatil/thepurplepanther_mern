import { useParams, Link } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import Money from '../../components/common/Money.jsx'
import Loading from '../../components/common/Loading.jsx'
import Seo from '../../components/common/Seo.jsx'
import NotFound from '../NotFound.jsx'
import { formatDate } from '../../utils/format.js'

/**
 * Order confirmation.
 *
 * The server refuses this page for an order that has not been paid, so a customer who
 * abandons payment cannot land on a page implying their order went through.
 */
export default function OrderConfirmation() {
  const { orderNumber } = useParams()
  const { data, error, loading } = useApi(() => api.checkout.order(orderNumber), [orderNumber])

  if (error?.status === 404) return <NotFound />
  if (loading) return <Loading full />

  if (error) {
    // 422 = payment not completed; 403 = someone else's order.
    return (
      <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
        <Seo title="Order" noIndex />
        <h1>We could not show this order</h1>
        <p style={{ opacity: 0.8 }}>{error.message}</p>
        <Link to="/cart" className="btn btn-primary" style={{ marginTop: 16 }}>
          Back to cart
        </Link>
      </div>
    )
  }

  const order = data?.order
  if (!order) return <NotFound />

  return (
    <div className="container pp-order" style={{ padding: '48px 0', maxWidth: 760 }}>
      <Seo title={`Order ${order.number}`} noIndex />

      <header style={{ textAlign: 'center', marginBottom: 32 }}>
        <p style={{ fontSize: 40, margin: 0 }}>✓</p>
        <h1>Thank you for your order</h1>
        <p style={{ opacity: 0.8 }}>
          Order <strong>{order.number}</strong> · {order.date}
        </p>
        <p style={{ opacity: 0.8 }}>
          A confirmation email is on its way to {order.shippingEmail}.
        </p>
      </header>

      <section style={{ border: '1px solid #eee', padding: 20 }}>
        <h2 style={{ fontSize: 18 }}>Your items</h2>

        <ul style={{ listStyle: 'none', padding: 0 }}>
          {order.items.map((item, index) => (
            <li
              key={index}
              style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid #f2f2f2' }}
            >
              <img src={item.image} alt="" width="56" height="75" loading="lazy" />
              <div style={{ flex: 1 }}>
                <strong>{item.title}</strong>
                {(item.color || item.size || item.packageLabel) && (
                  <p style={{ margin: '2px 0', fontSize: 13, opacity: 0.7 }}>
                    {[item.color, item.size, item.packageLabel].filter(Boolean).join(' / ')}
                  </p>
                )}
                <span style={{ fontSize: 13 }}>Qty {item.qty}</span>
              </div>
              <Money formatted={item.totalFormatted} />
            </li>
          ))}
        </ul>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
          <span>Subtotal</span>
          <Money formatted={order.subtotalFormatted} />
        </div>

        {order.discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</span>
            <span>− <Money formatted={order.discountFormatted} /></span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Delivery</span>
          <Money formatted={order.shippingFormatted} />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontWeight: 700,
            fontSize: 18,
            marginTop: 8,
            borderTop: '1px solid #eee',
            paddingTop: 8,
          }}
        >
          <span>Total paid</span>
          <Money formatted={order.totalFormatted} />
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18 }}>Delivering to</h2>
        <p style={{ opacity: 0.85 }}>
          {order.shippingName}
          <br />
          {order.shippingLines.join(', ')}
          <br />
          {order.shippingPhone}
        </p>

        {order.expectedDeliveryDate && (
          <p>Expected delivery: {formatDate(order.expectedDeliveryDate)}</p>
        )}
      </section>

      <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
        <Link to="/account/orders" className="btn btn-primary">
          View your orders
        </Link>
        <Link to="/shop" className="btn btn-outline-dark">
          Continue shopping
        </Link>
      </div>
    </div>
  )
}
