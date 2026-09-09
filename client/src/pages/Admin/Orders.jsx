import { useState } from 'react'
import { ArrowUpDown, Pencil, Eye, Trash2, ChevronDown } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import Loading from '../../components/common/Loading.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import Pagination from '../../components/common/Pagination.jsx'
import Modal from '../../components/ui/Modal.jsx'
import Alert from '../../components/ui/Alert.jsx'
import { formatDate } from '../../utils/format.js'
import { AdminPage, AdminButton, CONTROL } from '../../components/admin/AdminUI.jsx'

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
  const [status, setStatus] = useState('')
  const [date, setDate] = useState('')
  const [sort, setSort] = useState({ key: 'orderedAt', dir: 'desc' })
  const [checked, setChecked] = useState([])
  const [actionOpen, setActionOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [statusData, setStatusData] = useState(null)
  const [notice, setNotice] = useState(null)

  const { data, error, loading, refetch } = useApi(
    () =>
      api.admin.orders.list({
        page,
        status: status || undefined,
        date: date || undefined,
        sort: sort.key,
        dir: sort.dir,
      }),
    [page, status, date, sort],
  )

  const items = data?.items ?? []
  const allChecked = items.length > 0 && items.every((o) => checked.includes(o.id))

  const toggleAll = () => setChecked(allChecked ? [] : items.map((o) => o.id))
  const toggleOne = (id) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const toggleSort = (key) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
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

  const setDeliveryDate = async (value) => {
    setNotice(null)
    try {
      await api.admin.orders.updateDeliveryDate(selected.id, value)
      setNotice('Delivery date updated. The customer has been emailed.')
      refetch()
    } catch (err) {
      setNotice(err.message)
    }
  }

  const deleteOrder = async (order) => {
    if (!window.confirm(`Delete order ${order.orderNumber}? This cannot be undone.`)) return
    setNotice(null)
    try {
      await api.admin.orders.remove(order.id)
      setNotice(`Order ${order.orderNumber} deleted.`)
      setChecked((prev) => prev.filter((id) => id !== order.id))
      refetch()
    } catch (err) {
      setNotice(err.message)
    }
  }

  const bulkDelete = async () => {
    setActionOpen(false)
    if (checked.length === 0) return
    if (!window.confirm(`Delete ${checked.length} selected order(s)? This cannot be undone.`)) return
    setNotice(null)
    try {
      await Promise.all(checked.map((id) => api.admin.orders.remove(id)))
      setNotice(`${checked.length} order(s) deleted.`)
      setChecked([])
      refetch()
    } catch (err) {
      setNotice(err.message)
    }
  }

  if (loading && !data) return <Loading full />
  if (error) return <ErrorMessage error={error} onRetry={refetch} />

  const money = (value) => `₹ ${Number(value).toFixed(2)}`

  const statusClass = (value) => {
    if (value === 'shipped') return 'bg-amber-50 text-amber-600'
    if (value === 'delivered') return 'bg-emerald-50 text-emerald-700'
    if (value === 'cancelled') return 'bg-rose-50 text-rose-600'
    return 'bg-gray-100 text-gray-600'
  }

  const timeOf = (value) =>
    new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  return (
    <AdminPage title="Orders">
      {notice && (
        <Alert tone="info" className="mb-5">
          {notice}
        </Alert>
      )}

      {/* Filter bar */}
      <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap gap-4">
            <div>
              <label htmlFor="order-status" className="mb-2 block text-[14px] text-gray-500">
                Filter by Status
              </label>
              <select
                id="order-status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value)
                  setPage(1)
                }}
                className={`${CONTROL} h-12 w-[200px] capitalize`}
              >
                <option value="">---All---</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="order-date" className="mb-2 block text-[14px] text-gray-500">
                Filter by Date
              </label>
              <input
                id="order-date"
                type="date"
                value={date}
                placeholder="DD-MM-YYYY"
                onChange={(e) => {
                  setDate(e.target.value)
                  setPage(1)
                }}
                className={`${CONTROL} h-12 w-[230px]`}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-[15px] font-medium text-gray-600">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-gray-300"
              />
              Select All
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setActionOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={actionOpen}
                className="flex h-12 items-center gap-2 rounded-md bg-pink-600 px-6 text-[15px] font-semibold text-white hover:bg-pink-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
              >
                Action
                <ChevronDown size={14} strokeWidth={2.5} aria-hidden="true" />
              </button>
              {actionOpen && (
                <ul
                  role="menu"
                  className="absolute right-0 z-10 mt-2 w-44 overflow-hidden rounded-md border border-gray-200 bg-white py-1 text-[14px] shadow-lg"
                >
                  <li role="none">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={bulkDelete}
                      disabled={checked.length === 0}
                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Delete selected
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Orders table */}
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[15px]">
            <caption className="sr-only">Orders</caption>
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th scope="col" className="w-12 px-4 py-4">
                  <span className="sr-only">Select</span>
                </th>
                <SortTh label="Order ID" sortKey="orderNumber" sort={sort} onSort={toggleSort} />
                <SortTh label="User Name" sortKey="userName" sort={sort} onSort={toggleSort} />
                <SortTh label="User Phone" sortKey="userPhone" sort={sort} onSort={toggleSort} />
                <SortTh label="Ordered On" sortKey="orderedAt" sort={sort} onSort={toggleSort} />
                <SortTh label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
                <th scope="col" className="px-4 py-4 font-semibold">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((order) => (
                <tr key={order.id} className="align-middle">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={checked.includes(order.id)}
                      onChange={() => toggleOne(order.id)}
                      aria-label={`Select order ${order.orderNumber}`}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <button
                      type="button"
                      onClick={() => openOrder(order)}
                      className="font-semibold text-blue-600 hover:underline"
                    >
                      {order.orderNumber}
                    </button>
                  </td>
                  <td className="px-4 py-4 text-gray-700">{order.userName}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-gray-700">
                    {order.userPhone ?? order.shippingPhone ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-gray-700">
                    {formatDate(order.orderedAt)}
                    <span className="mt-0.5 block text-[13px] text-gray-400">
                      {timeOf(order.orderedAt)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wide ${statusClass(order.status)}`}
                    >
                      {order.statusLabel ?? order.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <div className="flex items-center gap-2">
                      <IconButton
                        label={`Edit order ${order.orderNumber}`}
                        className="bg-[#ff6f4e] hover:bg-[#f45c3a]"
                        onClick={() => openOrder(order)}
                      >
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton
                        label={`View order ${order.orderNumber}`}
                        className="bg-[#4fc3f7] hover:bg-[#33b5f1]"
                        onClick={() => openOrder(order)}
                      >
                        <Eye size={14} />
                      </IconButton>
                      <IconButton
                        label={`Delete order ${order.orderNumber}`}
                        className="bg-[#ff6f4e] hover:bg-[#f45c3a]"
                        onClick={() => deleteOrder(order)}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination pagination={data?.pagination} onPage={setPage} />
      </div>

      {/* Manage order modal (unchanged behaviour) */}
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

function SortTh({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="px-4 py-4 font-semibold"
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1.5 hover:text-gray-900"
      >
        {label}
        <ArrowUpDown
          size={12}
          aria-hidden="true"
          className={active ? 'text-gray-700' : 'text-gray-400'}
        />
      </button>
    </th>
  )
}

function IconButton({ label, className, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${className}`}
    >
      {children}
    </button>
  )
}
