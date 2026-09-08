import { Link } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import Loading from '../../components/common/Loading.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import { formatDate } from '../../utils/format.js'

function Stat({ label, value, hint = null }) {
  return (
    <div style={{ border: '1px solid #eee', padding: 18, borderRadius: 4 }}>
      <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>{label}</p>
      <p style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 700 }}>{value}</p>
      {hint && <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>{hint}</p>}
    </div>
  )
}

/** Aggregates only — the server counts in the database rather than loading tables. */
export default function Dashboard() {
  const { data, error, loading, refetch } = useApi(() => api.admin.dashboard(), [])

  if (loading) return <Loading full />
  if (error) return <ErrorMessage error={error} onRetry={refetch} />

  const { products, orders, customers, subscribers, contactMessages, revenue, recentOrders } = data

  const money = (value) =>
    `₹ ${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Dashboard</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <Stat label="Revenue (paid)" value={money(revenue.total)} hint={`${money(revenue.thisMonth)} this month`} />
        <Stat label="Orders" value={orders.total} hint={`${orders.paid} paid`} />
        <Stat label="Products" value={products.total} hint={`${products.active} active`} />
        <Stat label="Customers" value={customers} />
        <Stat label="Subscribers" value={subscribers} />
        <Stat label="Messages" value={contactMessages} />
      </div>

      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18 }}>Orders by status</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Object.entries(orders.byStatus).map(([status, count]) => (
            <span key={status} style={{ border: '1px solid #eee', padding: '6px 12px', borderRadius: 20 }}>
              {status}: <strong>{count}</strong>
            </span>
          ))}
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ fontSize: 18 }}>Recent orders</h2>
          <Link to="/admin/orders">View all</Link>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Customer</th>
              <th scope="col">Date</th>
              <th scope="col">Status</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.map((order) => (
              <tr key={order.id}>
                <td>{order.orderNumber}</td>
                <td>{order.userName}</td>
                <td>{formatDate(order.orderedAt)}</td>
                <td>{order.statusLabel}</td>
                <td>{money(order.payableAmount)}</td>
              </tr>
            ))}
            {recentOrders.length === 0 && (
              <tr>
                <td colSpan="5" style={{ opacity: 0.6 }}>
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
