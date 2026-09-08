import { Router } from 'express'
import prisma from '../config/database.js'
import env from '../config/env.js'
import { ok, fail, asyncHandler } from '../utils/api-response.js'

const router = Router()

/** Upper bound on the database probe. Kept well under typical proxy read timeouts. */
const HEALTH_DB_TIMEOUT_MS = 2000

/**
 * GET /api/v1/health
 *
 * Reports integration configuration as booleans only — never which values are set to
 * what, and never a secret. Used by the deploy check and the cutover runbook.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const startedAt = Date.now()
    let database = 'up'

    // A health probe must answer fast even when the database is unreachable. Without
    // this race the driver's own connect/retry cycle keeps the request open for far
    // longer than any sensible load-balancer timeout, so an outage reads as a hang
    // rather than as "down".
    try {
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('health check timed out')), HEALTH_DB_TIMEOUT_MS),
        ),
      ])
    } catch {
      database = 'down'
    }

    const body = {
      status: database === 'up' ? 'ok' : 'degraded',
      environment: env.NODE_ENV,
      timezone: env.TZ,
      uptime: Math.floor(process.uptime()),
      checks: {
        database,
        latencyMs: Date.now() - startedAt,
      },
      integrations: {
        razorpay: env.razorpayConfigured,
        mail: env.mailConfigured,
        metaCapi: env.metaCapiEnabled,
        metaCatalog: true, // token is mandatory; boot fails without it
      },
    }

    return database === 'up'
      ? ok(res, body, 'Healthy')
      : fail(res, 'Database unavailable', 503, body.checks)
  }),
)

export default router
