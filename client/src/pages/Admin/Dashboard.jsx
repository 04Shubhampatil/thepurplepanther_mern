import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import Loading from '../../components/common/Loading.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import { formatDate } from '../../utils/format.js'
import {
  AdminPage,
  AdminSection,
  Table,
  Th,
  Td,
  EmptyRow,
  Pill,
  Stat,
} from '../../components/admin/AdminUI.jsx'

/** Aggregates only — the server counts in the database rather than loading tables. */
export default function Dashboard() {
  const { data, error, loading, refetch } = useApi(() => api.admin.dashboard(), [])

  if (loading) return <Loading full />
  if (error) return <ErrorMessage error={error} onRetry={refetch} />

  const { products, orders, customers, subscribers, contactMessages, revenue, recentOrders } = data

  const money = (value) =>
    `₹ ${Number(value).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  return (
    <AdminPage title="Dashboard">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="Revenue (paid)"
          value={money(revenue.total)}
          hint={`${money(revenue.thisMonth)} this month`}
        />
        <Stat label="Orders" value={orders.total} hint={`${orders.paid} paid`} />
        <Stat label="Products" value={products.total} hint={`${products.active} active`} />
        <Stat label="Customers" value={customers} />
        <Stat label="Subscribers" value={subscribers} />
        <Stat label="Messages" value={contactMessages} />
      </div>

      <AdminSection title="Orders by status" className="mt-10">
        <ul className="flex flex-wrap gap-2">
          {Object.entries(orders.byStatus).map(([status, count]) => (
            <li key={status}>
              <Pill>
                {status}: <strong className="ml-1 font-semibold text-ink">{count}</strong>
              </Pill>
            </li>
          ))}
        </ul>
      </AdminSection>

      <AdminSection
        title="Recent orders"
        className="mt-10"
        actions={
          <Link
            to="/admin/orders"
            className="inline-flex items-center gap-1.5 text-[13px] text-ink transition-colors hover:text-brand"
          >
            View all
            <ArrowRight size={15} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        }
      >
        <Table
          caption="Most recent orders"
          head={
            <>
              <Th>Order</Th>
              <Th>Customer</Th>
              <Th>Date</Th>
              <Th>Status</Th>
              <Th className="text-right">Total</Th>
            </>
          }
        >
          {recentOrders.map((order) => (
            <tr key={order.id}>
              <Td className="font-semibold">{order.orderNumber}</Td>
              <Td>{order.userName}</Td>
              <Td className="whitespace-nowrap">{formatDate(order.orderedAt)}</Td>
              <Td>
                <Pill>{order.statusLabel}</Pill>
              </Td>
              <Td className="whitespace-nowrap text-right">{money(order.payableAmount)}</Td>
            </tr>
          ))}

          {recentOrders.length === 0 && <EmptyRow colSpan={5}>No orders yet.</EmptyRow>}
        </Table>
      </AdminSection>
    </AdminPage>
  )
}
