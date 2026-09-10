import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import env from '../config/env.js'

/**
 * Session tokens and password-reset tokens.
 *
 * Laravel used file-based PHP sessions with a session cookie. The Node port issues a JWT
 * carried in an HTTP-only cookie (migration brief §14): not readable by JavaScript, so an
 * XSS bug cannot exfiltrate it, and it survives the API being on a separate origin.
 */

// ─────────────────────────────────────────────────────────── session JWT

export const AUTH_COOKIE = 'pp_token'
export const GUEST_COOKIE = 'pp_guest'

/**
 * Deliberately minimal claims: id and role only. Everything else is read fresh from the
 * database on each request, so deactivating a user or changing their role takes effect
 * immediately rather than at token expiry.
 */
export function signAuthToken(user, { remember = false } = {}) {
  return jwt.sign(
    { sub: String(user.id), role: user.role },
    env.JWT_SECRET,
    { expiresIn: remember ? env.JWT_EXPIRES_IN : `${env.SESSION_LIFETIME_MINUTES}m`, issuer: 'purple-panther' },
  )
}

/**
 * `Auth::login($user, $remember)` — the checkbox is not decoration.
 *
 * Laravel gave an un-remembered sign-in a SESSION cookie that expired with the browser and
 * after config/session.php's 120 minutes; ticking the box added the long-lived remember
 * cookie instead. Treating every login as remembered hands a shared or public browser a
 * week-long token, which is a weaker position than the app being replaced.
 *
 * Laravel's remembered cookie lasts five years. This uses JWT_EXPIRES_IN (7 days) instead
 * — deliberately shorter, because a JWT cannot be revoked the way a database-backed
 * remember_token can. Access still stops immediately when an account is deactivated, since
 * every request reloads the user.
 */
export function rememberFlag(value) {
  // An HTML checkbox posts "1"/"on"; JSON clients send a real boolean.
  if (typeof value === 'boolean') return value
  const text = String(value ?? '').trim().toLowerCase()
  return text === '1' || text === 'true' || text === 'on' || text === 'yes'
}

/** Returns the payload, or null for any invalid/expired/tampered token. Never throws. */
export function verifyAuthToken(token) {
  if (!token) return null
  try {
    return jwt.verify(token, env.JWT_SECRET, { issuer: 'purple-panther' })
  } catch {
    return null
  }
}

/** Cookie options shared by the auth and guest-cart cookies. */
export function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
    path: '/',
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  }
}

/** Parse "7d" / "24h" / "3600" into milliseconds. */
export function expiresInMs(value = env.JWT_EXPIRES_IN) {
  const match = String(value).match(/^(\d+)\s*([smhd])?$/)
  if (!match) return 7 * 24 * 60 * 60 * 1000
  const amount = Number(match[1])
  const unit = match[2] ?? 's'
  const multiplier = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]
  return amount * multiplier
}

/**
 * The cookie's own lifetime tracks the token's, so a stale cookie is not left behind to be
 * sent and rejected. Without `remember` it is a SESSION cookie — no maxAge at all, so the
 * browser drops it on close, which is what `expire_on_close: false` plus a 120-minute
 * lifetime amounted to in practice.
 */
export function setAuthCookie(res, user, { remember = false } = {}) {
  const token = signAuthToken(user, { remember })
  res.cookie(AUTH_COOKIE, token, cookieOptions(remember ? expiresInMs() : undefined))
  return token
}

export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions(), maxAge: undefined })
}

/**
 * Read the token from the cookie, falling back to an Authorization: Bearer header.
 * The header path exists for server-to-server calls and tests, not for the browser.
 */
export function readAuthToken(req) {
  const fromCookie = req.cookies?.[AUTH_COOKIE]
  if (fromCookie) return fromCookie
  const header = req.headers?.authorization
  if (header?.startsWith('Bearer ')) return header.slice(7)
  return null
}

// ────────────────────────────────────────────── password reset tokens

/**
 * Laravel-compatible reset tokens.
 *
 * Laravel's DatabaseTokenRepository stores a BCRYPT HASH of the token in
 * password_reset_tokens.token and emails the plaintext. Reproducing that exactly means a
 * link issued by either application is redeemable by the other — which is what keeps the
 * parallel run and the rollback safe.
 *
 * Never store the plaintext: the table would otherwise become a set of live account-
 * takeover credentials.
 */

/** Matches Laravel's Str::random(60). */
export function generateResetToken(length = 60) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length]
  return out
}

/** Hash for storage — same scheme as Laravel's Hash::make(). */
export function hashResetToken(token) {
  return bcrypt.hash(token, 10)
}

/** Constant-time-ish comparison via bcrypt. Never throws on a malformed stored value. */
export async function verifyResetToken(token, hashed) {
  if (!token || !hashed) return false
  try {
    return await bcrypt.compare(token, hashed)
  } catch {
    return false
  }
}

/** config/auth.php: passwords.users.expire = 60 (minutes). */
export const RESET_TOKEN_EXPIRY_MINUTES = 60

export function isResetTokenExpired(createdAt, minutes = RESET_TOKEN_EXPIRY_MINUTES) {
  if (!createdAt) return true
  return Date.now() - new Date(createdAt).getTime() > minutes * 60 * 1000
}

export default {
  AUTH_COOKIE,
  GUEST_COOKIE,
  signAuthToken,
  rememberFlag,
  verifyAuthToken,
  setAuthCookie,
  clearAuthCookie,
  readAuthToken,
  cookieOptions,
  expiresInMs,
  generateResetToken,
  hashResetToken,
  verifyResetToken,
  isResetTokenExpired,
  RESET_TOKEN_EXPIRY_MINUTES,
}
