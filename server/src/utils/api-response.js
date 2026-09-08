import { serialize } from './json.js'

/**
 * The response envelope from the migration brief §15. Every endpoint uses it, so the
 * React layer has exactly one shape to handle.
 *
 *   success: { success: true,  data: {...}, message: "..." }
 *   error:   { success: false, message: "...", errors: {...} }
 */

export function ok(res, data = {}, message = 'Success', status = 200) {
  return res.status(status).json({ success: true, data: serialize(data), message })
}

export function created(res, data = {}, message = 'Created') {
  return ok(res, data, message, 201)
}

export function noContent(res) {
  return res.status(204).send()
}

export function fail(res, message = 'Something went wrong', status = 400, errors = null) {
  const body = { success: false, message }
  if (errors) body.errors = errors
  return res.status(status).json(body)
}

/**
 * Wraps an async handler so a rejected promise reaches the error middleware.
 * Express 5 forwards rejections automatically, but this keeps the behaviour explicit
 * and unchanged if the handler is ever called outside a router.
 */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}

export default { ok, created, noContent, fail, asyncHandler }
