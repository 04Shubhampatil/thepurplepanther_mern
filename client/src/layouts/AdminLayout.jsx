import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  FolderTree,
  Layers,
  Tag,
  Palette,
  Ruler,
  Percent,
  Ticket,
  ImageIcon,
  Newspaper,
  FileText,
  Users,
  Mail,
  Settings as SettingsIcon,
  Menu,
  LogOut,
} from 'lucide-react'
import { useAuthStore } from '../store/index.js'
import * as api from '../services/endpoints.js'
import Drawer from '../components/ui/Drawer.jsx'

const NAV = [
  ['/admin/dashboard', 'Dashboard', LayoutDashboard],
  ['/admin/orders', 'Orders', ShoppingCart],
  ['/admin/products', 'Products', Package],
  ['/admin/categories', 'Categories', FolderTree],
  ['/admin/sub-categories', 'Sub-categories', Layers],
  ['/admin/brands', 'Brands', Tag],
  ['/admin/colors', 'Colours', Palette],
  ['/admin/sizes', 'Sizes', Ruler],
  ['/admin/offers', 'Offers', Percent],
  ['/admin/coupons', 'Coupons', Ticket],
  ['/admin/banners', 'Banners', ImageIcon],
  ['/admin/news-types', 'News types', Newspaper],
  ['/admin/blog-posts', 'Blog posts', FileText],
  ['/admin/users', 'Users', Users],
  ['/admin/contacts', 'Contacts', Mail],
  ['/admin/settings', 'Settings', SettingsIcon],
]

/**
 * Admin shell.
 *
 * This nav controls what is VISIBLE, not what is permitted — every admin endpoint is
 * enforced server-side by requireAuth + requireAdmin (brief §31).
 *
 * The sidebar is fixed on desktop and becomes a drawer below `lg`, so the panel is usable
 * from a phone (the Blade version was desktop-only).
 */
export default function AdminLayout() {
  const { user, setUser } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const signOut = async () => {
    await api.adminAuth.logout()
    setUser(null)
    navigate('/admin/login', { replace: true })
  }

  const linkClass = ({ isActive }) =>
    [
      'flex items-center gap-3 px-5 py-2.5 text-[14px] transition-colors',
      isActive ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white',
    ].join(' ')

  const navList = (onNavigate) => (
    <ul>
      {NAV.map(([to, label, Icon]) => (
        <li key={to}>
          <NavLink to={to} className={linkClass} onClick={onNavigate}>
            <Icon size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  )

  const currentLabel = NAV.find(([to]) => location.pathname.startsWith(to))?.[1] ?? 'Admin'

  return (
    <div className="flex min-h-screen bg-white">
      {/* Desktop sidebar. */}
      <aside className="hidden w-[230px] shrink-0 bg-brand py-6 lg:block">
        <div className="px-5 pb-6">
          <p className="font-alt text-[14px] font-bold uppercase tracking-[0.18em] text-white">
            Purple Panther
          </p>
          <p className="mt-1 text-[12px] text-white/60">Admin</p>
        </div>

        <nav aria-label="Admin">{navList()}</nav>
      </aside>

      {/* Mobile drawer, sharing the same nav list. */}
      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        side="left"
        title="Admin menu"
        widthClass="w-[260px]"
      >
        <nav aria-label="Admin" className="min-h-full bg-brand py-3">
          {navList(() => setMenuOpen(false))}
        </nav>
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open admin menu"
              className="grid size-9 place-items-center border border-line text-ink transition-colors hover:border-brand hover:text-brand lg:hidden"
            >
              <Menu size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <span className="pp-eyebrow text-ink lg:hidden">{currentLabel}</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden text-[13px] text-body sm:inline">
              Signed in as {user?.name ?? user?.email}
            </span>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 text-[13px] text-ink transition-colors hover:text-brand"
            >
              <LogOut size={15} strokeWidth={1.5} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
