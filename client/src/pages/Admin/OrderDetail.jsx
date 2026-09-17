import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Printer, Wrench } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import { Card } from '../../components/admin/AdminUI.jsx'
import { DataTable, DataTh, DataTd, ActionSquare } from '../../components/admin/AdminTable.jsx'
import OrderStatusModal from '../../components/admin/OrderStatusModal.jsx'
import { storageUrl } from '../../utils/admin-media.js'
import { formatDateDMY, formatDateTime } from '../../utils/admin-date.js'
import { usePageTitle } from '../../theme/page.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/orders/show.blade.php.
 *
 * Two cards: a two-column summary, then the items table with its totals block.
 *
 * BILLING SHOWS EIGHT ROWS, not the three in the Blade file on disk. Migration
 * 2026_08_11_000001_add_checkout_fields_to_orders_table added shipping_email, _city,
 * _state, _pincode and _country, and the live admin displays them — but the copy of
 * show.blade.php in this checkout was never updated to match, so it still renders only
 * Name / Phone / Address. The live page is the reference here. Labels are the checkout
 * form's own ("Town / City", "Country / Region"), so the admin reads back what the
 * customer filled in under the same names.
 *
 * The API already returned every one of these fields; only the view was behind.
 *
 * `.status-text` is NOT the `.status-badge` pill the list uses — it shares the badge-*
 * class names but renders as bold coloured TEXT with no background. Same classes, different
 * component, so the colours below are the `.status-text` set and `placed` is #ef6c00 here
 * where the pill was grey.
 *
 * Both Update Status controls open the same modal the list opens, and the per-item one
 * updates the ORDER — order_items.status follows the order, it is not set per line.
 */
const STATUS_TEXT = {
  'badge-placed': 'text-[#ef6c00]',
  'badge-successful': 'text-[#00796b]',
  'badge-packed': 'text-[#1565c0]',
  'badge-shipped': 'text-[#ef6c00]',
  'badge-delivered': 'text-[#2e7d32]',
  'badge-cancelled': 'text-[#c62828]',
}

