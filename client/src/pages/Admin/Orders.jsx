import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Wrench, Printer, Trash2 } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import { ConfirmDialog, Pagination } from '../../components/admin/AdminUI.jsx'
import {
  DataTable,
  DataTh,
  DataTd,
  SortTh,
  ActionSquare,
  PanelSearch,
  PerPageSelect,
  SelectAll,
  BulkActions,
  PaginationInfo,
} from '../../components/admin/AdminTable.jsx'
import OrderStatusModal from '../../components/admin/OrderStatusModal.jsx'
import { formatDateDMY, formatTime12 } from '../../utils/admin-date.js'
import { usePageTitle } from '../../theme/page.js'
import { toast } from '../../store/toast.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/orders/index.blade.php.
 *
 * The `.product-panel` head carries search and per-page; the row below splits into the two
 * `.order-filters` selects on the left and Select All plus the bulk Action menu on the
 * right. Then `.admin-table.orders-table`.
 *
 * Filtering and sorting are BOTH server-side. The table is paginated, so ordering the ten
 * rows on screen would order the wrong ten, and the Date filter has to run against the
 * whole set to find the orders on that day at all.
 *
 * `status_label` and `status_badge_class` are accessors over OrderStatuses. Neither
 * normalises `pending`, so a freshly created order reads PENDING in the placed pill —
 * the label says payment has not landed while the colour says nothing has gone wrong.
 */
const BULK_ITEMS = [{ value: 'delete', label: 'Delete', confirm: 'Action: Delete' }]

/** `.status-badge` variants, straight from OrderStatuses::badgeClass. */
const BADGE_CLASSES = {
  'badge-placed': 'bg-[#eceff1] text-[#546e7a]',
  'badge-successful': 'bg-[#e0f2f1] text-[#00796b]',
  'badge-packed': 'bg-[#e3f2fd] text-[#1565c0]',
  'badge-shipped': 'bg-[#fff3e0] text-[#ef6c00]',
  'badge-delivered': 'bg-[#e8f5e9] text-[#2e7d32]',
  'badge-cancelled': 'bg-[#ffebee] text-[#c62828]',
}

/**
 * Filter by Payment reads the EXISTING `payment_status` column, whose only two values are
 * these. It is independent of Filter by Status: payment landing and the order shipping are
 * separate facts, so the two selects narrow the list together rather than overriding.
 */
const PAYMENT_OPTIONS = [
  { value: 'paid', label: 'Successful Orders' },
  { value: 'pending', label: 'Pending Orders' },
]

