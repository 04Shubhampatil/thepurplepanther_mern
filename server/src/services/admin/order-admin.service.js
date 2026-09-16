import prisma from '../../config/database.js'
import { NotFoundError, ValidationError, BusinessError } from '../../utils/api-error.js'
import { toNumber, toDecimal } from '../../utils/money.js'
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  normaliseStatus,
  statusLabel,
  statusBadgeClass,
  nextOptions,
  canTransition,
  defaultMessage,
} from '../../constants/order-statuses.js'
import { sendAsync } from '../../integrations/email/mailer.js'
import {
  orderStatusUpdatedMail,
  orderDeliveryDateUpdatedMail,
} from '../../integrations/email/templates/order-emails.js'

/**
 * Admin order management — port of Admin\OrderController.
 *
 * Status changes go through the OrderStatuses state machine. An admin endpoint that
 * accepted an arbitrary status string could walk a delivered order back to placed, or
 * un-cancel one, which the machine exists to prevent.
 */

const ORDER_INCLUDE = {
  items: true,
  statusLogs: { orderBy: [{ loggedAt: 'asc' }, { id: 'asc' }] },
  user: { select: { id: true, name: true, email: true, phone: true } },
}

/** The sortable columns of the admin order table, mapped to their Prisma names. */
const ORDER_SORTS = {
  order_number: 'orderNumber',
  user_name: 'userName',
  user_phone: 'userPhone',
  ordered_at: 'orderedAt',
  status: 'status',
}

/**
 * The Date filter sends "DD-MM-YYYY", matching the field's own placeholder.
 *
 * It is a WHOLE DAY, so the comparison is a half-open range on the local day rather than an
 * equality test — `ordered_at` is a timestamp and no order lands exactly on midnight.
 * Read as a wall clock for the same reason the journal's dates are: the column carries no
 * zone, so shifting by the server's offset would file an evening order under the next day.
 */
function dayRange(value) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(value ?? '').trim())
  if (!match) return null

  const [, day, month, year] = match
  const start = new Date(`${year}-${month}-${day}T00:00:00Z`)
  if (Number.isNaN(start.getTime())) return null

  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { gte: start, lt: end }
}

/**
 * The Payment filter's two choices map onto the EXISTING `payment_status` column, whose
 * only values are the two in PAYMENT_STATUSES: "Successful Orders" is `paid`, "Pending
 * Orders" is `pending`. No new column, and nothing derived from `status` — an order's
 * delivery state and whether its money landed are separate facts, which is why the list
 * can show a SHIPPED pill on a row whose payment is still pending.
 *
 * Anything else is ignored rather than passed through to Prisma, so a hand-typed
 * `?payment=` cannot filter on a value the column never holds.
 */
function paymentFilter(value) {
  const wanted = String(value ?? '').trim().toLowerCase()
  return Object.values(PAYMENT_STATUSES).includes(wanted) ? wanted : null
}

export async function listOrders({
  search = '',
  status = null,
  payment = null,
  date = null,
  page = 1,
  perPage = 10,
  sort = 'ordered_at',
  dir = 'desc',
} = {}) {
  const term = String(search ?? '').trim()
  const orderedAt = dayRange(date)
  const paymentStatus = paymentFilter(payment)

  const where = {
    ...(status ? { status } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(orderedAt ? { orderedAt } : {}),
    ...(term
      ? {
          OR: [
            { orderNumber: { contains: term } },
            { userName: { contains: term } },
            { userEmail: { contains: term } },
            { userPhone: { contains: term } },
            { shippingName: { contains: term } },
          ],
        }
      : {}),
  }

  const take = Math.min(Math.max(1, perPage), 100)
  const currentPage = Math.max(1, page)
  const column = ORDER_SORTS[sort] ?? 'orderedAt'
  const direction = String(dir).toLowerCase() === 'asc' ? 'asc' : 'desc'

  /*
   * The footer's Total Amount sums payable_amount over the PAID orders of the WHOLE
   * filtered set, not the page on screen — a total that changed when you paged would be
   * reporting the page, not the filter. Aggregated in SQL for the same reason the counts
   * are: the rows it sums are not the rows fetched, and there may be far more of them.
   *
   * It is the same figure the dashboard's Transactions card shows (dashboardStats below
   * aggregates identically), so with no filters applied the two agree by construction.
   */
  const [total, rows, successful] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: { items: { select: { id: true, quantity: true } } },
      orderBy: [{ [column]: direction }, { id: 'desc' }],
      skip: (currentPage - 1) * take,
      take,
    }),
    prisma.order.aggregate({
      /*
       * AND, not a spread: spreading would let this `paymentStatus` overwrite the one the
       * Payment filter put in `where`, and the footer would report the paid total of the
       * WHOLE table while the list showed Pending Orders. Anded, the two conditions are
       * both applied, so filtering to Pending correctly totals 0.
       */
      where: { AND: [where, { paymentStatus: PAYMENT_STATUSES.PAID }] },
      _sum: { payableAmount: true },
    }),
  ])

  return {
    items: rows.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      userName: order.userName,
      userEmail: order.userEmail,
      userPhone: order.userPhone,
      status: order.status,
      statusLabel: statusLabel(order.status),
      statusBadgeClass: statusBadgeClass(order.status),
      paymentStatus: order.paymentStatus,
      paymentMode: order.paymentMode,
      payableAmount: toNumber(order.payableAmount),
      itemsCount: order.items.reduce((s, i) => s + Number(i.quantity), 0),
      orderedAt: order.orderedAt,
      expectedDeliveryDate: order.expectedDeliveryDate,
    })),
    successfulTotal: toNumber(successful._sum.payableAmount ?? 0),
    pagination: {
      page: currentPage,
      perPage: take,
      total,
      lastPage: Math.max(1, Math.ceil(total / take)),
    },
  }
}