/** `'₹ '.number_format($v, 2)` */
const money = (value) =>
  `₹ ${Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** `.detail-table` — a 140px caption column, 8px rows, no side padding. */
function DetailRow({ label, children }) {
  return (
    <tr>
      <th className="w-[140px] border-b border-[#f0f0f0] py-2 text-left align-top text-[14px] font-semibold text-[#777]">
        {label}
      </th>
      <td className="border-b border-[#f0f0f0] py-2 text-left align-top text-[14px]">{children}</td>
    </tr>
  )
}

/** `.order-totals-row` */
function TotalRow({ label, children, payable }) {
  return (
    <div
      className={`flex justify-between py-1.5 ${
        payable
          ? 'mt-1.5 border-t border-[#eee] pt-2.5 text-[15px] text-[#222]'
          : 'text-[14px] text-[#555]'
      }`}
    >
      <span>{label}</span>
      <strong className="font-bold">{children}</strong>
    </div>
  )
}

export default function OrderDetail() {
  const { id } = useParams()
  usePageTitle('Order Summary - Purple Panther')

  const [manageId, setManageId] = useState(null)

  const { data, loading, refetch } = useApi(() => api.admin.orders.show(id), [id])
  const order = data?.order

  const statusClass = (badge) => STATUS_TEXT[badge] ?? STATUS_TEXT['badge-placed']

  return (
    <>
      {/* `.page-head` — Back is the PRIMARY button here, Print the blue `.btn-print` */}
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[22px] font-bold text-[#333]">Order Summary</h2>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/admin/orders"
            className="inline-flex items-center justify-center rounded-md bg-admin-primary px-4 py-[10px] text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-dark"
          >
            « Back
          </Link>
          <a
            href={`/admin/orders/${id}/print`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#1e88e5] px-4 py-[10px] text-[13px] font-semibold text-white transition-colors hover:bg-[#1565c0]"
          >
            <Printer size={14} />
            Print
          </a>
        </div>
      </div>

      {loading || !order ? (
        <div className="rounded-[10px] bg-white p-6 text-center text-admin-muted">
          {loading ? 'Loading…' : 'Order not found.'}
        </div>
      ) : (
        <>
          <Card>
            {/* `.order-summary-grid` — two equal columns at 24px */}
            <div className="grid grid-cols-1 gap-6 min-[768px]:grid-cols-2">
              <div>
                <h3 className="mb-2 text-[18px] font-bold text-[#333]">Order Details</h3>
                <table className="w-full border-collapse">
                  <tbody>
                    <DetailRow label="Order ID">{order.orderNumber}</DetailRow>
                    <DetailRow label="Ordered On">{formatDateTime(order.orderedAt)}</DetailRow>
                    <DetailRow label="Payment Mode">{order.paymentMode || '—'}</DetailRow>
                    <DetailRow label="Payment ID">{order.paymentId || '—'}</DetailRow>
                    <DetailRow label="Order Status">
                      <span className={`font-bold ${statusClass(order.statusBadgeClass)}`}>
                        {order.statusLabel}
                      </span>
                    </DetailRow>
                    <DetailRow label="Expected Delivery">
                      {formatDateDMY(order.expectedDeliveryDate) || '—'}
                    </DetailRow>
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="mb-2 text-[18px] font-bold text-[#333]">Billing &amp; Shipping Details</h3>
                <table className="w-full border-collapse">
                  <tbody>
                    <DetailRow label="Name">{order.shippingName || order.userName || '—'}</DetailRow>
                    <DetailRow label="Phone number">
                      {order.shippingPhone || order.userPhone || '—'}
                    </DetailRow>
                    <DetailRow label="Email">{order.shippingEmail || order.userEmail || '—'}</DetailRow>
                    <DetailRow label="Address">{order.shippingAddress || '—'}</DetailRow>
                    <DetailRow label="Town / City">{order.shippingCity || '—'}</DetailRow>
                    <DetailRow label="State">{order.shippingState || '—'}</DetailRow>
                    <DetailRow label="Zip / PIN Code">{order.shippingPincode || '—'}</DetailRow>
                    <DetailRow label="Country / Region">{order.shippingCountry || '—'}</DetailRow>
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          <Card className="mt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[18px] font-bold text-[#333]">Products</h3>
              <button
                type="button"
                onClick={() => setManageId(order.id)}
                className="inline-flex items-center justify-center rounded-md bg-admin-primary px-4 py-[10px] text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-dark"
              >
                Update Status
              </button>
            </div>

            <DataTable caption="Order items">
              <thead>
                <tr>
                  <DataTh>Product</DataTh>
                  <DataTh>Price</DataTh>
                  <DataTh>Saving</DataTh>
                  <DataTh>Qty</DataTh>
                  <DataTh>Total Price</DataTh>
                  <DataTh>Status</DataTh>
                  <DataTh>Update</DataTh>
                </tr>
              </thead>
              <tbody>
                {(order.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-[#888]">No products in this order.</td>
                  </tr>
                ) : (
                  order.items.map((item) => (
                    <tr key={item.id}>
                      <DataTd>
                        {/* `.order-product-cell` — a 48px thumb beside the title */}
                        <div className="flex items-center gap-2.5">
                          {item.productImage ? (
                            <img
                              src={storageUrl(item.productImage)}
                              alt=""
                              className="size-12 shrink-0 rounded-md bg-[#eee] object-cover"
                            />
                          ) : null}
                          <div>
                            <span>{item.productTitle}</span>
                            {item.color || item.size ? (
                              <div className="mt-1 text-[12px] text-[#888]">
                                {item.color ? `Colour: ${item.color}` : ''}
                                {item.color && item.size ? ' · ' : ''}
                                {item.size ? `Size: ${item.size}` : ''}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </DataTd>
                      <DataTd className="whitespace-nowrap">{money(item.price)}</DataTd>
                      <DataTd className="whitespace-nowrap">{money(item.saving)}</DataTd>
                      <DataTd>{item.quantity}</DataTd>
                      <DataTd className="whitespace-nowrap">{money(item.totalPrice)}</DataTd>
                      <DataTd>
                        <span className={`font-bold ${statusClass(badgeFor(item.status))}`}>
                          {labelFor(item.status)}
                        </span>
                      </DataTd>
                      <DataTd>
                        {/* Updates the ORDER — order_items.status follows it, per-line
                            statuses are not editable. */}
                        <ActionSquare
                          tone="delete"
                          title="Update Status"
                          onClick={() => setManageId(order.id)}
                        >
                          <Wrench size={15} />
                        </ActionSquare>
                      </DataTd>
                    </tr>
                  ))
                )}
              </tbody>
            </DataTable>

            {/* `.order-totals` — right-aligned and capped at 280px */}
            <div className="ml-auto mt-4 max-w-[280px]">
              <TotalRow label="Total">{money(order.subtotal)}</TotalRow>
              <TotalRow label={`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`}>
                - {money(order.discountAmount)}
              </TotalRow>
              <TotalRow label="Delivery Charge">
                {Number(order.deliveryCharge) > 0 ? money(order.deliveryCharge) : 'Free'}
              </TotalRow>
              <TotalRow label="Payable Amount" payable>{money(order.payableAmount)}</TotalRow>
            </div>
          </Card>
        </>
      )}

      <OrderStatusModal orderId={manageId} onClose={() => setManageId(null)} onSaved={refetch} />
    </>
  )
}

/*
 * `OrderStatuses::badgeClass` / `::label` applied to the ITEM's status.
 *
 * Duplicated here rather than imported because these are the server's constants; the client
 * only ever needs them for this one table, and the order's own label and class already
 * arrive on the payload.
 */
const ITEM_BADGES = {
  cancelled: 'badge-cancelled',
  delivered: 'badge-delivered',
  shipped: 'badge-shipped',
  packed: 'badge-packed',
  successful: 'badge-successful',
}

const ITEM_LABELS = {
  placed: 'Placed',
  successful: 'Successful',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const badgeFor = (status) => ITEM_BADGES[String(status ?? '').toLowerCase()] ?? 'badge-placed'

/** `label()` does not normalise, so a pending item reads "Pending". */
const labelFor = (status) => {
  const value = String(status ?? '').toLowerCase()
  return ITEM_LABELS[value] ?? (value ? value.charAt(0).toUpperCase() + value.slice(1) : '')
}
