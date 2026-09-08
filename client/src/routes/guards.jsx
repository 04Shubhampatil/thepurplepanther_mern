import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/index.js'
import Loading from '../components/common/Loading.jsx'

/**
 * Route guards.
 *
 * These control what is RENDERED, never what is permitted. Every protected endpoint is
 * enforced server-side by requireAuth / requireCustomer / requireAdmin — a guard here is a
 * convenience so a signed-out visitor sees the login page instead of a flash of empty
 * data. Removing one would be a UX bug, not a security hole (brief §31).
 */

/** Laravel's ['auth', 'customer'] group. */
export function RequireCustomer() {
  const { user, loading } = useAuthStore()
  const location = useLocation()

  if (loading) return <Loading full />
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />

  return <Outlet />
}

/** Laravel's ['auth', 'admin'] group. */
export function RequireAdmin() {
  const { user, loading } = useAuthStore()

  if (loading) return <Loading full />
  if (!user) return <Navigate to="/admin/login" replace />
  if (user.role !== 'admin') return <Navigate to="/" replace />

  return <Outlet />
}

/** Laravel's `guest` middleware — keeps a signed-in customer off the login page. */
export function RequireGuest() {
  const { user, loading } = useAuthStore()

  if (loading) return <Loading full />
  if (user) return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/account/overview'} replace />

  return <Outlet />
}
