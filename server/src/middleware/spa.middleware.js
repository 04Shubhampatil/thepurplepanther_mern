import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import env from '../config/env.js'
import logger from '../config/logger.js'

/**
 * Serves the built React app from this Express process, which is what makes the deployment
 * a single unit rather than two.
 *
 * ONE ORIGIN IS THE POINT, not tidiness. Auth and the guest cart ride on cookies with
 * SameSite=Lax, and the API's CORS allowlist exists purely because the browser talks to a
 * different port in development. Served from here the front end and the API share an
 * origin, so those cookies are first-party by construction and CORS never enters into it.
 * It is the same arrangement Vite's dev proxy already fakes on port 5173.
 *
 * Deliberately NOT active in development: Vite owns the client there and gives hot reload,
 * and this process would only ever hand back whatever `vite build` last wrote — a stale
 * page that looks like an edit silently failing to apply.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url))

/** server/src/middleware -> ../../../client/dist */
const DEFAULT_DIST = path.resolve(HERE, '..', '..', '..', 'client', 'dist')

const TRUTHY = new Set(['1', 'true', 'yes', 'on'])

/** Empty means "decide by NODE_ENV"; an explicit value always wins. */
export function shouldServeClient() {
  const flag = String(env.SERVE_CLIENT ?? '').trim().toLowerCase()
  if (flag === '') return env.isProduction
  return TRUTHY.has(flag)
}

export function clientDistPath() {
  return env.CLIENT_DIST ? path.resolve(env.CLIENT_DIST) : DEFAULT_DIST
}

/**
 * Paths this must never answer, so a missing file 404s honestly instead of being handed an
 * HTML page.
 *
 * Returning index.html for a bad /api call is the classic failure of this setup: the client
 * gets 200 with HTML where it expected JSON, and the parse error it throws points nowhere
 * near the real problem. The same applies to media — a broken image should be a 404, not a
 * page.
 */
const NON_APP_PREFIXES = ['/api/', '/storage/', '/frontend/', '/catalog/']

const isNonAppPath = (url) =>
  NON_APP_PREFIXES.some((prefix) => url === prefix.slice(0, -1) || url.startsWith(prefix))

/**
 * Mounts static assets and the history fallback. Call AFTER the API routes and BEFORE the
 * 404 handler. Returns false when there is no build to serve, leaving the app API-only.
 */
export function serveClient(app) {
  const dist = clientDistPath()
  const indexFile = path.join(dist, 'index.html')

  if (!fs.existsSync(indexFile)) {
    logger.warn(
      { dist },
      'SERVE_CLIENT is on but no client build was found — run `npm run build` first. Serving API only.',
    )
    return false
  }

  /*
   * Vite fingerprints everything under /assets, so those files can be cached hard and
   * for ever: a changed file gets a new name. Everything else in dist keeps a short TTL
   * because the name is stable — index.html above all, which must be re-fetched to pick up
   * the new asset names after a deploy.
   */
  app.use(
    '/assets',
    express.static(path.join(dist, 'assets'), {
      maxAge: '1y',
      immutable: true,
      fallthrough: true,
    }),
  )

  // `index: false` so a directory request falls through to the history handler below and
  // gets the same treatment as any other route.
  app.use(express.static(dist, { maxAge: '1h', index: false, fallthrough: true }))

  /*
   * History fallback. A plain middleware rather than `app.get('*')` — Express 5 rewrote its
   * path matching and a bare '*' now throws at mount time.
   *
   * Only GET/HEAD, and only when the client is asking for a document: a POST to a route
   * that does not exist is an error, not a page, and an XHR expecting JSON should get the
   * 404 rather than markup.
   */
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (isNonAppPath(req.path)) return next()
    if (!req.accepts('html')) return next()

    return res.sendFile(indexFile, (error) => {
      if (error) next(error)
    })
  })

  logger.info({ dist }, 'Serving the React build from this process (single origin)')
  return true
}

export default serveClient
