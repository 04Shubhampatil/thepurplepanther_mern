import { useState } from 'react'
import { Search } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import Loading from '../../components/common/Loading.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import Pagination from '../../components/common/Pagination.jsx'
import Modal from '../../components/ui/Modal.jsx'
import Alert from '../../components/ui/Alert.jsx'
import { formatDate } from '../../utils/format.js'
import {
  AdminPage,
  Table,
  Th,
  Td,
  EmptyRow,
  AdminButton,
  Pill,
  CONTROL,
} from '../../components/admin/AdminUI.jsx'

const STATUSES = ['pending', 'placed', 'packed', 'shipped', 'delivered', 'cancelled']

/**
 * Order management.
 *
 * The status dropdown is populated from the SERVER's `nextOptions` for that order, so the
 * UI can only ever offer a legal transition — and the server refuses anything else
 * regardless. `delivered` and `cancelled` are terminal, so their option lists are empty.
 */
export default function Orders() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState(null)
  const [statusData, setStatusData] = useState(null)
  const [notice, setNotice] = useState(null)

  const { data, error, loading, refetch } = useApi(
    () =>
      api.admin.orders.list({ page, search: search || undefined, status: status || undefined }),
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

  const closeOrder = () => {
    setSelected(null)
    setStatusData(null)
  }

  const changeStatus = async (nextStatus) => {
    setNotice(null)
    try {
      await api.admin.orders.updateStatus(selected.id, { status: nextStatus })
      setNotice(`Order ${selected.orderNumber} updated. The customer has been emailed.`)
      closeOrder()
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

  const statusTone = (value) => {
    if (value === 'delivered') return 'good'
    if (value === 'cancelled') return 'bad'
    if (value === 'pending') return 'warn'
    return 'brand'
  }

  return (
    <AdminPage title="Orders">
      {notice && (
        <Alert tone="info" className="mb-5">
          {notice}
        </Alert>
      )}

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            size={16}
            strokeWidth={1.5}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body"
          />
          <label htmlFor="order-search" className="sr-only">
            Search orders
          </label>
          <input
            id="order-search"
            type="search"
            placeholder="Search by order number, name, email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className={`${CONTROL} w-full pl-9`}
          />
        </div>

        <div>
          <label htmlFor="order-status" className="sr-only">
            Filter by status
          </label>
          <select
            id="order-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            className={`${CONTROL} w-[180px] capitalize`}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Table
        caption="Orders"
        head={
          <>
            <Th>Order</Th>
            <Th>Customer</Th>
            <Th>Date</Th>
            <Th>Payment</Th>
            <Th>Status</Th>
            <Th className="text-right">Total</Th>
            <Th className="text-right">
              <span className="sr-only">Actions</span>
            </Th>
          </>
        }
      >
        {(data?.items ?? []).map((order) => (
          <tr key={order.id}>
            <Td className="whitespace-nowrap font-semibold">{order.orderNumber}</Td>
            <Td>
              {order.userName}
              <span className="mt-0.5 block break-all text-[12px] text-body">
                {order.userEmail}
              </span>
            </Td>
            <Td className="whitespace-nowrap">{formatDate(order.orderedAt)}</Td>
            <Td>
              <Pill tone={order.paymentStatus === 'paid' ? 'good' : 'warn'}>
                {order.paymentStatus}
              </Pill>
            </Td>
            <Td>
              <Pill tone={statusTone(order.status)}>{order.statusLabel}</Pill>
            </Td>
            <Td className="whitespace-nowrap text-right">{money(order.payableAmount)}</Td>
            <Td className="text-right">
              <AdminButton onClick={() => openOrder(order)}>
                Manage
                <span className="sr-only"> order {order.orderNumber}</span>
              </AdminButton>
            </Td>
          </tr>
        ))}

        {data?.items?.length === 0 && <EmptyRow colSpan={7}>No orders found.</EmptyRow>}
      </Table>

      <Pagination pagination={data?.pagination} onPage={setPage} />

      <Modal
        open={Boolean(selected && statusData)}
        onClose={closeOrder}
        title={selected ? `Order ${selected.orderNumber}` : ''}
      >
        {selected && statusData && (
          <div className="space-y-7">
            <p className="text-[14px] text-body">
              {selected.shippingName} · {selected.shippingPhone} · {selected.shippingEmail}
            </p>

            <section>
              <h3 className="pp-eyebrow text-ink">Items</h3>
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {selected.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-4 py-2.5 text-[14px]">
                    <span className="text-ink">
                      {item.productTitle}
                      <span className="text-body"> × {item.quantity}</span>
                    </span>
                    <span className="shrink-0 text-ink">{money(item.totalPrice)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="pp-eyebrow text-ink">Status</h3>
              <p className="mt-2 text-[14px] text-body">
                Current:{' '}
                <strong className="font-semibold text-ink">{statusData.statusLabel}</strong>
              </p>

              {statusData.options.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {statusData.options.map((option) => (
                    <AdminButton key={option.value} onClick={() => changeStatus(option.value)}>
                      Mark {option.label}
                    </AdminButton>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[14px] text-body">
                  This order is {statusData.statusLabel.toLowerCase()} and cannot be changed
                  further.
                </p>
              )}
            </section>

            <section>
              <h3 className="pp-eyebrow text-ink">Expected delivery</h3>
              <label htmlFor="order-delivery-date" className="sr-only">
                Expected delivery date
              </label>
              <input
                id="order-delivery-date"
                type="date"
                defaultValue={
                  statusData.expectedDeliveryDate
                    ? new Date(statusData.expectedDeliveryDate).toISOString().slice(0, 10)
                    : ''
                }
                onBlur={(e) => e.target.value && setDeliveryDate(e.target.value)}
                className={`${CONTROL} mt-3 w-[220px]`}
              />
            </section>

            <section>
              <h3 className="pp-eyebrow text-ink">History</h3>
              <ul className="mt-3 space-y-3">
                {statusData.logs.map((log) => (
                  <li key={log.id} className="border-l-2 border-line pl-4 text-[14px]">
                    <strong className="font-semibold text-ink">{log.title}</strong>
                    <span className="text-body"> — {log.description}</span>
                    <span className="mt-0.5 block text-[12px] text-body">
                      {formatDate(log.loggedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </Modal>
    </AdminPage>
  )
}
