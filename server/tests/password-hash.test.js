import { describe, it, expect } from 'vitest'
import bcrypt from 'bcrypt'
import {
  verifyPassword,
  hashPassword,
  normalizeHash,
  isBcryptHash,
  needsRehash,
  BCRYPT_COST,
} from '../src/utils/password.js'

/**
 * Decision D5 — the highest-risk unknown in the migration, now resolved.
 *
 * Laravel writes `$2y$` bcrypt hashes. The `bcrypt` npm package does NOT accept that
 * prefix: it returns false rather than throwing, so a naive port would have locked out
 * every existing customer with a message indistinguishable from a wrong password.
 *
 * The first suite documents that upstream behaviour so the regression can never be
 * reintroduced by "simplifying" utils/password.js. The rest verify the fix.
 *
 * No production hash is used anywhere here.
 */

const PASSWORD = 'CorrectHorseBattery1'
const withPrefix = (hash, prefix) => prefix + hash.slice(4)

describe('the upstream hazard this utility exists to fix', () => {
  it('bcrypt.compare() silently fails on Laravel $2y$ hashes', async () => {
    const generated = await bcrypt.hash(PASSWORD, BCRYPT_COST)

    // Same algorithm, same cost, same salt, same digest — only the prefix differs.
    await expect(bcrypt.compare(PASSWORD, withPrefix(generated, '$2a$'))).resolves.toBe(true)
    await expect(bcrypt.compare(PASSWORD, withPrefix(generated, '$2b$'))).resolves.toBe(true)

    // ...and yet:
    await expect(bcrypt.compare(PASSWORD, withPrefix(generated, '$2y$'))).resolves.toBe(false)
  })
})

describe('normalizeHash', () => {
  it('rewrites only the version prefix', async () => {
    const generated = await bcrypt.hash(PASSWORD, BCRYPT_COST)
    const laravelStyle = withPrefix(generated, '$2y$')
    const normalized = normalizeHash(laravelStyle)

    expect(normalized.startsWith('$2b$')).toBe(true)
    expect(normalized.slice(4)).toBe(laravelStyle.slice(4)) // cost + salt + digest intact
    expect(normalized).toHaveLength(60)
  })

  it('leaves $2a$ and $2b$ hashes untouched', async () => {
    const generated = await bcrypt.hash(PASSWORD, BCRYPT_COST)
    expect(normalizeHash(generated)).toBe(generated)
    expect(normalizeHash(withPrefix(generated, '$2a$'))).toBe(withPrefix(generated, '$2a$'))
  })

  it('passes through values that are not 60-char hashes', () => {
    expect(normalizeHash('')).toBe('')
    expect(normalizeHash(null)).toBe(null)
    expect(normalizeHash('short')).toBe('short')
  })
})

describe('verifyPassword — Laravel hash compatibility', () => {
  it('verifies a $2y$ hash with the correct password', async () => {
    const laravelStyle = withPrefix(await bcrypt.hash(PASSWORD, BCRYPT_COST), '$2y$')
    await expect(verifyPassword(PASSWORD, laravelStyle)).resolves.toBe(true)
  })

  it('rejects a $2y$ hash with the wrong password', async () => {
    const laravelStyle = withPrefix(await bcrypt.hash(PASSWORD, BCRYPT_COST), '$2y$')
    await expect(verifyPassword('definitely-wrong', laravelStyle)).resolves.toBe(false)
  })

  it('accepts $2a$, $2b$ and $2y$ interchangeably', async () => {
    const generated = await bcrypt.hash(PASSWORD, BCRYPT_COST)
    for (const prefix of ['$2a$', '$2b$', '$2y$']) {
      await expect(verifyPassword(PASSWORD, withPrefix(generated, prefix))).resolves.toBe(true)
    }
  })

  it('honours the cost embedded in the hash, not a local default', async () => {
    // Existing rows carry Laravel's cost. Raising the app's cost must never invalidate them.
    const cheap = withPrefix(await bcrypt.hash(PASSWORD, 4), '$2y$')
    expect(cheap.slice(0, 7)).toBe('$2y$04$')
    await expect(verifyPassword(PASSWORD, cheap)).resolves.toBe(true)
  })

  it('returns false rather than throwing on malformed or legacy hashes', async () => {
    for (const bad of ['', 'not-a-hash', '$2y$', 'md5hashvalue', null, undefined]) {
      await expect(verifyPassword(PASSWORD, bad)).resolves.toBe(false)
    }
  })

  it('returns false for an empty password without consulting the hash', async () => {
    const valid = await bcrypt.hash(PASSWORD, BCRYPT_COST)
    await expect(verifyPassword('', valid)).resolves.toBe(false)
    await expect(verifyPassword(null, valid)).resolves.toBe(false)
  })
})

describe('hashPassword — round-trip and Laravel interoperability', () => {
  it('produces a verifiable hash at Laravel\'s cost', async () => {
    const hash = await hashPassword(PASSWORD)
    expect(isBcryptHash(hash)).toBe(true)
    expect(hash.slice(0, 7)).toBe(`$2b$${String(BCRYPT_COST).padStart(2, '0')}$`)
    await expect(verifyPassword(PASSWORD, hash)).resolves.toBe(true)
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false)
  })

  it('writes $2b$, which PHP password_verify() also accepts', async () => {
    // This is what keeps rollback safe: a password changed in the new app must still
    // work in the Laravel app during the parallel run.
    const hash = await hashPassword(PASSWORD)
    expect(hash.startsWith('$2b$')).toBe(true)
  })

  it('salts each hash independently', async () => {
    const [a, b] = await Promise.all([hashPassword(PASSWORD), hashPassword(PASSWORD)])
    expect(a).not.toBe(b)
    await expect(verifyPassword(PASSWORD, a)).resolves.toBe(true)
    await expect(verifyPassword(PASSWORD, b)).resolves.toBe(true)
  })
})

describe('isBcryptHash / needsRehash', () => {
  it('recognises all bcrypt variants and rejects non-hashes', async () => {
    const generated = await bcrypt.hash(PASSWORD, BCRYPT_COST)
    for (const prefix of ['$2a$', '$2b$', '$2y$']) {
      expect(isBcryptHash(withPrefix(generated, prefix))).toBe(true)
    }
    for (const bad of ['', 'plaintext', '$1$md5$abc', null, 123]) {
      expect(isBcryptHash(bad)).toBe(false)
    }
  })

  it('flags only hashes whose cost differs from the configured cost', async () => {
    const atCost = await bcrypt.hash(PASSWORD, BCRYPT_COST)
    const belowCost = await bcrypt.hash(PASSWORD, 4)

    expect(needsRehash(atCost)).toBe(false)
    expect(needsRehash(withPrefix(atCost, '$2y$'))).toBe(false) // prefix alone is not a reason
    expect(needsRehash(belowCost)).toBe(true)
    expect(needsRehash('garbage')).toBe(true)
  })
})
