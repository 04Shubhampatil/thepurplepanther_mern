import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import env from './env.js'
import logger from './logger.js'

/**
 * Prisma 7 connects through a driver adapter rather than a URL in schema.prisma.
 *
 * `decimalAsNumber` is deliberately NOT enabled: money columns are decimal(10,2) /
 * decimal(12,2) and must stay exact. All arithmetic goes through utils/money.js.
 */

/*
 * POOL SIZING IS ABOUT A QUOTA, NOT THROUGHPUT.
 *
 * Shared MySQL hosting commonly caps an account at max_connections_per_hour (Hostinger:
 * 500), and every NEW connection counts — not concurrent ones. The mariadb pool's
 * `minimumIdle` defaults to `connectionLimit`, so a process opened ten connections the moment
 * it started and, after the 30-minute `idleTimeout`, closed and reopened all ten. Any host
 * that restarts the process on wake, plus nodemon restarting it on every file save, spent
 * the hour's budget in an afternoon — after which every request failed with
 * ER_USER_LIMIT_REACHED until the hour rolled over. The site was down, and the logs called
 * it a pool timeout.
 *
 * So: open ONE connection at start, grow only under real load, and keep what is open for
 * hours rather than minutes. A quiet shop now spends one connection per process lifetime.
 */
const adapter = new PrismaMariaDb(env.DATABASE_URL, {
  // Laravel wrote timestamps in Asia/Kolkata local time with no offset stored.
  // Keeping the connection in the same zone means values round-trip unchanged.
  timezone: env.TZ,
  connectionLimit: env.DB_POOL_MAX,
  minimumIdle: 1,
  idleTimeout: env.DB_POOL_IDLE_SECONDS,
  /*
   * TEXT PROTOCOL, NOT PREPARED STATEMENTS — this is what makes search work.
   *
   * Every `contains` filter (storefront search, /shop?q=, admin product/category/order
   * search) compiles to `LIKE CONCAT('%', ?, '%')`. Over the driver's binary protocol
   * (`execute`) the bound parameter reaches MySQL/MariaDB with a binary collation, and
   * CONCAT of that with the '%' literals yields `utf8mb4_bin,NONE` — which cannot be
   * compared against a `utf8mb4_unicode_ci` column: error 1267 "Illegal mix of
   * collations", surfaced to the browser as "A database error occurred." It reproduces
   * on both the production MySQL and the local MariaDB 11 dev server. With the text
   * protocol the connector escapes the value and inlines it as a plain string literal,
   * so it simply takes the column's collation. Result decoding (typeCast, jsonStrings,
   * bitOneIsBoolean) is shared by both paths in the adapter, so nothing else changes.
   * Setting a `collation` on the connection does NOT fix it — that was tried.
   */
  useTextProtocol: true,
})

const globalForPrisma = globalThis

export const prisma =
  globalForPrisma.__ppPrisma ??
  new PrismaClient({
    adapter,
    log: env.isProduction
      ? [{ emit: 'event', level: 'error' }]
      : [
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
        ],
  })

prisma.$on?.('error', (e) => logger.error({ prisma: e }, 'Prisma error'))
prisma.$on?.('warn', (e) => logger.warn({ prisma: e }, 'Prisma warning'))

// Avoid exhausting the pool across nodemon reloads in development.
if (!env.isProduction) globalForPrisma.__ppPrisma = prisma

export async function connectDatabase() {
  await prisma.$queryRaw`SELECT 1`
  logger.info('Database connected')
}

export async function disconnectDatabase() {
  await prisma.$disconnect()
  logger.info('Database disconnected')
}

export default prisma
