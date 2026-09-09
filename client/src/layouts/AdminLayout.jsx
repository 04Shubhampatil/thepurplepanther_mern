import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/admin/AdminSidebar.jsx'
import AdminHeader from '../components/admin/AdminHeader.jsx'
import { useAuthStore } from '../store/index.js'
import { useAdminStylesheets } from '../theme/adminChrome.js'
import '../admin.css'

/**
 * Admin shell — `layouts/app.blade.php`.
 *
 * Structure and geometry are that file's: a 250px sidebar beside a flexing main column, a
 * sticky 58px topbar, and 22px of content padding on an #f4f5f7 ground.
 *
 * RESPONSIVE BEHAVIOUR IS COPIED, NOT INVENTED. The Blade layout ran a small script that
 * treated `max-width: 991px` as mobile: below it the sidebar is a drawer over an overlay
 * and starts closed; above it the drawer classes are stripped and the sidebar is simply
 * part of the layout. Tailwind's `lg:` is 1024px rather than 992px — close enough that the
 * behaviour matches at every real breakpoint, and the alternative is a custom screen for a
 * 32px difference.
 *
 * The storefront's stylesheets are detached while this is mounted (theme/adminChrome.js);
 * the Laravel admin loaded only admin.css and inheriting Bootstrap here would undo the
 * parity this rebuild is measured against.
 */
export default function AdminLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const [sidebarOpen, setSidebarOpen] = useState(false)

  useAdminStylesheets()

  // A drawer left open across a navigation would cover the page it opened.
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  async function onLogout() {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="admin-root flex min-h-screen">
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onLogout={onLogout} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader user={user} onToggleSidebar={() => setSidebarOpen((v) => !v)} onLogout={onLogout} />
        <main className="flex-1 p-[22px]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