export async function findOrder(id) {
  const order = await prisma.order.findUnique({ where: { id: BigInt(id) }, include: ORDER_INCLUDE })
  if (!order) throw new NotFoundError('Order not found.')

  /*
   * `status_label` and `status_badge_class` are ACCESSORS, and the detail screen prints both.
   * Attached here rather than recomputed on the client so the summary card and the list read
   * the same value — neither normalises `pending`, so a fresh order says "Pending" on both.
   */
  return {
    ...order,
    statusLabel: statusLabel(order.status),
    statusBadgeClass: statusBadgeClass(order.status),
  }
}

/** Admin\OrderController::statusPayload — drives the status dropdown. */
export async function statusPayload(id) {
  const order = await findOrder(id)
  const current = normaliseStatus(order.status)

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: current,
    statusLabel: statusLabel(current),
    options: Object.entries(nextOptions(current)).map(([value, label]) => ({ value, label })),
    expectedDeliveryDate: order.expectedDeliveryDate,
    logs: order.statusLogs.map((log) => ({
      id: log.id,
      status: log.status,
      title: log.title,
      description: log.description,
      loggedAt: log.loggedAt,
    })),
  }
}

/**
 * Change an order's status.
 *
 * Rejects any transition the machine disallows, so `delivered` and `cancelled` stay
 * terminal and a status can never be walked backwards.
 */
export async function updateStatus(id, { status, title = null, description = null }) {
  const order = await findOrder(id)
  const target = normaliseStatus(status)

  if (!canTransition(order.status, target)) {
    const message = `Cannot change status from ${statusLabel(order.status)} to ${statusLabel(target)}.`
    throw new ValidationError({ status: [message] }, message)
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.order.update({
      where: { id: order.id },
      data: { status: target },
      include: ORDER_INCLUDE,
    })

    // Order items follow the order's status, as they did in Laravel.
    await tx.orderItem.updateMany({ where: { orderId: order.id }, data: { status: target } })

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        status: target,
        title: title || statusLabel(target),
        description: description || defaultMessage(target),
        loggedAt: new Date(),
      },
    })

    return next
  })

  // Fire-and-forget: a mail failure must never fail a status change an admin has made.
  sendAsync(orderStatusUpdatedMail(updated, target, description))

  return updated
}

export async function updateDeliveryDate(id, expectedDeliveryDate) {
  const order = await findOrder(id)

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null },
    include: ORDER_INCLUDE,
  })

  if (updated.expectedDeliveryDate) sendAsync(orderDeliveryDateUpdatedMail(updated))

  return updated
}

export async function deleteStatusLog(orderId, logId) {
  const log = await prisma.orderStatusLog.findUnique({ where: { id: BigInt(logId) } })
  if (!log || String(log.orderId) !== String(orderId)) throw new NotFoundError('Status log not found.')

  await prisma.orderStatusLog.delete({ where: { id: log.id } })
}

/**
 * Delete an order.
 *
 * A PAID order is refused: deleting it destroys the financial record and orphans the
 * Razorpay payment. Laravel allowed it; this is a deliberate guard, recorded as a
 * behaviour change.
 */
