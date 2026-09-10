import * as authService from '../../services/auth.service.js'
import { setAuthCookie, clearAuthCookie, rememberFlag } from '../../utils/auth-token.js'
import { ok, asyncHandler } from '../../utils/api-response.js'
import { send } from '../../integrations/email/mailer.js'
import { adminPasswordResetMail } from '../../integrations/email/templates/admin-password-reset.js'
import logger from '../../config/logger.js'

/**
 * Admin authentication. Same users table and the same cookie as the storefront — the
 * source application has one guard and separates roles by the `users.role` column.
 *
 * Password reset is scoped to role='admin' and lives here rather than reusing the customer
 * endpoints, which filter role='customer' and would answer an administrator's address with
 * "This email is not registered with us." See createAdminPasswordResetToken for why the
 * scoping is stricter than the source's unscoped broker, and for the reason the source's
 * own version of this flow cannot run.
 */

export const login = asyncHandler(async (req, res) => {
  const user = await authService.loginAdmin(req.body)
  setAuthCookie(res, user, { remember: rememberFlag(req.body.remember) })

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

/**
 * Admin\AuthController::sendResetLink. The response is the broker's RESET_LINK_SENT
 * string; an unknown address and a too-soon retry are surfaced by the service as 422 and
 * 429 with the broker's own INVALID_USER / RESET_THROTTLED wording.
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { user, token, expiresMinutes } = await authService.createAdminPasswordResetToken({
    email: req.body.email,
  })

  const sent = await send(adminPasswordResetMail({ user, token, expiresMinutes }))
  if (!sent) logger.warn({ userId: String(user.id) }, 'Admin password reset email could not be sent')

  return ok(res, {}, 'We have emailed your password reset link.')
})

/** Admin\AuthController::resetPassword — redirects to the admin login, not into a session. */
export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetAdminPassword(req.body)

  return ok(res, { redirect: '/admin/login' }, 'Your password has been reset.')
})

export default { login, logout, me, forgotPassword, resetPassword }
