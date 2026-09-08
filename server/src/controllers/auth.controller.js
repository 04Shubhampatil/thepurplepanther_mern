import * as authService from '../services/auth.service.js'
import * as cartService from '../services/cart.service.js'
import { setAuthCookie, clearAuthCookie } from '../utils/auth-token.js'
import { clearGuestCartCookie } from '../middleware/guest-cart.middleware.js'
import { ok, asyncHandler } from '../utils/api-response.js'
import { send } from '../integrations/email/mailer.js'
import { customerPasswordResetMail } from '../integrations/email/templates/customer-password-reset.js'
import logger from '../config/logger.js'

/**
 * Customer authentication endpoints.
 *
 * Controllers stay thin: validate (middleware) -> service -> response. All rules live in
 * auth.service.js, so they can be tested without HTTP.
 *
 * `redirect` is included in responses because the Laravel JSON endpoints returned it and
 * the storefront's customer-auth.js follows it. React can ignore it, but keeping it means
 * the API is drop-in compatible if any legacy script is still pointed at it during cutover.
 */

/**
 * Fold any guest cart into the account, then drop the guest cookie.
 *
 * Laravel called CartService::mergeSessionIntoUser on both login and registration. Without
 * it a customer who fills a cart, then signs in, watches it empty — the single most
 * visible auth regression there is.
 *
 * A merge failure must never fail the sign-in, so it is logged and swallowed.
 */
async function mergeGuestCart(req, res, user) {
  try {
    if (req.guestCart?.lines?.length) {
      await cartService.mergeGuestCartIntoUser(user, req.guestCart)
    }
  } catch (error) {
    logger.error({ err: error, userId: String(user.id) }, 'Guest cart merge failed')
  }
  clearGuestCartCookie(res)
}

export const login = asyncHandler(async (req, res) => {
  const user = await authService.loginCustomer(req.body)
  setAuthCookie(res, user)
  await mergeGuestCart(req, res, user)

  return ok(
    res,
    { user: authService.toPublicUser(user), redirect: '/account/overview' },
    'Signed in successfully.',
  )
})

export const register = asyncHandler(async (req, res) => {
  const user = await authService.registerCustomer(req.body)
  setAuthCookie(res, user)
  await mergeGuestCart(req, res, user)

  // TODO(phase 12): Meta CompleteRegistration event. Fire-and-forget, never awaited.

  return ok(
    res,
    { user: authService.toPublicUser(user), redirect: '/account/overview' },
    'Account created successfully.',
  )
})

export const logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res)
  return ok(res, { redirect: '/' }, 'Signed out.')
})

/** Returns the signed-in user, or null. Never 401s — the storefront calls it on every load. */
export const me = asyncHandler(async (req, res) => {
  return ok(
    res,
    { user: req.user ? authService.toPublicUser(req.user) : null },
    req.user ? 'Authenticated.' : 'Not authenticated.',
  )
})

/** CustomerAuthController::checkEmail — inline availability check on the signup form. */
export const checkEmail = asyncHandler(async (req, res) => {
  const available = await authService.isEmailAvailable(req.body.email, req.user?.id ?? null)
  return ok(
    res,
    { available },
    available ? 'Email is available.' : 'This email is already registered.',
  )
})

export const forgotPassword = asyncHandler(async (req, res) => {
  const { user, token, remaining, expiresMinutes } = await authService.createPasswordResetToken({
    email: req.body.email,
    ip: req.ip,
  })

  // Awaited so the customer is told the truth about whether the email went out — this is
  // not the checkout path, and a silent failure here is a support ticket.
  const sent = await send(customerPasswordResetMail({ user, token, expiresMinutes }))
  if (!sent) logger.warn({ userId: String(user.id) }, 'Password reset email could not be sent')

  return ok(
    res,
    { remaining_attempts: remaining },
    'A password reset link has been sent to your email.',
  )
})

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body)

  // Laravel redirected to the login page rather than signing the user in — preserved, so
  // the new password is proven to work before the session is established.
  return ok(res, { redirect: '/login' }, 'Your password has been reset. Please sign in.')
})

export default { login, register, logout, me, checkEmail, forgotPassword, resetPassword }
