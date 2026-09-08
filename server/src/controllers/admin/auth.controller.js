import * as authService from '../../services/auth.service.js'
import { setAuthCookie, clearAuthCookie } from '../../utils/auth-token.js'
import { ok, asyncHandler } from '../../utils/api-response.js'

/**
 * Admin authentication. Same users table and the same cookie as the storefront — the
 * source application has one guard and separates roles by the `users.role` column.
 *
 * Admin password reset is NOT implemented here. Laravel exposed /admin/forgot-password
 * via the generic Password broker, but the customer reset flow uses the same
 * password_reset_tokens table and its resets are scoped to role='customer'. Wiring an
 * admin reset would need its own scoping decision, and no admin-specific mailable exists
 * in the source. Tracked in docs/migration-status.md; admin passwords are currently
 * managed through the admin user CRUD (phase 13).
 */

export const login = asyncHandler(async (req, res) => {
  const user = await authService.loginAdmin(req.body)
  setAuthCookie(res, user)

  return ok(
    res,
    { user: authService.toPublicUser(user), redirect: '/admin/dashboard' },
    'Signed in successfully.',
  )
})

export const logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res)
  return ok(res, { redirect: '/admin/login' }, 'Signed out.')
})

/** The signed-in admin. Requires requireAuth + requireAdmin. */
export const me = asyncHandler(async (req, res) => {
  return ok(res, { user: authService.toPublicUser(req.user) }, 'Authenticated.')
})

export default { login, logout, me }
