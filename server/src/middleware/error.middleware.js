import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { ApiError } from '../utils/api-error.js'
import { fail } from '../utils/api-response.js'
import env from '../config/env.js'
import logger from '../config/logger.js'

/** 404 for anything no route matched. Mounted after all routers. */
export function notFoundHandler(req, res) {
  return fail(res, `Route ${req.method} ${req.originalUrl} not found.`, 404)
}

/** Flatten a ZodError into Laravel's { field: [messages] } shape, which React already expects. */
function zodToErrors(error) {
  const errors = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    ;(errors[key] ??= []).push(issue.message)
  }
  return errors
}

/**
 * Translate a Prisma error into a customer-safe response.
 * Never let a Prisma message reach the client — they embed table and column names.
 */
function fromPrisma(error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        const target = error.meta?.target
        const fields = Array.isArray(target) ? target : target ? [target] : ['field']
        const errors = Object.fromEntries(fields.map((f) => [f, ['This value is already taken.']]))
        return { status: 422, message: 'The given data was invalid.', errors }
      }
      case 'P2025':
        return { status: 404, message: 'Resource not found.' }
      case 'P2003':
        return { status: 422, message: 'Related record not found.' }
      case 'P2000':
        return { status: 422, message: 'The given value is too long for this field.' }
      default:
        return { status: 500, message: 'A database error occurred.' }
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return { status: 500, message: 'A database error occurred.' }
  }

  return null
}

/**
 * Central error handler. Express 5 forwards async rejections here automatically.
 * Must keep four arguments — that arity is how Express identifies it.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, next) {
  // --- expected: explicit application errors -------------------------------
  if (error instanceof ApiError) {
    if (error.statusCode >= 500) {
      logger.error({ err: error, url: req.originalUrl }, 'Application error')
    }
    return fail(res, error.message, error.statusCode, error.errors)
  }

  // --- expected: validation ------------------------------------------------
  if (error instanceof ZodError) {
    return fail(res, 'The given data was invalid.', 422, zodToErrors(error))
  }

  // --- expected: database --------------------------------------------------
  const prismaResult = fromPrisma(error)
  if (prismaResult) {
    logger.error({ err: error, code: error.code, url: req.originalUrl }, 'Prisma error')
    return fail(res, prismaResult.message, prismaResult.status, prismaResult.errors)
  }

  // --- expected: malformed request body ------------------------------------
  if (error.type === 'entity.parse.failed' || error instanceof SyntaxError) {
    return fail(res, 'Malformed JSON in request body.', 400)
  }
  if (error.type === 'entity.too.large') {
    return fail(res, 'Request body too large.', 413)
  }

  // --- expected: upload ----------------------------------------------------
  if (error.code === 'LIMIT_FILE_SIZE') {
    return fail(res, 'The uploaded file is too large.', 422)
  }
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return fail(res, 'Unexpected file upload field.', 422)
  }

  // --- unexpected ----------------------------------------------------------
  logger.error({ err: error, url: req.originalUrl, method: req.method }, 'Unhandled error')

  // Stack traces and internal messages never leave the server in production.
  return fail(
    res,
    env.isProduction ? 'Something went wrong. Please try again.' : error.message,
    500,
    env.isProduction ? null : { stack: error.stack?.split('\n').slice(0, 5) },
  )
}

export default errorHandler
