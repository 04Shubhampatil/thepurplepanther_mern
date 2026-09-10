import app from './app.js'
import env from './config/env.js'
import logger from './config/logger.js'
import { connectDatabase, disconnectDatabase } from './config/database.js'

/**
 * Entry point. Verifies the database is reachable before accepting traffic, so a bad
 * DATABASE_URL fails at boot rather than on a customer's first request.
 */
async function start() {
  try {
    await connectDatabase()
  } catch (error) {
    logger.error({ err: error }, 'Could not connect to the database — check DATABASE_URL')
    process.exit(1)
  }

  const server = app.listen(env.PORT, () => {
    // Built from the port actually bound, not APP_URL — those disagree the moment PORT is
    // overridden, and a startup line pointing at the wrong port sends you debugging the
    // wrong process.
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, tz: env.TZ },
      `Listening on http://localhost:${env.PORT} (health: /api/v1/health)`,
    )
  })

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down')
    server.close(async () => {
      await disconnectDatabase()
      process.exit(0)
    })
    // Do not hang forever on a stuck connection.
    setTimeout(() => process.exit(1), 10_000).unref()
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection')
  })
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception — exiting')
    process.exit(1)
  })
}

start()
