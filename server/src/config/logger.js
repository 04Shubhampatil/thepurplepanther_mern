import pino from 'pino'
import env from './env.js'

/**
 * Structured logging. The redact list is not optional decoration — the audit found live
 * credentials in the Laravel .env, and nothing in this app may ever log one.
 */
const redact = {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'res.headers["set-cookie"]',
    'password',
    '*.password',
    'password_confirmation',
    'token',
    '*.token',
    'razorpay_signature',
    '*.razorpay_signature',
    'access_token',
    '*.access_token',
    'DATABASE_URL',
    'JWT_SECRET',
    'SESSION_SECRET',
    'RAZORPAY_KEY_SECRET',
    'MAIL_PASSWORD',
    'META_CAPI_ACCESS_TOKEN',
    'META_CATALOG_FEED_TOKEN',
  ],
  censor: '[redacted]',
}

export const logger = pino({
  level: env.isTest ? 'silent' : env.LOG_LEVEL,
  redact,
  base: { env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(env.isProduction
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }),
})

export default logger
