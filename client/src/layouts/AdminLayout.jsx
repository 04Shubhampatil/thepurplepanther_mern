import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/index.js'
import * as api from '../services/endpoints.js'

const NAV = [
  ['/admin/dashboard', 'Dashboard'],
  ['/admin/orders', 'Orders'],
  ['/admin/products', 'Products'],
  ['/admin/categories', 'Categories'],
  ['/admin/sub-categories', 'Sub-categories'],
  ['/admin/brands', 'Brands'],
  ['/admin/colors', 'Colours'],
  ['/admin/sizes', 'Sizes'],
  ['/admin/offers', 'Offers'],
  ['/admin/coupons', 'Coupons'],
  ['/admin/banners', 'Banners'],
  ['/admin/news-types', 'News types'],
  ['/admin/blog-posts', 'Blog posts'],
  ['/admin/users', 'Users'],
  ['/admin/contacts', 'Contacts'],
  ['/admin/settings', 'Settings'],
]

/**
 * Admin shell.
 *
 * This nav controls what is VISIBLE, not what is permitted — every admin endpoint is
 * enforced server-side by requireAuth + requireAdmin (brief §31).
 */
export default function AdminLayout() {
  const { user, setUser } = useAuthStore()
  const navigate = useNavigate()

  const signOut = async () => {
    await api.adminAuth.logout()
    setUser(null)
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="pp-admin" style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{ width: 220, background: '#3a1651', color: '#fff', padding: '20px 0', flexShrink: 0 }}
      >
        <div style={{ padding: '0 20px 20px' }}>
          <strong>Purple Panther</strong>
          <p style={{ fontSize: 12, opacity: 0.7, margin: '4px 0 0' }}>Admin</p>
        </div>

        <nav aria-label="Admin">
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {NAV.map(([to, label]) => (
              <li key={to}>
                <NavLink
                  to={to}
                  style={({ isActive }) => ({
                    display: 'block',
                    padding: '9px 20px',
                    color: '#fff',
                    background: isActive ? 'rgba(255,255,255,.12)' : 'transparent',
                    textDecoration: 'none',
                    fontSize: 14,
                  })}
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 24px',
            borderBottom: '1px solid #eee',
          }}
        >
          <span style={{ opacity: 0.75 }}>Signed in as {user?.name ?? user?.email}</span>
          <button type="button" onClick={signOut} className="btn btn-link">
            Sign out
          </button>
        </header>

        <main style={{ padding: 24 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
