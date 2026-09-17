import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import { useAdminStylesheets } from '../../theme/adminChrome.js'
import { formatDateDMY, formatDateTime } from '../../utils/admin-date.js'
import { usePageTitle } from '../../theme/page.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/orders/print.blade.php.
 *
 * A STANDALONE document in Laravel — its own `<html>`, its own `<style>`, no admin chrome —
 * which is why this route sits outside AdminLayout. `useAdminStylesheets` still runs so the
 * storefront theme cannot bleed into it, and everything below is styled inline against the
 * Blade's own rules rather than the panel's tokens.
 *
 * `onload="window.print()"` opened the dialog automatically. Reproduced, but only ONCE the
 * data has arrived — printing an empty page would be the faithful-to-the-letter version and
 * useless, since Blade had its data before the document existed.
 */
const money = (value) =>
  `₹ ${Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** `OrderStatuses::label` — no normalising, so a pending item reads "Pending". */
const LABELS = {
  placed: 'Placed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const labelFor = (status) => {
  const value = String(status ?? '').toLowerCase()
  return LABELS[value] ?? (value ? value.charAt(0).toUpperCase() + value.slice(1) : '')
}

const CELL = {
  border: '1px solid #ddd',
  padding: '8px',
  textAlign: 'left',
  fontSize: '13px',
}

const HEAD_CELL = { ...CELL, background: '#f7f7f7' }

export default function OrderPrint() {
  const { id } = useParams()
  const { data } = useApi(() => api.admin.orders.print(id), [id])
  const printed = useRef(false)

  useAdminStylesheets()

  const order = data?.order
  usePageTitle(order ? `Print ${order.orderNumber} - Purple Panther` : 'Print - Purple Panther')

  useEffect(() => {
    // Once, and only after the order has loaded — a re-render must not reopen the dialog.
    if (!order || printed.current) return
    printed.current = true

    const timer = setTimeout(() => window.print(), 200)
    return () => clearTimeout(timer)
  }, [order])

  if (!order) {
    return (
      <div style={{ fontFamily: 'Arial, sans-serif', color: '#333', margin: '24px' }}>Loading…</div>
    )
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', color: '#333', margin: '24px' }}>
      {/* `.no-print` — visible on screen, hidden by the print stylesheet */}
      <style>{`@media print { .no-print { display: none; } }`}</style>

      <button type="button" className="no-print" onClick={() => window.print()} style={{ marginBottom: '12px' }}>
        Print
      </button>

      <h1 style={{ fontSize: '22px', margin: '0 0 16px' }}>
        Order Summary — {order.orderNumber}
      </h1>

      {/* `.meta` — two equal columns at 16px */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          marginBottom: '16px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '16px', margin: '18px 0 8px' }}>Order Details</h2>
          <p><strong>Ordered On:</strong> {formatDateTime(order.orderedAt)}</p>
          <p><strong>Payment Mode:</strong> {order.paymentMode || '—'}</p>
          <p><strong>Payment ID:</strong> {order.paymentId || '—'}</p>
          <p><strong>Status:</strong> {order.statusLabel}</p>
          <p>
            <strong>Expected Delivery:</strong>{' '}
            {formatDateDMY(order.expectedDeliveryDate) || '—'}
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: '16px', margin: '18px 0 8px' }}>Billing &amp; Shipping</h2>
          <p><strong>Name:</strong> {order.shippingName || order.userName || '—'}</p>
          <p><strong>Phone:</strong> {order.shippingPhone || order.userPhone || '—'}</p>
          {/*
            The live admin print (thepurplepanther.in/admin/orders/{id}/print) shows the full
            checkout address — the columns added by the 2026_08_11 checkout-fields migration —
            with the same labels and fallbacks as the order detail screen (OrderDetail.jsx).
            The zipped print.blade.php predates that and stops at Address.
          */}
          <p><strong>Email:</strong> {order.shippingEmail || order.userEmail || '—'}</p>
          <p><strong>Address:</strong> {order.shippingAddress || '—'}</p>
          <p><strong>Town / City:</strong> {order.shippingCity || '—'}</p>
          <p><strong>State:</strong> {order.shippingState || '—'}</p>
          <p><strong>Zip / PIN Code:</strong> {order.shippingPincode || '—'}</p>
          <p><strong>Country / Region:</strong> {order.shippingCountry || '—'}</p>
        </div>
      </div>

      <h2 style={{ fontSize: '16px', margin: '18px 0 8px' }}>Products</h2>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
        <thead>
          <tr>
            <th style={HEAD_CELL}>Product</th>
            <th style={HEAD_CELL}>Price</th>
            <th style={HEAD_CELL}>Saving</th>
            <th style={HEAD_CELL}>Qty</th>
            <th style={HEAD_CELL}>Total</th>
            <th style={HEAD_CELL}>Status</th>
          </tr>
        </thead>
        <tbody>
          {(order.items ?? []).map((item) => (
            <tr key={item.id}>
              <td style={CELL}>
                {item.productTitle}
                {item.color || item.size || item.packageLabel ? (
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                    {[
                      item.color ? `Colour: ${item.color}` : null,
                      item.size ? `Size: ${item.size}` : null,
                      item.packageLabel ? `Pack: ${item.packageLabel}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                ) : null}
              </td>
              <td style={CELL}>{money(item.price)}</td>
              <td style={CELL}>{money(item.saving)}</td>
              <td style={CELL}>{item.quantity}</td>
              <td style={CELL}>{money(item.totalPrice)}</td>
              <td style={CELL}>{labelFor(item.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* `.totals` — right-aligned, 4px between rows. No coupon code here, unlike the
          on-screen summary. */}
      <div style={{ marginTop: '12px', textAlign: 'right' }}>
        <div style={{ margin: '4px 0' }}>Total: <strong>{money(order.subtotal)}</strong></div>
        <div style={{ margin: '4px 0' }}>Discount: <strong>- {money(order.discountAmount)}</strong></div>
        <div style={{ margin: '4px 0' }}>
          Delivery:{' '}
          <strong>{Number(order.deliveryCharge) > 0 ? money(order.deliveryCharge) : 'Free'}</strong>
        </div>
        <div style={{ margin: '4px 0' }}>Payable: <strong>{money(order.payableAmount)}</strong></div>
      </div>
    </div>
  )
}
