import { useState } from 'react'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import Loading from '../../components/common/Loading.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import Pagination from '../../components/common/Pagination.jsx'
import { formatDate } from '../../utils/format.js'

/**
 * Order management.
 *
 * The status dropdown is populated from the SERVER's `nextOptions` for that order, so the
 * UI can only ever offer a legal transition — and the server refuses anything else
 * regardless. `delivered` and `cancelled` are terminal, so their dropdowns are empty.
 */
export default function Orders() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState(null)
  const [statusData, setStatusData] = useState(null)
  const [notice, setNotice] = useState(null)

  const { data, error, loading, refetch } = useApi(
    () => api.admin.orders.list({ page, search: search || undefined, status: status || undefined }),
    [page, search, status],
  )

  const openOrder = async (order) => {
    const [detail, statuses] = await Promise.all([
      api.admin.orders.show(order.id),
      api.admin.orders.statusData(order.id),
    ])
    setSelected(detail.order)
    setStatusData(statuses)
  }

  const changeStatus = async (nextStatus) => {
    setNotice(null)
    try {
      await api.admin.orders.updateStatus(selected.id, { status: nextStatus })
      setNotice(`Order ${selected.orderNumber} updated. The customer has been emailed.`)
      setSelected(null)
      refetch()
    } catch (err) {
      setNotice(err.message)
    }
  }

  const setDeliveryDate = async (date) => {
    setNotice(null)
    try {
      await api.admin.orders.updateDeliveryDate(selected.id, date)
      setNotice('Delivery date updated. The customer has been emailed.')
      refetch()
    } catch (err) {
      setNotice(err.message)
    }
  }

  if (loading && !data) return <Loading full />
  if (error) return <ErrorMessage error={error} onRetry={refetch} />

  const money = (value) => `₹ ${Number(value).toFixed(2)}`

  return (
    <div>
      <h1 style={{ fontSize: 24 }}>Orders</h1>

      {notice && (
        <div className="alert alert-info" role="status">
          {notice}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, margin: '16px 0' }}>
        <input
          className="form-control"
          placeholder="Search by order number, name, email…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          style={{ maxWidth: 320 }}
          aria-label="Search orders"
        />

        <select
          className="form-control"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          style={{ maxWidth: 180 }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {['pending', 'placed', 'packed', 'shipped', 'delivered', 'cancelled'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th scope="col">Order</th>
            <th scope="col">Customer</th>
            <th scope="col">Date</th>
            <th scope="col">Payment</th>
            <th scope="col">Status</th>
            <th scope="col">Total</th>
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {(data?.items ?? []).map((order) => (
            <tr key={order.id}>
              <td>{order.orderNumber}</td>
              <td>
                {order.userName}
                <br />
                <small style={{ opacity: 0.7 }}>{order.userEmail}</small>
              </td>
              <td>{formatDate(order.orderedAt)}</td>
              <td>
                <span className={order.paymentStatus === 'paid' ? 'pp-badge' : ''}>
                  {order.paymentStatus}
                </span>
              </td>
              <td>{order.statusLabel}</td>
              <td>{money(order.payableAmount)}</td>
              <td>
                <button type="button" onClick={() => openOrder(order)}>
                  Manage
                </button>
              </td>
            </tr>
          ))}

          {data?.items?.length === 0 && (
            <tr>
              <td colSpan="7" style={{ opacity: 0.6 }}>
                No orders found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Pagination pagination={data?.pagination} onPage={setPage} />

      {selected && statusData && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Manage order ${selected.orderNumber}`}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: 24,
              width: 'min(680px, 94vw)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 20 }}>Order {selected.orderNumber}</h2>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close">
                ×
              </button>
            </div>

            <p style={{ opacity: 0.75 }}>
              {selected.shippingName} · {selected.shippingPhone} · {selected.shippingEmail}
            </p>

            <h3 style={{ fontSize: 16 }}>Items</h3>
            <ul style={{ paddingLeft: 18 }}>
              {selected.items.map((item) => (
                <li key={item.id}>
                  {item.productTitle} × {item.quantity} — {money(item.totalPrice)}
                </li>
              ))}
            </ul>

            <h3 style={{ fontSize: 16 }}>Status</h3>
            <p>
              Current: <strong>{statusData.statusLabel}</strong>
            </p>

            {statusData.options.length > 0 ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {statusData.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="btn btn-outline-dark"
                    onClick={() => changeStatus(option.value)}
                  >
                    Mark {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ opacity: 0.7 }}>
                This order is {statusData.statusLabel.toLowerCase()} and cannot be changed further.
              </p>
            )}

            <h3 style={{ fontSize: 16, marginTop: 20 }}>Expected delivery</h3>
            <input
              type="date"
              className="form-control"
              defaultValue={
                statusData.expectedDeliveryDate
                  ? new Date(statusData.expectedDeliveryDate).toISOString().slice(0, 10)
                  : ''
              }
              onBlur={(e) => e.target.value && setDeliveryDate(e.target.value)}
              style={{ maxWidth: 220 }}
              aria-label="Expected delivery date"
            />

            <h3 style={{ fontSize: 16, marginTop: 20 }}>History</h3>
            <ul style={{ paddingLeft: 18 }}>
              {statusData.logs.map((log) => (
                <li key={log.id}>
                  <strong>{log.title}</strong> — {log.description}
                  <br />
                  <small style={{ opacity: 0.6 }}>{formatDate(log.loggedAt)}</small>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
