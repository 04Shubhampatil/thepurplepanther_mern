import { z } from 'zod'

/** Coerce a query-string integer with a default and bounds. */
const intParam = (fallback, { min = 1, max = 100 } = {}) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : Number.parseInt(v, 10)))
    .pipe(z.number().int().min(min).max(max).catch(fallback))

/**
 * Product listing query.
 *
 * `q` and `search` are both accepted because Laravel read either
 * (`$request->query('q', $request->query('search', ''))`) and existing inbound links use
 * both spellings.
 */
export const productListQuerySchema = z
  .object({
    q: z.string().optional(),
    search: z.string().optional(),
    category: z.string().optional(),
    page: intParam(1, { min: 1, max: 100_000 }),
    per_page: intParam(50, { min: 1, max: 100 }),
  })
  .transform((data) => ({
    search: (data.q ?? data.search ?? '').trim(),
    category: data.category?.trim() || null,
    page: data.page,
    perPage: data.per_page,
  }))

export const searchQuerySchema = z
  .object({
    q: z.string().optional(),
    limit: intParam(8, { min: 1, max: 20 }),
  })
  .transform((data) => ({ query: (data.q ?? '').trim(), limit: data.limit }))

/** Matches FrontendController::storeProductReview's rules and messages. */
export const createReviewSchema = z.object({
  rating: z.coerce
    .number({ error: 'Please choose a rating.' })
    .int('Please choose a rating.')
    .min(1, 'Please choose a rating.')
    .max(5, 'Please choose a rating.'),
  comment: z
    .string({ error: 'Please write a review.' })
    .trim()
    .min(10, 'Please write at least 10 characters.')
    .max(2000, 'Reviews are limited to 2000 characters.'),
  reviewer_name: z
    .string({ error: 'Please enter your name.' })
    .trim()
    .min(1, 'Please enter your name.')
    .max(255),
  reviewer_email: z
    .string({ error: 'Please enter a valid email address.' })
    .trim()
    .max(255)
    .email('Please enter a valid email address.')
    .transform((v) => v.toLowerCase()),
})

export const idsQuerySchema = z
  .object({ ids: z.string().optional() })
  .transform((data) => ({
    ids: (data.ids ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter((v) => /^\d+$/.test(v))
      .slice(0, 12), // Laravel capped recently-viewed at 12
  }))

export default { productListQuerySchema, searchQuerySchema, createReviewSchema, idsQuerySchema }
