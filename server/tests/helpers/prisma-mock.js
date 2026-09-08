import { vi } from 'vitest'

/**
 * In-memory Prisma stand-in.
 *
 * Phase 2 must be verifiable before the production dump is restored locally, so these
 * tests exercise the real services and routes against a fake data layer. They prove the
 * business RULES (validation order, error messages, token handling, role checks); they do
 * not prove the SQL. Query correctness is verified separately once the dev database is
 * available — see docs/migration-status.md.
 *
 * Only the subset of the Prisma API the auth code actually uses is implemented.
 */

const clone = (row) => (row ? { ...row } : row)

/** Very small `where` matcher: equality, NOT, and gte on dates. */
function matches(row, where = {}) {
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'NOT') return !matches(row, condition)
    if (key === 'AND') return condition.every((c) => matches(row, c))
    if (key === 'OR') return condition.some((c) => matches(row, c))

    const value = row[key]
    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      if ('gte' in condition) return new Date(value) >= new Date(condition.gte)
      if ('lte' in condition) return new Date(value) <= new Date(condition.lte)
      if ('equals' in condition) return value === condition.equals
      return false
    }
    if (typeof value === 'bigint' || typeof condition === 'bigint') {
      return String(value) === String(condition)
    }
    return value === condition
  })
}

export function createPrismaMock(seed = {}) {
  const tables = {
    user: [...(seed.user ?? [])],
    passwordResetToken: [...(seed.passwordResetToken ?? [])],
    passwordResetAttempt: [...(seed.passwordResetAttempt ?? [])],
  }

  let nextId = Math.max(0, ...tables.user.map((u) => Number(u.id ?? 0))) + 1

  const model = (name, { pk = 'id' } = {}) => ({
    findFirst: vi.fn(async ({ where } = {}) => clone(tables[name].find((r) => matches(r, where)))),
    findUnique: vi.fn(async ({ where } = {}) => clone(tables[name].find((r) => matches(r, where)))),
    findMany: vi.fn(async ({ where } = {}) =>
      tables[name].filter((r) => matches(r, where)).map(clone),
    ),
    count: vi.fn(async ({ where } = {}) => tables[name].filter((r) => matches(r, where)).length),
    create: vi.fn(async ({ data }) => {
      const row = { ...data }
      if (name === 'user' && row.id === undefined) row.id = BigInt(nextId++)
      if (row.createdAt === undefined) row.createdAt = new Date()
      tables[name].push(row)
      return clone(row)
    }),
    update: vi.fn(async ({ where, data }) => {
      const row = tables[name].find((r) => matches(r, where))
      if (!row) throw Object.assign(new Error('Record not found'), { code: 'P2025' })
      Object.assign(row, data)
      return clone(row)
    }),
    upsert: vi.fn(async ({ where, create, update }) => {
      const row = tables[name].find((r) => matches(r, where))
      if (row) {
        Object.assign(row, update)
        return clone(row)
      }
      tables[name].push({ ...create })
      return clone(create)
    }),
    delete: vi.fn(async ({ where }) => {
      const index = tables[name].findIndex((r) => matches(r, where))
      if (index === -1) throw Object.assign(new Error('Record not found'), { code: 'P2025' })
      const [row] = tables[name].splice(index, 1)
      return clone(row)
    }),
    deleteMany: vi.fn(async ({ where } = {}) => {
      const before = tables[name].length
      tables[name] = tables[name].filter((r) => !matches(r, where))
      return { count: before - tables[name].length }
    }),
    __rows: () => tables[name],
    __pk: pk,
  })

  const prisma = {
    user: model('user'),
    passwordResetToken: model('passwordResetToken', { pk: 'email' }),
    passwordResetAttempt: model('passwordResetAttempt'),
    // The auth service passes an array of already-invoked promises, matching how
    // prisma.$transaction([...]) is used in the source.
    $transaction: vi.fn(async (operations) => Promise.all(operations)),
    $queryRaw: vi.fn(async () => [{ 1: 1 }]),
    $disconnect: vi.fn(async () => {}),
    $on: vi.fn(),
    __tables: tables,
  }

  return prisma
}

export default createPrismaMock