export async function deleteOrder(id) {
  const order = await findOrder(id)

  if (order.paymentStatus === PAYMENT_STATUSES.PAID) {
    throw new BusinessError(
      'A paid order cannot be deleted. Cancel it instead so the record is preserved.',
    )
  }

  await prisma.order.delete({ where: { id: order.id } })
}

export async function bulkOrderAction(action, ids) {
  const keys = ids.map((id) => BigInt(id))

  if (action === 'delete') {
    let deleted = 0
    const skipped = []

    for (const key of keys) {
      const order = await prisma.order.findUnique({ where: { id: key }, select: { id: true, orderNumber: true, paymentStatus: true } })
      if (!order) continue
      if (order.paymentStatus === PAYMENT_STATUSES.PAID) {
        skipped.push(order.orderNumber)
        continue
      }
      await prisma.order.delete({ where: { id: key } })
      deleted += 1
    }

    return skipped.length
      ? `${deleted} order(s) deleted. ${skipped.length} paid order(s) were kept: ${skipped.join(', ')}.`
      : `${deleted} order(s) deleted.`
  }

  if (Object.prototype.hasOwnProperty.call(ORDER_STATUSES, String(action).toUpperCase())) {
    const target = normaliseStatus(action)
    let updated = 0

    for (const key of keys) {
      const order = await prisma.order.findUnique({ where: { id: key }, select: { id: true, status: true } })
      // Skip rather than fail the batch, so one terminal order does not block the rest.
      if (!order || !canTransition(order.status, target)) continue
      await updateStatus(key, { status: target })
      updated += 1
    }

    return `${updated} order(s) updated to ${statusLabel(target)}.`
  }

  throw new ValidationError({ action: ['Unknown action.'] }, 'Unknown action.')
}

/** Dashboard aggregates. Counts only — never load whole tables to count them. */
export async function dashboardStats() {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const paid = { paymentStatus: PAYMENT_STATUSES.PAID }

  const [
    productCount,
    activeProductCount,
    orderCount,
    paidOrderCount,
    customerCount,
    subscriberCount,
    contactCount,
    revenue,
    monthRevenue,
    byStatus,
    categoryCount,
    subCategoryCount,
    brandCount,
    colorCount,
    sizeCount,
    offerCount,
    recentOrders,
  ] = await prisma.$transaction([
    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.order.count(),
    prisma.order.count({ where: paid }),
    prisma.user.count({ where: { role: 'customer' } }),
    prisma.subscriber.count(),
    prisma.contactMessage.count(),
    prisma.order.aggregate({ where: paid, _sum: { payableAmount: true } }),
    prisma.order.aggregate({
      where: { ...paid, orderedAt: { gte: startOfMonth } },
      _sum: { payableAmount: true },
    }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.category.count(),
    prisma.subCategory.count(),
    prisma.brand.count(),
    prisma.color.count(),
    prisma.size.count(),
    prisma.offer.count(),
    prisma.order.findMany({
      orderBy: [{ orderedAt: 'desc' }, { id: 'desc' }],
      take: 10,
      select: {
        id: true,
        orderNumber: true,
        userName: true,
        status: true,
        paymentStatus: true,
        payableAmount: true,
        orderedAt: true,
      },
    }),
  ])

  return {
    /**
     * `stats` mirrors DashboardController's array one key at a time, because the admin
     * dashboard's six cards and seven tiles read straight from it. `transactions` is the
     * SUM of payable_amount over PAID orders only — not order count, and not every order —
     * which is the figure the pink card has always shown.
     */
    stats: {
      categories: categoryCount,
      sub_categories: subCategoryCount,
      products: productCount,
      users: customerCount,
      orders: orderCount,
      transactions: toNumber(revenue._sum.payableAmount),
      brands: brandCount,
      colors: colorCount,
      sizes: sizeCount,
      offers: offerCount,
    },

    products: { total: productCount, active: activeProductCount },
    orders: {
      total: orderCount,
      paid: paidOrderCount,
      byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])),
    },
    customers: customerCount,
    subscribers: subscriberCount,
    contactMessages: contactCount,
    revenue: {
      total: toNumber(revenue._sum.payableAmount),
      thisMonth: toNumber(monthRevenue._sum.payableAmount),
    },
    recentOrders: recentOrders.map((o) => ({
      ...o,
      payableAmount: toNumber(o.payableAmount),
      statusLabel: statusLabel(o.status),
    })),
  }
}

export default {
  listOrders,
  findOrder,
  statusPayload,
  updateStatus,
  updateDeliveryDate,
  deleteStatusLog,
  deleteOrder,
  bulkOrderAction,
  dashboardStats,
}
