/**
 * Order status machine — port of App\Support\OrderStatuses.
 *
 * Used by the account area, the order page and the admin order module. Transitions must go
 * through `nextOptions()`; admin endpoints never accept an arbitrary status string.
 */

export const ORDER_STATUSES = Object.freeze({
  PLACED: 'placed',
  /*
   * NOT in the Laravel source. Added 2026-09-17 at the client's request: the step between
   * "placed" and "packed" at which payment has been confirmed and the order accepted. It
   * exists because the Razorpay callback does not always land (see checkout.service.js),
   * leaving paid orders stuck at pending — the admin marks those Successful by hand.
   *
   * Reaching it also records the payment as paid (order-admin.service.js updateStatus),
   * since that is what the status means; the two must never disagree.
   */
  SUCCESSFUL: 'successful',
  PACKED: 'packed',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
})

export const STATUS_LABELS = Object.freeze({
  placed: 'Placed',
  successful: 'Successful',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
})

export const STATUS_KEYS = Object.freeze(Object.keys(STATUS_LABELS))

/**
 * `orders.status` also carries `pending` — set at order creation, before Razorpay
 * confirms payment. OrderStatuses::nextOptions folded it into `placed`, so it is
 * normalised the same way here.
 *
 * The DATA keeps `pending`; only display and transition logic collapse it.
 */
export function normaliseStatus(status) {
  const value = String(status ?? '').toLowerCase()
  return value === 'pending' ? ORDER_STATUSES.PLACED : value
}

/**
 * `OrderStatuses::label` — and it does NOT normalise.
 *
 * `label('pending')` misses the map and falls through to `ucfirst`, so a freshly created
 * order reads "Pending" everywhere it is displayed — the admin list, the account area and
 * the order page alike. Normalising here showed those orders as "Placed", which is a
 * different claim: that payment has gone through.
 *
 * Only TRANSITIONS fold pending into placed; that is `normaliseStatus`, used by
 * `nextOptions` and `canTransition`.
 */
export function statusLabel(status) {
  const value = String(status ?? '').toLowerCase()
  return STATUS_LABELS[value] ?? (value ? value.charAt(0).toUpperCase() + value.slice(1) : '')
}

/**
 * `OrderStatuses::badgeClass` — the pill's colours, keyed by the RAW status.
 *
 * `pending` falls through to the placed pill, which is why a pending and a placed order
 * look alike in the list while their labels differ.
 */
const BADGE_CLASSES = Object.freeze({
  cancelled: 'badge-cancelled',
  delivered: 'badge-delivered',
  shipped: 'badge-shipped',
  packed: 'badge-packed',
  successful: 'badge-successful',
})

export function statusBadgeClass(status) {
  return BADGE_CLASSES[String(status ?? '').toLowerCase()] ?? 'badge-placed'
}

/**
 * OrderStatuses::nextOptions — statuses reachable from the current one.
 *
 * Forward-only, with `cancelled` available from any non-terminal state. `delivered` and
 * `cancelled` are TERMINAL: an admin cannot un-deliver or un-cancel an order, which is
 * what stops a delivered order being walked back to `placed`.
 */
export function nextOptions(current) {
  switch (normaliseStatus(current)) {
    case ORDER_STATUSES.PLACED:
      return {
        successful: 'Successful',
        packed: 'Packed',
        shipped: 'Shipped',
        delivered: 'Delivered',
        cancelled: 'Cancelled',
      }
    case ORDER_STATUSES.SUCCESSFUL:
      return {
        packed: 'Packed',
        shipped: 'Shipped',
        delivered: 'Delivered',
        cancelled: 'Cancelled',
      }
    case ORDER_STATUSES.PACKED:
      return { shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' }
    case ORDER_STATUSES.SHIPPED:
      return { delivered: 'Delivered', cancelled: 'Cancelled' }
    case ORDER_STATUSES.DELIVERED:
    case ORDER_STATUSES.CANCELLED:
      return {}
    default:
      return {
        successful: 'Successful',
        packed: 'Packed',
        shipped: 'Shipped',
        delivered: 'Delivered',
        cancelled: 'Cancelled',
      }
  }
}

export const canTransition = (from, to) =>
  Object.prototype.hasOwnProperty.call(nextOptions(from), normaliseStatus(to))

/** OrderStatuses::defaultMessage — the customer-facing status-log line. */
export function defaultMessage(status) {
  switch (normaliseStatus(status)) {
    case ORDER_STATUSES.PLACED:
      return 'Your Order has been placed.'
    case ORDER_STATUSES.SUCCESSFUL:
      return 'Your payment was successful and your order has been confirmed.'
    case ORDER_STATUSES.PACKED:
      return 'Your Order has been packed.'
    case ORDER_STATUSES.SHIPPED:
      return 'Your Order has been shipped.'
    case ORDER_STATUSES.DELIVERED:
      return 'Your Order has been delivered.'
    case ORDER_STATUSES.CANCELLED:
      return 'Your order has been cancelled.'
    default:
      return 'Order status updated.'
  }
}

/** Payment states seen in `orders.payment_status`. */
export const PAYMENT_STATUSES = Object.freeze({ PENDING: 'pending', PAID: 'paid' })

export default {
  ORDER_STATUSES,
  STATUS_LABELS,
  STATUS_KEYS,
  PAYMENT_STATUSES,
  normaliseStatus,
  statusLabel,
  statusBadgeClass,
  nextOptions,
  canTransition,
  defaultMessage,
}
