import prisma from '../config/database.js'
import logger from '../config/logger.js'
import { ROLES, LOGIN_PROVIDERS } from '../constants/roles.js'
import { verifyPassword, hashPassword } from '../utils/password.js'
import {
  generateResetToken,
  hashResetToken,
  verifyResetToken,
  isResetTokenExpired,
  RESET_TOKEN_EXPIRY_MINUTES,
} from '../utils/auth-token.js'
import { ValidationError, TooManyRequestsError } from '../utils/api-error.js'
import { avatarUrl } from '../utils/media.js'

/**
 * Authentication business logic.
 *
 * Ported from CustomerAuthController, Admin\AuthController and CustomerPasswordController.
 * Error messages are reproduced verbatim: they are user-visible strings the storefront
 * already displays, and changing them is a visible regression.
 */

const MAX_RESET_ATTEMPTS_PER_DAY = 2 // CustomerPasswordController::MAX_ATTEMPTS_PER_DAY

/** Shape returned to the client. Never includes password or rememberToken. */
export function toPublicUser(user) {
  const parts = String(user.name ?? '').trim().split(/\s+/)
  return {
    id: user.id,
    name: user.name,
    firstName: parts[0] ?? user.name,
    lastName: parts.slice(1).join(' ') ?? '',
    email: user.email,
    phone: user.phone ?? '',
    role: user.role,
    avatar: avatarUrl(user.avatar, user.name ?? ''),
    isGoogleLogin: user.loginProvider === LOGIN_PROVIDERS.GOOGLE,
  }
}

const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase()

// ─────────────────────────────────────────────────────────── customer

/**
 * CustomerAuthController::login — matches on email + role='customer', then checks
 * is_active and the password hash.
 *
 * All three failure modes return the SAME message, exactly as Laravel did. That is not an
 * oversight to "improve": distinguishing them would let an attacker enumerate which
 * addresses are registered.
 */
export async function loginCustomer({ email, password }) {
  const user = await prisma.user.findFirst({
    where: { email: normalizeEmail(email), role: ROLES.CUSTOMER },
  })

  const message = 'These credentials do not match our records.'
  if (!user || !user.isActive) {
    // Compare against a dummy hash anyway so a missing user and a wrong password take
    // comparable time — otherwise response timing leaks which emails exist.
    await verifyPassword(password, '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin')
    throw new ValidationError({ email: [message] }, message)
  }

  if (!(await verifyPassword(password, user.password))) {
    throw new ValidationError({ email: [message] }, message)
  }

  return user
}

/** CustomerAuthController::register — email must be unique across ALL users, not just customers. */
export async function registerCustomer({ name, email, password }) {
  const normalized = normalizeEmail(email)

  const existing = await prisma.user.findUnique({ where: { email: normalized } })
  if (existing) {
    throw new ValidationError(
      { email: ['This email is already registered.'] },
      'This email is already registered.',
    )
  }

  return prisma.user.create({
    data: {
      name,
      email: normalized,
      password: await hashPassword(password),
      role: ROLES.CUSTOMER,
      isActive: true,
      loginProvider: LOGIN_PROVIDERS.EMAIL,
    },
  })
}

/**
 * CustomerAuthController::checkEmail — used by the signup form's inline availability check.
 * Excludes the current user so an authenticated customer editing their profile does not
 * see their own address reported as taken.
 */
export async function isEmailAvailable(email, excludeUserId = null) {
  const where = { email: normalizeEmail(email) }
  if (excludeUserId) where.NOT = { id: BigInt(excludeUserId) }
  const existing = await prisma.user.findFirst({ where })
  return !existing
}

// ─────────────────────────────────────────────────────────── admin

/**
 * Admin\AuthController::login — the single `username` field accepts EITHER a username or
 * an email address, decided by whether the value parses as an email. Requires
 * role='admin' AND is_active.
 */
export async function loginAdmin({ username, password }) {
  const identifier = String(username ?? '').trim()
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)

  const user = await prisma.user.findFirst({
    where: {
      role: ROLES.ADMIN,
      isActive: true,
      ...(looksLikeEmail ? { email: identifier.toLowerCase() } : { username: identifier }),
    },
  })

  const message = 'Invalid username or password.'
  if (!user) {
    await verifyPassword(password, '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin')
    throw new ValidationError({ username: [message] }, message)
  }

  if (!(await verifyPassword(password, user.password))) {
    throw new ValidationError({ username: [message] }, message)
  }

  return user
}

