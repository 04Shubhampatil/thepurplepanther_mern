import bcrypt from 'bcrypt'

/**
 * Password hashing, compatible with the existing Laravel `users.password` column.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS — do not bypass it and call bcrypt.compare() directly.
 *
 * Laravel's Hash::make() writes hashes with the `$2y$` prefix. The `bcrypt` npm package
 * recognises `$2a$` and `$2b$` but NOT `$2y$`: given a `$2y$` hash it returns **false**
 * rather than throwing. Verified in tests/password-hash.test.js:
 *
 *     $2a$ -> true      $2b$ -> true      $2y$ -> false
 *
 * Used naively, every pre-existing customer would fail login with "these credentials do
 * not match our records" — a silent, total lockout that looks like a wrong password.
 *
 * `$2a$`, `$2b$` and `$2y$` are the SAME algorithm. The prefix is a historical marker
 * from the 2011 PHP crypt_blowfish sign-extension fix, not a difference in derivation, so
 * relabelling `$2y$` to `$2b$` before comparison is safe and lossless. It does not weaken
 * the hash: cost, salt and digest are untouched.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Laravel's default cost (config/hashing.php). Kept identical so rehashes match. */
export const BCRYPT_COST = 10

const BCRYPT_PATTERN = /^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/

/**
 * Normalise a stored hash to a prefix the `bcrypt` package understands.
 * Only the 4-character version prefix is rewritten; cost, salt and digest are preserved.
 */
export function normalizeHash(hash) {
  if (typeof hash !== 'string' || hash.length !== 60) return hash
  if (hash.startsWith('$2y$') || hash.startsWith('$2x$')) return `$2b$${hash.slice(4)}`
  return hash
}

/** True when the value looks like a bcrypt hash this app can verify. */
export function isBcryptHash(hash) {
  return typeof hash === 'string' && BCRYPT_PATTERN.test(hash)
}

/**
 * Verify a plaintext password against a stored hash.
 * Returns false — never throws — for malformed or legacy-format hashes, so a corrupt row
 * fails the login rather than 500-ing the endpoint.
 */
export async function verifyPassword(plain, hash) {
  if (!plain || !hash) return false
  if (!isBcryptHash(hash)) return false
  try {
    return await bcrypt.compare(plain, normalizeHash(hash))
  } catch {
    return false
  }
}

/**
 * Hash a new password.
 *
 * Writes the `$2b$` prefix. PHP's password_verify() accepts `$2b$`, so hashes created
 * here remain verifiable by the Laravel app — which matters during the parallel run and
 * for rollback: a customer who changes their password in the new app must still be able
 * to log into the old one.
 */
export async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_COST)
}

/** True when a stored hash should be upgraded on next successful login. */
export function needsRehash(hash) {
  if (!isBcryptHash(hash)) return true
  const cost = Number.parseInt(hash.slice(4, 6), 10)
  return cost !== BCRYPT_COST
}

export default { verifyPassword, hashPassword, normalizeHash, isBcryptHash, needsRehash, BCRYPT_COST }
