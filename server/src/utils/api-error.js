/**
 * Typed application errors. Anything thrown that is not an ApiError is treated as
 * unexpected: logged with a stack, reported to the client as a generic 500.
 *
 * Laravel's services threw RuntimeException for "the customer did something we can
 * explain" and those surfaced as HTTP 422 with the message shown verbatim. BusinessError
 * is the direct equivalent, so cart/coupon/checkout messages stay identical.
 */
export class ApiError extends Error {
  constructor(statusCode, message, { errors = null, code = null, expose = true } = {}) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.errors = errors
    this.code = code
    this.expose = expose
    Error.captureStackTrace?.(this, this.constructor)
  }
}

/** 422 — the Laravel RuntimeException equivalent. Message is shown to the customer. */
export class BusinessError extends ApiError {
  constructor(message, errors = null) {
    super(422, message, { errors })
  }
}

/** 422 — failed input validation, with a per-field error map. */
export class ValidationError extends ApiError {
  constructor(errors, message = 'The given data was invalid.') {
    super(422, message, { errors })
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthenticated.') {
    super(401, message)
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'This action is unauthorized.') {
    super(403, message)
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found.') {
    super(404, message)
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(429, message)
  }
}

export default ApiError