// ─────────────────────────────────────────────── password reset

/**
 * CustomerPasswordController::sendResetLink.
 *
 * Two behaviours carried over deliberately:
 *  - An unregistered address gets an explicit "not registered" error (422). This IS user
 *    enumeration, and is flagged as R10 in the audit — but it is existing, user-visible
 *    behaviour and the storefront's forgot-password form depends on the message, so
 *    parity wins here. Changing it is a product decision, not a migration one.
 *  - Hard cap of 2 emails per address per 24 hours (429), counted in
 *    password_reset_attempts.
 *
 * Returns the plaintext token for the caller to email. The token is NEVER persisted or
 * logged in plaintext — only its bcrypt hash reaches the database.
 */
export async function createPasswordResetToken({ email, ip = null }) {
  const normalized = normalizeEmail(email)

  const user = await prisma.user.findFirst({
    where: { email: normalized, role: ROLES.CUSTOMER, isActive: true },
  })

  if (!user) {
    const message = 'This email is not registered with us.'
    throw new ValidationError({ email: [message] }, message)
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const attempts = await prisma.passwordResetAttempt.count({
    where: { email: normalized, createdAt: { gte: since } },
  })

  if (attempts >= MAX_RESET_ATTEMPTS_PER_DAY) {
    throw new TooManyRequestsError(
      'You have reached the limit of 2 password reset emails in 24 hours. Please try again later.',
    )
  }

  const token = generateResetToken()

  // password_reset_tokens is keyed by email, so a new request replaces any outstanding
  // token — same as Laravel's repository, and it means an old link stops working.
  await prisma.passwordResetToken.upsert({
    where: { email: normalized },
    create: { email: normalized, token: await hashResetToken(token), createdAt: new Date() },
    update: { token: await hashResetToken(token), createdAt: new Date() },
  })

  await prisma.passwordResetAttempt.create({
    data: { email: normalized, ipAddress: ip, createdAt: new Date() },
  })

  const remaining = Math.max(0, MAX_RESET_ATTEMPTS_PER_DAY - (attempts + 1))

  return { user, token, remaining, expiresMinutes: RESET_TOKEN_EXPIRY_MINUTES }
}

/**
 * CustomerPasswordController::reset.
 *
 * Every failure returns the same message, matching Laravel's behaviour of surfacing the
 * broker's generic status. The token row is deleted on success so a link is single-use.
 */
export async function resetPassword({ email, token, password }) {
  const normalized = normalizeEmail(email)
  const invalid = 'This reset link is invalid or has expired.'

  const user = await prisma.user.findFirst({
    where: { email: normalized, role: ROLES.CUSTOMER, isActive: true },
  })
  if (!user) throw new ValidationError({ email: [invalid] }, invalid)

  const record = await prisma.passwordResetToken.findUnique({ where: { email: normalized } })
  if (!record) throw new ValidationError({ email: [invalid] }, invalid)

  if (isResetTokenExpired(record.createdAt)) {
    await prisma.passwordResetToken.delete({ where: { email: normalized } }).catch(() => {})
    throw new ValidationError({ email: [invalid] }, invalid)
  }

  if (!(await verifyResetToken(token, record.token))) {
    throw new ValidationError({ email: [invalid] }, invalid)
  }

  const hashed = await hashPassword(password)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      // Laravel rotates remember_token on reset, invalidating other sessions.
      data: { password: hashed, rememberToken: generateResetToken(60) },
    }),
    prisma.passwordResetToken.delete({ where: { email: normalized } }),
  ])

  logger.info({ userId: String(user.id) }, 'Password reset completed')
  return user
}

// ─────────────────────────────────────────────────────────── shared

/** Reload a user by id. Returns null when missing or deactivated. */
export async function findActiveUserById(id) {
  if (id === null || id === undefined) return null
  let key
  try {
    key = BigInt(id)
  } catch {
    return null
  }
  const user = await prisma.user.findUnique({ where: { id: key } })
  return user && user.isActive ? user : null
}

export default {
  loginCustomer,
  registerCustomer,
  isEmailAvailable,
  loginAdmin,
  createPasswordResetToken,
  resetPassword,
  findActiveUserById,
  toPublicUser,
}
