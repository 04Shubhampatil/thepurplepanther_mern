import { Link } from 'react-router-dom'
import { FolderTree, Package, Users, ShoppingCart, Receipt, ListOrdered } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import { PageHead } from '../../components/admin/AdminUI.jsx'
import { usePageTitle } from '../../theme/page.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/dashboard.blade.php.
 *
 * Six gradient stat cards over a "Products Master Overview" panel of seven tiles. Both
 * grids, their gradients and their type sizes come from admin.css — the cards are
 * `auto-fill minmax(200px, 1fr)`, the tiles `minmax(150px, 1fr)`, and both collapse to two
 * columns on a phone.
 *
 * Every number is from the API. The `stats` object it returns is DashboardController's
 * array key for key, including `transactions` being the SUM of payable_amount over PAID
 * orders — a total in rupees, not a count.
 *
 * Brands is hidden in the tile grid for the same reason it is hidden in the sidebar: the
 * Blade file gates it behind `$showBrands = false` and calls it hidden rather than removed.
 */
const STAT_CARDS = [
  { key: 'categories', label: 'Categories', to: '/admin/categories', tone: 'admin-stat-orange', Icon: FolderTree },
  { key: 'sub_categories', label: 'Sub-Categories', to: '/admin/sub-categories', tone: 'admin-stat-red', Icon: FolderTree },
  { key: 'products', label: 'Products', to: '/admin/products', tone: 'admin-stat-purple', Icon: Package },
  { key: 'users', label: 'Users', to: '/admin/users', tone: 'admin-stat-green', Icon: Users },
  { key: 'orders', label: 'Orders', to: '/admin/orders', tone: 'admin-stat-cyan', Icon: ShoppingCart },
  { key: 'transactions', label: 'Transactions', to: '/admin/orders', tone: 'admin-stat-pink', Icon: Receipt, money: true },
]

const SHOW_BRANDS = false

const PM_TILES = [
  { key: 'categories', label: 'Categories', to: '/admin/categories', tone: 'from-[#ff9800] to-[#f57c00]' },
  { key: 'sub_categories', label: 'Sub-Categories', to: '/admin/sub-categories', tone: 'from-[#ef5350] to-[#e53935]' },
  { key: 'brands', label: 'Brands', to: '/admin/brands', tone: 'from-[#42a5f5] to-[#1e88e5]', hidden: !SHOW_BRANDS },
  { key: 'colors', label: 'Colors', to: '/admin/colors', tone: 'from-[#26a69a] to-[#00897b]' },
  { key: 'sizes', label: 'Sizes', to: '/admin/sizes', tone: 'from-[#7e57c2] to-[#5e35b1]' },
  { key: 'offers', label: 'Offers', to: '/admin/offers', tone: 'from-[#ec407a] to-[#d81b60]' },
  { key: 'products', label: 'Products', to: '/admin/products', tone: 'from-[#ec407a] to-[#d81b60]' },
]

/** `₹ ` + number_format($value, 2) — the exact format on the Transactions card. */
const money = (value) =>
  `₹ ${Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function Dashboard() {
  usePageTitle('Dashboard - Purple Panther')

  const { data, loading } = useApi(() => api.admin.dashboard(), [])
  const stats = data?.stats ?? {}
  const value = (key) => (loading ? '—' : stats[key] ?? 0)

  return (
    <>
      <PageHead title="Dashboard" />

      {/* .stats-grid — auto-fill minmax(200px, 1fr), 16px gap; 2 columns on mobile */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:gap-4">
        {STAT_CARDS.map(({ key, label, to, tone, Icon, money: isMoney }) => (
          <Link
            key={label}
            to={to}
            className={`${tone} flex min-h-[90px] items-center justify-between rounded-[10px] p-3.5 text-white shadow-admin-stat transition-transform duration-200 hover:-translate-y-[3px] hover:shadow-admin-stat-hover sm:min-h-[110px] sm:p-5`}
          >
            <div>
              <h3 className="mb-1 text-[22px] font-bold sm:text-[28px]">
                {isMoney ? (loading ? '—' : money(stats[key])) : value(key)}
              </h3>
              <p className="text-[14px] opacity-95">{label}</p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/20 sm:size-12">
              <Icon size={18} strokeWidth={1.9} />
            </div>
          </Link>
        ))}
      </div>

      {/* .pm-overview — white, radius 14px, 22px padding, 1px #eee border */}
      <section className="mt-6 rounded-[14px] border border-admin-line bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.05)] sm:p-[22px]">
        <div className="mb-[18px] flex flex-wrap items-center justify-between gap-4 border-b border-[#f0f0f0] pb-4">
          <div>
            <h3 className="mb-1 text-[18px] font-semibold text-[#222]">Products Master Overview</h3>
            <p className="text-[13px] text-[#888]">
              Manage categories, colors, sizes, offers &amp; products for your store catalog.
            </p>
          </div>
          <Link
            to="/admin/products"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md bg-admin-primary px-4 py-[10px] text-[13px] font-semibold text-white hover:bg-admin-primary-dark max-sm:w-full"
          >
            Open Products →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
          {PM_TILES.filter((tile) => !tile.hidden).map((tile) => (
            <Link
              key={tile.label}
              to={tile.to}
              className={`flex min-h-[110px] flex-col gap-1 rounded-xl bg-gradient-to-br ${tile.tone} p-4 text-white transition-transform duration-200 hover:-translate-y-[3px] hover:shadow-[0_10px_22px_rgba(0,0,0,0.12)]`}
            >
              <span className="text-[28px] font-bold leading-[1.1]">{value(tile.key)}</span>
              <span className="text-[13px] font-semibold opacity-95">{tile.label}</span>
              <span className="mt-auto text-[12px] opacity-85">View →</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
