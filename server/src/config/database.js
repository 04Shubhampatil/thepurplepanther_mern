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

const adapter = new PrismaMariaDb(env.DATABASE_URL, {
  // Laravel wrote timestamps in Asia/Kolkata local time with no offset stored.
  // Keeping the connection in the same zone means values round-trip unchanged.
  timezone: env.TZ,
  connectionLimit: 10,
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
