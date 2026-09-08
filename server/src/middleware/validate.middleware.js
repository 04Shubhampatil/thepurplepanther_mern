import { ValidationError } from '../utils/api-error.js'

/**
 * Zod validation middleware.
 *
 * Replaces the parsed value back onto the request so downstream code sees the transformed
 * data (trimmed, lower-cased email, coerced booleans) rather than the raw input — the
 * same guarantee Laravel's $request->validate() gave.
 *
 * Backend validation is authoritative. Nothing here trusts the client.
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source])

    if (!result.success) {
      const errors = {}
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_'
        ;(errors[key] ??= []).push(issue.message)
      }
      // Laravel surfaced the first message as the top-level one.
      const first = Object.values(errors)[0]?.[0] ?? 'The given data was invalid.'
      return next(new ValidationError(errors, first))
    }

    if (source === 'body') {
      req.body = result.data
    } else {
      // req.query and req.params are getter-only in Express 5.
      req.validated = { ...(req.validated ?? {}), [source]: result.data }
    }
    next()
  }
}

export default validate
