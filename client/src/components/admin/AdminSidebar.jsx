import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Menu as MenuIcon,
  Image as ImageIcon,
  PenLine,
  Ticket,
  Users,
  ShoppingCart,
  Mail,
  Settings,
  Power,
  ChevronDown,
  X,
} from 'lucide-react'

/**
 * The admin sidebar — a transcription of the nav in layouts/app.blade.php.
 *
 * The MENU HIERARCHY is the part that must not drift, so it is data here rather than
 * markup: four collapsible groups (Products Master, Home Content, Journal, Settings) around
 * five flat links, in this order. A group opens when the current route is inside it, which
 * is what Blade did with `request()->routeIs(...)` on the wrapper.
 *
 * BRANDS IS DELIBERATELY ABSENT. The Blade file still contains the link but gates it behind
 * `@php($showBrands = false)` with a comment saying it is hidden, not removed. The API and
 * the route exist; only the nav entry is withheld, and flipping `SHOW_BRANDS` here restores
 * it exactly as flipping that variable does there.
 *
 * Icons are lucide-react, as the brief requires. The originals were unicode glyphs (▣ ☰ ✎
 * 🎟 🛒 ✉ ⚙ ⏻) rendered at the nav's font size; each is mapped to its nearest lucide
 * equivalent at 17px, which is the size that matches the old glyph's optical weight.
 */
const SHOW_BRANDS = false

const NAV = [
  { type: 'link', to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    type: 'group',
    label: 'Products Master',
    icon: MenuIcon,
    children: [
      { to: '/admin/categories', label: 'Categories' },
      { to: '/admin/sub-categories', label: 'Sub-Categories' },
      { to: '/admin/brands', label: 'Brands', hidden: !SHOW_BRANDS },
      { to: '/admin/colors', label: 'Colors' },
      { to: '/admin/sizes', label: 'Sizes' },
      { to: '/admin/offers', label: 'Offers' },
      { to: '/admin/products', label: 'Products' },
    ],
  },
  {
    type: 'group',
    label: 'Home Content',
    icon: ImageIcon,
    children: [
      { to: '/admin/banners', label: 'Sections & Images' },
      { to: '/admin/home-sections', label: 'Shop the Look Products' },
    ],
  },
  {
    type: 'group',
    label: 'Journal',
    icon: PenLine,
    children: [
      { to: '/admin/news-types', label: 'News Types' },
      { to: '/admin/blog-posts', label: 'Journal Posts' },
    ],
  },
  { type: 'link', to: '/admin/coupons', label: 'Coupons', icon: Ticket },
  { type: 'link', to: '/admin/users', label: 'Users', icon: Users },
  { type: 'link', to: '/admin/orders', label: 'Order List', icon: ShoppingCart },
  { type: 'link', to: '/admin/contacts', label: 'Contact List', icon: Mail },
  {
    type: 'group',
    label: 'Settings',
    icon: Settings,
    children: [
      { to: '/admin/settings/pages', label: 'Web Settings' },
      { to: '/admin/settings/shipping', label: 'Shipping Settings' },
    ],
  },
]

/** `.nav-link, .nav-toggle` — 12px 18px, #d7d9de, 14px, 10px gap. */
const NAV_ITEM =
  'flex w-full items-center gap-2.5 px-[18px] py-3 text-[14px] text-admin-nav transition-colors hover:bg-admin-sidebar-2 hover:text-white'

/** `.nav-sub a` — 9px 18px 9px 46px, #b8bbc4, 13px. */
const SUB_ITEM =
  'block py-[9px] pl-[46px] pr-[18px] text-[13px] text-admin-nav-sub transition-colors hover:text-white'

function NavGroup({ item, onNavigate }) {
  const { pathname } = useLocation()
  const children = item.children.filter((child) => !child.hidden)
  const containsActive = children.some((child) => pathname.startsWith(child.to))
  const [open, setOpen] = useState(containsActive)

  return (
    <div className={containsActive ? 'bg-black/10' : undefined}>
      <button type="button" className={`${NAV_ITEM} justify-between`} onClick={() => setOpen((v) => !v)}>
        <span className="flex items-center gap-2.5">
          <item.icon size={17} strokeWidth={1.9} />
          {item.label}
        </span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="bg-admin-sidebar-sub py-1.5">
          {children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `${SUB_ITEM} ${isActive ? 'bg-admin-primary !text-white' : ''}`
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function AdminSidebar({ open, onClose, onLogout }) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-[250px] shrink-0 bg-admin-sidebar text-white transition-transform duration-[250ms] lg:static lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* .sidebar-brand — 14px 16px, 12px gap, 1px rgba(255,255,255,.08) rule */}
      <div className="relative flex items-center gap-3 border-b border-white/10 px-4 py-3.5">
        <img
          src="/images/brand/logo-dark.png"
          alt="Purple Panther"
          className="block h-auto w-full max-w-[150px] object-contain brightness-0 invert"
        />
        <button
          type="button"
          className="absolute right-3 text-white/70 hover:text-white lg:hidden"
          aria-label="Close menu"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      {/* .sidebar-nav — 12px 0, scrolls below the 75px brand block */}
      <nav className="max-h-[calc(100vh-75px)] overflow-y-auto py-3">
        {NAV.map((item) =>
          item.type === 'group' ? (
            <NavGroup key={item.label} item={item} onNavigate={onClose} />
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => `${NAV_ITEM} ${isActive ? 'bg-admin-primary !text-white' : ''}`}
            >
              <item.icon size={17} strokeWidth={1.9} />
              {item.label}
            </NavLink>
          ),
        )}

        <button type="button" className={NAV_ITEM} onClick={onLogout}>
          <Power size={17} strokeWidth={1.9} />
          Logout
        </button>
      </nav>
    </aside>
  )
}
