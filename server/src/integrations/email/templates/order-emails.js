import env from '../../../config/env.js'
import { layout, button, paragraph, escapeHtml, COLORS } from './layout.js'
import { format, toNumber } from '../../../utils/money.js'
import { statusLabel } from '../../../constants/order-statuses.js'

/**
 * Order emails — ports of the four order Mailables and their Blade templates.
 * Subjects are reproduced verbatim; customers filter and search on them.
 *
 *   OrderPlacedCustomerMail        'Order confirmed — {number}'
 *   OrderPlacedAdminMail           'New order — {number}'   → now paymentSuccessAdminMail,
 *                                  'Payment Successful - Order {number}' (see below)
 *   OrderStatusUpdatedMail         'Order {number} — {status}'
 *   OrderDeliveryDateUpdatedMail   'Expected delivery update — {number}'
 */

const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : ''

/** Customer-facing recipient, in the order CheckoutService resolved it. */
export const customerRecipient = (order) =>
  order.shippingEmail || order.userEmail || order.user?.email || null

function itemRows(order) {
  return (order.items ?? [])
    .map((item) => {
      const variant = [item.color, item.size].filter(Boolean).join(' / ')
      const detail = [variant, item.packageLabel].filter(Boolean).join(' · ')

      return `<tr>
      <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};font-size:14px;color:${COLORS.body};">
        ${escapeHtml(item.productTitle)}
        ${detail ? `<div style="font-size:12px;color:${COLORS.muted};margin-top:2px;">${escapeHtml(detail)}</div>` : ''}
      </td>
      <td align="center" style="padding:10px 0;border-bottom:1px solid ${COLORS.border};font-size:14px;color:${COLORS.muted};">
        ${Number(item.quantity)}
      </td>
      <td align="right" style="padding:10px 0;border-bottom:1px solid ${COLORS.border};font-size:14px;color:${COLORS.body};">
        ${format(item.totalPrice)}
      </td>
    </tr>`
    })
    .join('\n')
}

function totalsRows(order) {
  const rows = [['Subtotal', format(order.subtotal)]]

  if (toNumber(order.discountAmount) > 0) {
    const label = `Discount${order.couponCode ? ` (${order.couponCode})` : ''}`
    rows.push([label, `− ${format(order.discountAmount)}`])
  }
  rows.push(['Delivery', toNumber(order.deliveryCharge) > 0 ? format(order.deliveryCharge) : 'Free'])

  return (
    rows
      .map(
        ([label, value]) => `<tr>
      <td style="padding:4px 0;font-size:14px;color:${COLORS.muted};">${escapeHtml(label)}</td>
      <td align="right" style="padding:4px 0;font-size:14px;color:${COLORS.body};">${value}</td>
    </tr>`,
      )
      .join('\n') +
    `<tr>
      <td style="padding:10px 0 0;border-top:1px solid ${COLORS.border};font-size:15px;font-weight:bold;color:${COLORS.brand};">Total</td>
      <td align="right" style="padding:10px 0 0;border-top:1px solid ${COLORS.border};font-size:15px;font-weight:bold;color:${COLORS.brand};">${format(order.payableAmount)}</td>
    </tr>`
  )
}

function shippingBlock(order) {
  const lines = [
    order.shippingName,
    order.shippingAddress,
    [order.shippingCity, order.shippingState].filter(Boolean).join(', '),
    [order.shippingPincode, order.shippingCountry].filter(Boolean).join(' '),
    order.shippingPhone,
  ].filter(Boolean)

  return lines.map((l) => escapeHtml(l)).join('<br>')
}

function orderTable(order) {
  return `<tr>
  <td style="padding:0 32px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${itemRows(order)}
      ${totalsRows(order)}
    </table>
  </td>
</tr>
<tr>
  <td style="padding:0 32px 28px;font-size:13px;line-height:1.6;color:${COLORS.muted};">
    <strong style="color:${COLORS.body};">Delivering to</strong><br>
    ${shippingBlock(order)}
  </td>
</tr>`
}

