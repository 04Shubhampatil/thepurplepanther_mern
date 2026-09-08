import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import pinoHttp from 'pino-http'
import rateLimit from 'express-rate-limit'

import env from './config/env.js'
import logger from './config/logger.js'
import apiV1 from './routes/index.js'
import { feed as metaCatalogFeed } from './controllers/catalog-feed.controller.js'
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js'
import { installBigIntSerializer } from './utils/json.js'

installBigIntSerializer()

const app = express()

// Hostinger and most PaaS front the app with a proxy. Without this, req.ip is the
// proxy's address, which would break both rate limiting and the Meta CAPI
// client_ip_address field.
app.set('trust proxy', 1)
app.disable('x-powered-by')

// ---------------------------------------------------------------- security
app.use(
  helmet({
    // The API serves JSON and a CSV feed; it renders no HTML of its own.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
)

// Credentials must be allowed: auth and the guest cart both ride on cookies,
// which means the origin cannot be '*'.
const allowedOrigins = [env.FRONTEND_URL, env.APP_URL].filter(Boolean)
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true) // curl, server-to-server, health checks
      if (allowedOrigins.includes(origin)) return callback(null, true)
      return callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
)

// ---------------------------------------------------------------- parsing
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))
app.use(cookieParser(env.SESSION_SECRET))

// ---------------------------------------------------------------- logging
app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
    customLogLevel(req, res, err) {
      if (err || res.statusCode >= 500) return 'error'
      if (res.statusCode >= 400) return 'warn'
      return 'info'
    },
  }),
)

// ---------------------------------------------------------------- rate limiting
app.use(
  '/api/',
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/v1/health',
    message: { success: false, message: 'Too many requests. Please try again later.' },
  }),
)

// ---------------------------------------------------------------- static media
// Serves the existing public/storage tree so image paths stored by Laravel keep
// resolving unchanged. In production a web server or CDN should serve this instead.
if (env.STORAGE_ROOT) {
  app.use('/storage', express.static(env.STORAGE_ROOT, { maxAge: '7d', fallthrough: true }))
}

// The bundled theme (CSS, fonts, images) is served at /frontend, exactly as Laravel served
// it. Keeping ONE copy at the same path means every relative url() inside the stylesheets
// resolves unchanged, and the `frontend/...` fallbacks in utils/media.js keep working.
if (env.THEME_ROOT) {
  app.use('/frontend', express.static(env.THEME_ROOT, { maxAge: '30d', fallthrough: true }))
}

// ---------------------------------------------------------------- routes
app.use('/api/v1', apiV1)

// The Meta catalog feed is also served at its ORIGINAL Laravel path, because Meta Commerce
// Manager is configured against that URL. Serving both means the feed keeps working
// through cutover without a change on Meta's side. See docs/route-mapping.md §6.
app.get('/catalog/meta/products.csv', metaCatalogFeed)

// ---------------------------------------------------------------- errors
app.use(notFoundHandler)
app.use(errorHandler)

export default app
