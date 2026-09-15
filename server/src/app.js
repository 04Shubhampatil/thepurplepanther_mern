import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import pinoHttp from 'pino-http'
import rateLimit from 'express-rate-limit'

import env from './config/env.js'
import logger from './config/logger.js'
import apiV1 from './routes/index.js'
import {
  feed as metaCatalogFeed,
  publicFeed as publicCatalogFeed,
} from './controllers/catalog-feed.controller.js'
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js'
import { serveClient, shouldServeClient } from './middleware/spa.middleware.js'
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

/*
 * Credentials must be allowed: auth and the guest cart both ride on cookies, which means
 * the origin can never be '*'.
 *
 * SAME-ORIGIN IS ALWAYS ALLOWED, whatever the allowlist says. Once this process serves the
 * React build too, the browser labels its own requests with the origin it was served from —
 * and if that origin is not in the allowlist, every asset is refused. This middleware is
 * global, so that failure is not limited to the API: the stylesheet and the bundle come
 * back as errors and the page renders blank. Comparing against the request's own host
 * makes the rule independent of which host or port the app is deployed on.
 *
 * A REJECTED ORIGIN NO LONGER THROWS. Calling back with an Error turned a cross-origin
 * request into a 500 from this server; withholding the CORS headers instead lets the
 * BROWSER block the read, which is what actually enforces the policy, and leaves the
 * response honest for everyone else.
 */
const allowedOrigins = [env.FRONTEND_URL, env.APP_URL].filter(Boolean)

app.use(
  cors((req, callback) => {
    const origin = req.headers.origin
    const host = req.headers.host
    const selfOrigin = host ? `${req.protocol}://${host}` : null

    // No Origin header at all: curl, server-to-server, health checks, same-origin GETs.
    const allowed =
      !origin || origin === selfOrigin || allowedOrigins.includes(origin)

    callback(null, {
      origin: allowed,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    })
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
// Token-free copy of the same CSV, for opening directly in a browser or Excel.
app.get('/catalog/meta/products-public.csv', publicCatalogFeed)

// ---------------------------------------------------------------- client app
// Mounted AFTER every API route so nothing here can shadow one, and BEFORE the 404 handler
// so unknown front-end paths reach the SPA router instead of being rejected as API routes.
if (shouldServeClient()) serveClient(app)

// ---------------------------------------------------------------- errors
app.use(notFoundHandler)
app.use(errorHandler)

export default app