const metaLine = (order) =>
  `Order <strong>${escapeHtml(order.orderNumber)}</strong> &middot; ${fmtDate(order.orderedAt ?? order.createdAt)}
   &middot; ${escapeHtml(String(order.paymentMode || 'razorpay').toUpperCase())}`

/**
 * Customer order confirmation.
 *
 * `guestPassword` is included for guest checkout. This is the ONLY place a guest learns
 * the password generated for the account created during checkout — dropping it would leave
 * them unable to sign in.
 */
export function orderPlacedCustomerMail(order, guestPassword = null) {
  const body = [
    paragraph(
      `Hi ${escapeHtml(order.shippingName || 'there')},<br><br>
       Thank you for your order — we have received it and will be in touch when it ships.<br><br>
       ${metaLine(order)}`,
    ),
    orderTable(order),
    guestPassword
      ? paragraph(
          `We created an account for you so you can track this order.<br>
           Sign in with <strong>${escapeHtml(customerRecipient(order) ?? '')}</strong>
           and the password <strong style="letter-spacing:.06em;">${escapeHtml(guestPassword)}</strong>.<br>
           Please change it after signing in.`,
          { size: 13, color: COLORS.muted, padding: '0 32px 20px' },
        )
      : '',
    button(`${env.FRONTEND_URL.replace(/\/+$/, '')}/account/orders`, 'View your orders'),
  ]
    .filter(Boolean)
    .join('\n')

  return {
    to: customerRecipient(order),
    subject: `Order confirmed — ${order.orderNumber}`,
    html: layout({
      eyebrow: 'Order confirmed',
      heading: 'Thank you for your order',
      preheader: `Order ${order.orderNumber} confirmed`,
      body,
    }),
    text:
      `Hi ${order.shippingName || 'there'},\n\n` +
      `Thank you for your order.\n\n` +
      `Order ${order.orderNumber} — ${format(order.payableAmount)}\n` +
      (guestPassword
        ? `\nWe created an account for you. Sign in with ${customerRecipient(order)} and the password ${guestPassword}. Please change it after signing in.\n`
        : '') +
      `\nView your orders: ${env.FRONTEND_URL}/account/orders\n`,
  }
}

/**
 * Admin notification — the port of OrderPlacedAdminMail, reworded 2026-09-19 at the
 * client's request to read as a PAYMENT notice. It is sent from exactly one place,
 * checkout.service verifyAndComplete, after the Razorpay signature has verified and the
 * transaction writing payment_status = paid has committed — so "Payment Status: Paid"
 * below is a statement of what the database now holds, never of what the browser said.
 *
 * The line-item table the old email carried is kept beneath the requested sections: it is
 * what the admin packs from, and dropping it would trade one notification for two.
 */
