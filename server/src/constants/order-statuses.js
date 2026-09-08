/**
 * Order status machine — port of App\Support\OrderStatuses.
 *
 * Used by the account area, the order page and the admin order module. Transitions must go
 * through `nextOptions()`; admin endpoints never accept an arbitrary status string.
 */

export const ORDER_STATUSES = Object.freeze({
  PLACED: 'placed',
  PACKED: 'packed',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
})

export const STATUS_LABELS = Object.freeze({
  placed: 'Placed',
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

export function statusLabel(status) {
  const value = normaliseStatus(status)
  return STATUS_LABELS[value] ?? (value ? value.charAt(0).toUpperCase() + value.slice(1) : '')
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
  nextOptions,
  canTransition,
  defaultMessage,
}
