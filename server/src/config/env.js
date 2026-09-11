import 'dotenv/config'
import { z } from 'zod'

/**
 * Validated environment. Fail fast and loudly at boot rather than 500-ing later on a
 * missing secret. Nothing here is ever logged — see redact() in config/logger.js.
 */

const bool = (fallback = false) =>
  z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === '') return fallback
      if (typeof v === 'boolean') return v
      return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())
    })

const int = (fallback) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : Number(v)))
    .pipe(z.number().int())

/*
 * Every string value is TRIMMED. A value pasted into a hosting dashboard routinely arrives
 * with a trailing newline, and it does not fail loudly: MEDIA_BASE_URL with "
" on the
 * end produced image URLs of the form ".../storage
/banners/x.jpg" — syntactically a URL,
 * so nothing threw, and every image on the live site simply failed to load. No variable
 * here can legitimately begin or end with whitespace, so trimming loses nothing.
 */
const required = (name) =>
  z
    .string({ error: `${name} is required` })
    .trim()
    .min(1, `${name} must not be empty`)

const optional = (fallback = '') =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? fallback : v.trim()))

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: int(5000),
  APP_NAME: optional('The Purple Panther'),
  APP_URL: optional('http://localhost:5000'),
  FRONTEND_URL: optional('http://localhost:5173'),
  TZ: optional('Asia/Kolkata'),
  LOG_LEVEL: optional('info'),

  DATABASE_URL: required('DATABASE_URL'),
  DATABASE_URL_DEV: optional(''),

  JWT_SECRET: required('JWT_SECRET').min(32, 'JWT_SECRET must be at least 32 characters'),
  /* Lifetime of a "Remember me" sign-in. */
  JWT_EXPIRES_IN: optional('7d'),
  /*
   * Lifetime of a sign-in WITHOUT "Remember me", in minutes — config/session.php's
   * `lifetime`, whose default is 120. Laravel issued a session cookie that died with the
   * browser session and expired after this many minutes; only a remembered login outlived
   * it. Without this the two cases are indistinguishable and every visitor gets the long
   * one.
   */
  SESSION_LIFETIME_MINUTES: z.coerce.number().int().positive().default(120),
  SESSION_SECRET: required('SESSION_SECRET').min(32, 'SESSION_SECRET must be at least 32 characters'),

  /*
   * Serving the built React app from this same process is what makes the deployment a
   * single unit: one port, one origin, and therefore no CORS and no cross-site cookie
   * problem in production. Empty means "decide by NODE_ENV" — on in production, off in
   * development, where Vite serves the client with hot reload instead and this process
   * would only ever hand back a stale build.
   */
  SERVE_CLIENT: optional(''),
  /* Defaults to ../client/dist relative to the server package. */
  CLIENT_DIST: optional(''),

  COOKIE_DOMAIN: optional(''),
  COOKIE_SECURE: bool(false),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  RAZORPAY_KEY_ID: optional(''),
  RAZORPAY_KEY_SECRET: optional(''),
  RAZORPAY_CURRENCY: optional('INR'),

  MAIL_HOST: optional('smtp.gmail.com'),
  MAIL_PORT: int(587),
  MAIL_SECURE: bool(false),
  MAIL_USERNAME: optional(''),
  MAIL_PASSWORD: optional(''),
  MAIL_FROM_ADDRESS: optional(''),
  MAIL_FROM_NAME: optional('The Purple Panther'),
  MAIL_ADMIN_ADDRESS: optional(''),

  META_CAPI_ENABLED: bool(false),
  META_CAPI_DATASET_ID: optional(''),
  META_CAPI_ACCESS_TOKEN: optional(''),
  META_CAPI_API_VERSION: optional('v26.0'),
  META_CAPI_TEST_EVENT_CODE: optional(''),
  META_CAPI_TIMEOUT: int(4),

  // Mandatory by design — see audit R1. Laravel left it unset, which disabled the check.
  META_CATALOG_FEED_TOKEN: required('META_CATALOG_FEED_TOKEN').min(
    16,
    'META_CATALOG_FEED_TOKEN must be at least 16 characters',
  ),
  META_CATALOG_CURRENCY: optional('INR'),
  META_CATALOG_DEFAULT_BRAND: optional(''),

  STORAGE_ROOT: optional(''),
  THEME_ROOT: optional(''),
  MEDIA_BASE_URL: optional('http://localhost:5000/storage'),

  RATE_LIMIT_WINDOW_MS: int(15 * 60 * 1000),
  RATE_LIMIT_MAX: int(300),
  AUTH_RATE_LIMIT_MAX: int(20),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n')
  // Names only — never the values.
  console.error(`\nInvalid environment configuration:\n${issues}\n`)
  console.error('Copy server/.env.example to server/.env and fill it in.\n')
  process.exit(1)
}

const raw = parsed.data

// Timezone must be set before any Date is constructed, so that ordered_at, coupon
// windows and delivery dates match the Laravel app's Asia/Kolkata behaviour.
process.env.TZ = raw.TZ

export const env = Object.freeze({
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',

  mailAdminAddress: raw.MAIL_ADMIN_ADDRESS || raw.MAIL_FROM_ADDRESS,
  metaCatalogDefaultBrand: raw.META_CATALOG_DEFAULT_BRAND || raw.APP_NAME,
  mediaBaseUrl: raw.MEDIA_BASE_URL.replace(/\/+$/, ''),

  // Mirrors MetaConversionsService::enabled() — all three must be present.
  metaCapiEnabled: Boolean(
    raw.META_CAPI_ENABLED && raw.META_CAPI_DATASET_ID && raw.META_CAPI_ACCESS_TOKEN,
  ),
  razorpayConfigured: Boolean(raw.RAZORPAY_KEY_ID && raw.RAZORPAY_KEY_SECRET),
  mailConfigured: Boolean(raw.MAIL_HOST && raw.MAIL_USERNAME && raw.MAIL_PASSWORD),
})

/**
 * The only values React is ever allowed to receive. Everything else is server-only.
 * RAZORPAY_KEY_ID is deliberately excluded here — it ships with the checkout payload.
 */
export const publicConfig = Object.freeze({
  appName: env.APP_NAME,
  mediaBaseUrl: env.mediaBaseUrl,
  currency: env.RAZORPAY_CURRENCY,
})

export default env
