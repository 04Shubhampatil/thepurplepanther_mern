import { readAuthToken, verifyAuthToken } from '../utils/auth-token.js'
import { findActiveUserById } from '../services/auth.service.js'
import { ROLES } from '../constants/roles.js'
import { UnauthorizedError, ForbiddenError } from '../utils/api-error.js'
import { asyncHandler } from '../utils/api-response.js'

/**
 * Auth middleware — the Node equivalents of Laravel's `auth`, `admin` and `customer`.
 *
 * The user is reloaded from the database on every request rather than trusted from the
 * JWT claims. Slightly more work per request, but deactivating an account or changing a
 * role takes effect immediately instead of at token expiry — which matters because the
 * admin panel can disable users.
 *
 * DIFFERENCE FROM LARAVEL, intentional and reviewed:
 *   AdminMiddleware called auth()->logout() before redirecting, so a signed-in CUSTOMER
 *   who touched an admin URL was silently logged out of the storefront — losing their
 *   cart session as a side effect. Here a non-admin gets a 403 and keeps their session.
 *   Recorded in docs/controller-mapping.md §4.
 */

/** Populates req.user when a valid token is present. Never rejects. */
export const attachUser = asyncHandler(async (req, res, next) => {
  req.user = null
  const payload = verifyAuthToken(readAuthToken(req))
  if (payload?.sub) req.user = await findActiveUserById(payload.sub)
  next()
})

/** Laravel `auth` — 401 JSON instead of a redirect to the login page. */
export const requireAuth = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    const payload = verifyAuthToken(readAuthToken(req))
    if (payload?.sub) req.user = await findActiveUserById(payload.sub)
  }
  if (!req.user) throw new UnauthorizedError('Please sign in to continue.')
  next()
})

/** Laravel `customer` — EnsureCustomer. Assumes requireAuth ran first. */
export const requireCustomer = (req, res, next) => {
  if (!req.user) return next(new UnauthorizedError('Please sign in to continue.'))
  if (req.user.role !== ROLES.CUSTOMER) {
    return next(new ForbiddenError('This area is for customer accounts.'))
  }
  next()
}

/** Laravel `admin` — AdminMiddleware. Assumes requireAuth ran first. */
export const requireAdmin = (req, res, next) => {
  if (!req.user) return next(new UnauthorizedError('Please sign in to continue.'))
  if (req.user.role !== ROLES.ADMIN) {
    return next(new ForbiddenError('This action is unauthorized.'))
  }
  next()
}

/** Laravel `guest` — RedirectIfAuthenticated, for login/register endpoints. */
export const requireGuest = (req, res, next) => {
  if (req.user) return next(new ForbiddenError('You are already signed in.'))
  next()
}

export default { attachUser, requireAuth, requireCustomer, requireAdmin, requireGuest }