export function paymentSuccessAdminMail(order) {
  const customerName = order.userName || order.shippingName || order.user?.name || ''
  const customerEmail = order.userEmail || customerRecipient(order) || ''
  const customerPhone = order.userPhone || order.shippingPhone || order.user?.phone || ''

  // Payment date carries the time as well, in the shop's zone: the day alone is not much
  // use for matching against the Razorpay dashboard.
  const paidAt = order.orderedAt
    ? new Date(order.orderedAt).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: env.TZ,
      })
    : ''

  const row = (label, value) => `<tr>
      <td style="padding:5px 0;font-size:14px;color:${COLORS.muted};width:44%;">${escapeHtml(label)}</td>
      <td style="padding:5px 0;font-size:14px;color:${COLORS.body};">${escapeHtml(value ?? '')}</td>
    </tr>`

  const section = (title, rows) => `<tr>
  <td style="padding:0 32px 18px;">
    <div style="font-size:12px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;color:${COLORS.brand};padding-bottom:6px;border-bottom:1px solid ${COLORS.border};margin-bottom:6px;">${escapeHtml(title)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
  </td>
</tr>`

  const body = [
    paragraph(
      `<strong>Payment for this order has been successfully completed by the customer.</strong>`,
    ),
    section(
      'Order Details',
      row('Order Number', order.orderNumber) +
        row('Customer Name', customerName) +
        row('Customer Email', customerEmail) +
        row('Customer Phone', customerPhone),
    ),
    section(
      'Payment Details',
      row('Payment Status', 'Paid') +
        row('Payment ID', order.paymentId || '—') +
        row('Razorpay Order ID', order.razorpayOrderId || '—') +
        row('Payment Amount', format(order.payableAmount)) +
        row('Payment Date', paidAt),
    ),
    orderTable(order),
  ].join('\n')

  return {
    to: env.mailAdminAddress,
    subject: `Payment Successful - Order ${order.orderNumber}`,
    html: layout({
      eyebrow: 'The Purple Panther',
      heading: 'Payment Successful',
      preheader: `Payment received for order ${order.orderNumber} — ${format(order.payableAmount)}`,
      body,
    }),
    text:
      `The Purple Panther — Payment Successful\n\n` +
      `Payment for this order has been successfully completed by the customer.\n\n` +
      `Order Number: ${order.orderNumber}\n` +
      `Customer Name: ${customerName}\n` +
      `Customer Email: ${customerEmail}\n` +
      `Customer Phone: ${customerPhone}\n\n` +
      `Payment Status: Paid\n` +
      `Payment ID: ${order.paymentId || '-'}\n` +
      `Razorpay Order ID: ${order.razorpayOrderId || '-'}\n` +
      `Payment Amount: ${format(order.payableAmount)}\n` +
      `Payment Date: ${paidAt}\n`,
  }
}

/** Status change notification. */
export function orderStatusUpdatedMail(order, status, note = null) {
  const label = statusLabel(status)

  const body = [
    paragraph(
      `Hi ${escapeHtml(order.shippingName || 'there')},<br><br>
       Your order <strong>${escapeHtml(order.orderNumber)}</strong> is now
       <strong>${escapeHtml(label)}</strong>.
       ${note ? `<br><br>${escapeHtml(note)}` : ''}`,
    ),
    button(`${env.FRONTEND_URL.replace(/\/+$/, '')}/account/orders`, 'Track your order'),
  ].join('\n')

  return {
    to: customerRecipient(order),
    subject: `Order ${order.orderNumber} — ${label}`,
    html: layout({
      eyebrow: 'Order update',
      heading: `Your order is ${label.toLowerCase()}`,
      preheader: `Order ${order.orderNumber} is ${label}`,
      body,
    }),
    text: `Your order ${order.orderNumber} is now ${label}.${note ? `\n\n${note}` : ''}\n`,
  }
}

/** Expected-delivery-date change notification. */
export function orderDeliveryDateUpdatedMail(order) {
  const body = [
    paragraph(
      `Hi ${escapeHtml(order.shippingName || 'there')},<br><br>
       The expected delivery date for order <strong>${escapeHtml(order.orderNumber)}</strong>
       is now <strong>${escapeHtml(fmtDate(order.expectedDeliveryDate))}</strong>.`,
    ),
    button(`${env.FRONTEND_URL.replace(/\/+$/, '')}/account/orders`, 'Track your order'),
  ].join('\n')

  return {
    to: customerRecipient(order),
    subject: `Expected delivery update — ${order.orderNumber}`,
    html: layout({
      eyebrow: 'Delivery update',
      heading: 'Expected delivery updated',
      preheader: `New expected delivery date for ${order.orderNumber}`,
      body,
    }),
    text: `The expected delivery date for order ${order.orderNumber} is now ${fmtDate(order.expectedDeliveryDate)}.\n`,
  }
}

export default {
  orderPlacedCustomerMail,
  paymentSuccessAdminMail,
  orderStatusUpdatedMail,
  orderDeliveryDateUpdatedMail,
  customerRecipient,
}
