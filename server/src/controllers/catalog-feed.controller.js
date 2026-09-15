import crypto from 'node:crypto'
import env from '../config/env.js'
import logger from '../config/logger.js'
import { streamFeedRows } from '../services/catalog-feed.service.js'
import { ForbiddenError } from '../utils/api-error.js'
import { asyncHandler } from '../utils/api-response.js'

/**
 * Meta product catalog feed.
 *
 * ── SECURITY CHANGE (audit R1) ────────────────────────────────────────────────
 * Laravel's check was:
 *
 *     if ($configuredToken !== '' && ! hash_equals($configuredToken, $providedToken))
 *         abort(403);
 *
 * An UNSET token therefore disabled the check entirely — and `META_CATALOG_FEED_TOKEN`
 * was absent from the production `.env`, so the full active catalogue was downloadable by
 * anyone who knew the URL.
 *
 * Here the token is MANDATORY: `config/env.js` refuses to boot without it, and a missing
 * or wrong token is always 403. This is the one deliberate behaviour change in the
 * migration, and it requires updating the feed URL in Meta Commerce Manager at cutover.
 * ──────────────────────────────────────────────────────────────────────────────
 */

/** Constant-time comparison, matching hash_equals. */
function tokenMatches(provided) {
  const expected = Buffer.from(env.META_CATALOG_FEED_TOKEN, 'utf8')
  const supplied = Buffer.from(String(provided ?? ''), 'utf8')
  if (expected.length !== supplied.length) return false
  return crypto.timingSafeEqual(expected, supplied)
}

/**
 * Streams the catalogue as CSV to `res`. Shared by the token-guarded Meta feed and the
 * public copy below, so both serve byte-identical output from `streamFeedRows()`.
 */
async function writeFeed(res, filename) {
  res.status(200)
  res.setHeader('Content-Type', 'text/csv; charset=UTF-8')
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('X-Content-Type-Options', 'nosniff')

  try {
    for await (const chunk of streamFeedRows()) {
      // Respect backpressure — a large catalogue must not be buffered in memory.
      if (!res.write(chunk)) {
        await new Promise((resolve) => res.once('drain', resolve))
      }
    }
    res.end()
  } catch (error) {
    // Headers are already sent, so the error middleware cannot produce a JSON body.
    // Ending the response truncates the CSV, which Meta treats as a failed fetch and
    // retries — far better than serving a silently incomplete catalogue.
    logger.error({ err: error }, 'Meta catalog feed stream failed')
    res.end()
  }
}

export const feed = asyncHandler(async (req, res) => {
  if (!tokenMatches(req.query.token)) {
    logger.warn({ ip: req.ip }, 'Meta catalog feed access denied')
    throw new ForbiddenError('Invalid feed token.')
  }

  await writeFeed(res, 'meta-products.csv')
})

/**
 * PUBLIC copy of the same feed — no token, added at the client's request so the product
 * CSV can be opened directly in a browser or Excel. It is the same read-only stream as
 * `feed` above (same columns, prices, availability, links and images) and only ever
 * includes ACTIVE products. The guarded Meta endpoint is untouched.
 */
export const publicFeed = asyncHandler(async (_req, res) => {
  await writeFeed(res, 'products.csv')
})

export default { feed, publicFeed }