/** `₹ ` + number_format($value, 2) — the same format as the dashboard's Transactions card. */
const money = (value) =>
  `₹ ${Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function Orders() {
  usePageTitle('Order List - Purple Panther')

  /*
   * The payment filter is mirrored in the URL so the dashboard's Transactions card can
   * link straight to the successful orders (/admin/orders?payment=paid) and land with the
   * select already showing it. Only this one filter is in the URL — the others stay local
   * state, exactly as before.
   */
  const [params, setParams] = useSearchParams()
  const payment = PAYMENT_OPTIONS.some((o) => o.value === params.get('payment'))
    ? params.get('payment')
    : ''

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [date, setDate] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [sort, setSort] = useState({ key: 'ordered_at', dir: 'desc' })
  const [checked, setChecked] = useState([])
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [manageId, setManageId] = useState(null)

  const { data, loading, refetch } = useApi(
    () =>
      api.admin.orders.list({
        search,
        status: status || undefined,
        payment: payment || undefined,
        date: date || undefined,
        page,
        per_page: perPage,
        sort: sort.key,
        dir: sort.dir,
      }),
    [search, status, payment, date, page, perPage, sort],
  )
  const { data: statusList } = useApi(() => api.admin.orders.statuses(), [])

  const items = data?.items ?? []
  const pagination = data?.pagination ?? { page: 1, lastPage: 1, total: 0, perPage }
  // Server-side sum over the PAID orders of the whole filtered set, not just this page.
  const successfulTotal = data?.successfulTotal ?? 0
  const statuses = statusList?.statuses ?? []

  const ids = useMemo(() => items.map((order) => String(order.id)), [items])
  const allChecked = ids.length > 0 && ids.every((id) => checked.includes(id))

  const toggleAll = () => setChecked(allChecked ? [] : ids)
  const toggleOne = (id) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))

  function onSort(key, dir) {
    setSort({ key, dir })
    setPage(1)
  }

  function onBulk(item) {
    if (checked.length === 0) {
      toast.error('Please select at least one order.')
      return
    }
    setConfirm({ kind: 'bulk', action: item.value, title: item.confirm })
  }

  async function runBulk(action) {
    setBusy(true)
    try {
      const res = await api.admin.orders.bulk(action, checked.map(Number))
      toast.success(res.$message)
      setChecked([])
      refetch()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  async function runDelete(id) {
    setBusy(true)
    try {
      toast.success((await api.admin.orders.remove(id)).$message)
      setChecked((prev) => prev.filter((v) => v !== String(id)))
      refetch()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  return (
    <>
      {/* `.product-panel` */}
      <div className="mb-[18px] rounded-[10px] bg-white px-5 py-[18px] shadow-[0_1px_4px_rgba(0,0,0,0.04)] max-sm:p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 max-sm:flex-col max-sm:items-stretch">
          <h2 className="text-[22px] font-semibold text-[#444]">Order List</h2>

          <div className="flex flex-wrap items-center gap-3 max-sm:w-full">
            <PanelSearch value={search} onChange={(v) => { setSearch(v); setPage(1) }} />
            <PerPageSelect value={perPage} onChange={(n) => { setPerPage(n); setPage(1) }} />
          </div>
        </div>

        {/* `.product-panel-bottom` — filters left, bulk actions right */}
        <div className="flex flex-wrap items-end justify-between gap-4 pt-1">
          {/* `.order-filters` — 38px controls at 4px radius, label 12px/600 #777 above */}
          <div className="flex flex-wrap gap-3.5">
            <div className="flex flex-col gap-1">
              <label htmlFor="order-status" className="text-[12px] font-semibold text-[#777]">
                Filter by Status
              </label>
              <select
                id="order-status"
                value={status}
                onChange={(event) => { setStatus(event.target.value); setPage(1) }}
                className="h-[38px] min-w-[160px] rounded border border-[#ddd] bg-white px-3 text-[13px] text-[#555] outline-none"
              >
                <option value="">---All---</option>
                {statuses.map((entry) => (
                  <option key={entry.value} value={entry.value}>{entry.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="order-payment" className="text-[12px] font-semibold text-[#777]">
                Filter by Payment
              </label>
              <select
                id="order-payment"
                value={payment}
                onChange={(event) => {
                  const next = new URLSearchParams(params)
                  if (event.target.value) next.set('payment', event.target.value)
                  else next.delete('payment')
                  setParams(next, { replace: true })
                  setPage(1)
                }}
                className="h-[38px] min-w-[160px] rounded border border-[#ddd] bg-white px-3 text-[13px] text-[#555] outline-none"
              >
                <option value="">---All---</option>
                {PAYMENT_OPTIONS.map((entry) => (
                  <option key={entry.value} value={entry.value}>{entry.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="order-date" className="text-[12px] font-semibold text-[#777]">
                Filter by Date
              </label>
              {/*
                A TEXT field, as in the Blade — Laravel bound a date picker to it and the
                value it submits is DD-MM-YYYY. A native `date` input would submit
                YYYY-MM-DD and show the browser's own format instead of the placeholder.
              */}
              <input
                id="order-date"
                type="text"
                value={date}
                onChange={(event) => { setDate(event.target.value); setPage(1) }}
                placeholder="DD-MM-YYYY"
                autoComplete="off"
                className="h-[38px] min-w-[160px] rounded border border-[#ddd] bg-white px-3 text-[13px] text-[#555] outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3.5">
            <SelectAll checked={allChecked} indeterminate={checked.length > 0} onChange={toggleAll} />
            <BulkActions items={BULK_ITEMS} onSelect={onBulk} />
          </div>
        </div>
      </div>

      <div className="rounded-[10px] bg-white p-[18px] shadow-admin-card">
        <DataTable caption="Orders">
          <thead>
            <tr>
              <DataTh className="w-10">
                <span className="sr-only">Select</span>
              </DataTh>
              <SortTh column="order_number" label="Order ID" sort={sort.key} dir={sort.dir} onSort={onSort} />
              <SortTh column="user_name" label="User Name" sort={sort.key} dir={sort.dir} onSort={onSort} />
              <SortTh column="user_phone" label="User Phone" sort={sort.key} dir={sort.dir} onSort={onSort} />
              <SortTh column="ordered_at" label="Ordered On" sort={sort.key} dir={sort.dir} onSort={onSort} />
              {/* Not sortable: ORDER_SORTS on the server has no payable_amount column, and
                  a header that sorted nothing would be worse than a plain one. */}
              <DataTh>Amount</DataTh>
              <SortTh column="status" label="Status" sort={sort.key} dir={sort.dir} onSort={onSort} />
              <DataTh>Action</DataTh>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <DataTd colSpan={8} className="py-6 text-center text-admin-muted">Loading…</DataTd>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-[#888]">No orders found.</td>
              </tr>
            ) : (
              items.map((order) => {
                const id = String(order.id)
                return (
                  <tr key={id}>
                    <DataTd>
                      <input
                        type="checkbox"
                        checked={checked.includes(id)}
                        onChange={() => toggleOne(id)}
                        aria-label={`Select order ${order.orderNumber}`}
                        className="size-[15px] accent-admin-primary"
                      />
                    </DataTd>
                    <DataTd>
                      <Link
                        to={`/admin/orders/${id}`}
                        className="font-semibold text-[#1e88e5] hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </DataTd>
                    <DataTd>{order.userName || '—'}</DataTd>
                    <DataTd className="whitespace-nowrap">{order.userPhone || '—'}</DataTd>
                    {/* `.ordered-on-cell` — the date over a #888 time */}
                    <DataTd className="whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span>{formatDateDMY(order.orderedAt)}</span>
                        <small className="text-[#888]">{formatTime12(order.orderedAt)}</small>
                      </div>
                    </DataTd>
                    {/*
                      This order's own payable_amount — the same figure its detail screen
                      and printed copy show. Every row carries one regardless of payment
                      state, so these do NOT add up to the Total Amount below, which counts
                      the successful ones only.
                    */}
                    <DataTd className="whitespace-nowrap">{money(order.payableAmount)}</DataTd>
                    <DataTd>
                      {/* `.status-badge` — 11px/700 pill, uppercased in the Blade */}
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.02em] ${
                          BADGE_CLASSES[order.statusBadgeClass] ?? BADGE_CLASSES['badge-placed']
                        }`}
                      >
                        {String(order.statusLabel ?? order.status).toUpperCase()}
                      </span>
                    </DataTd>
                    <DataTd>
                      <div className="flex items-center gap-1.5">
                        {/* `.action-status` is #ff7043, the same orange as delete — the
                            original's choice, and the icons are what separate them. */}
                        <ActionSquare tone="delete" title="Update Status" onClick={() => setManageId(order.id)}>
                          <Wrench size={15} />
                        </ActionSquare>
                        <ActionSquare
                          as="a"
                          href={`/admin/orders/${id}/print`}
                          target="_blank"
                          rel="noreferrer"
                          tone="view"
                          title="Print"
                          className="!bg-[#4fc3f7] hover:!bg-[#29b6f6]"
                        >
                          <Printer size={15} />
                        </ActionSquare>
                        <ActionSquare
                          tone="delete"
                          title="Delete"
                          onClick={() => setConfirm({ kind: 'row', id: order.id, title: 'Are you sure?' })}
                        >
                          <Trash2 size={15} />
                        </ActionSquare>
                      </div>
                    </DataTd>
                  </tr>
                )
              })
            )}
          </tbody>

          {/*
            Total Amount — the last row of the table, spanning the leading columns so the
            label sits against the figure on the right. It reports the PAID orders of the
            whole filtered set, so it is unaffected by which page is on screen, and it
            reads 0 when the list is filtered to Pending Orders.
          */}
          <tfoot>
            <tr>
              <td
                colSpan={5}
                className="px-3 py-3 text-right text-[13px] font-bold text-[#444]"
              >
                Total Amount
              </td>
              {/* In the Amount column, so the total sits directly under the row figures. */}
              <td className="whitespace-nowrap px-3 py-3 text-[13px] font-bold text-[#444]">
                {loading ? '—' : money(successfulTotal)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </DataTable>
      </div>

      <div className="mt-[18px] flex w-full flex-wrap items-center justify-between gap-3">
        <PaginationInfo pagination={pagination} />
        <Pagination
          page={pagination.page}
          lastPage={pagination.lastPage}
          total={pagination.total}
          perPage={pagination.perPage}
          onChange={setPage}
        />
      </div>

      <OrderStatusModal
        orderId={manageId}
        onClose={() => setManageId(null)}
        onSaved={refetch}
      />

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title}
        onCancel={() => setConfirm(null)}
        onProceed={() => (confirm.kind === 'bulk' ? runBulk(confirm.action) : runDelete(confirm.id))}
        busy={busy}
      />
    </>
  )
}
