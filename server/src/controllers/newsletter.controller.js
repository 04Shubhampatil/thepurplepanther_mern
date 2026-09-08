import { z } from 'zod'
import prisma from '../config/database.js'
import { ok, created, asyncHandler } from '../utils/api-response.js'
import { ValidationError } from '../utils/api-error.js'
import * as meta from '../integrations/meta/capi.js'

/**
 * Newsletter and contact — ports of NewsletterController and the public contact form.
 *
 * Both write rows an admin later reads, so both validate strictly server-side and neither
 * trusts anything about the shape of the input.
 */

const emailSchema = z.object({
  email: z
    .string({ error: 'Please enter your email address.' })
    .trim()
    .min(1, 'Please enter your email address.')
    .max(255)
    .email('Please enter a valid email address.')
    .transform((v) => v.toLowerCase()),
})

const contactSchema = z.object({
  name: z.string({ error: 'Please enter your name.' }).trim().min(1, 'Please enter your name.').max(255),
  email: z
    .string({ error: 'Please enter a valid email address.' })
    .trim()
    .max(255)
    .email('Please enter a valid email address.')
    .transform((v) => v.toLowerCase()),
  subject: z.string().max(255).nullish().transform((v) => (v ? v.trim() : null)),
  message: z
    .string({ error: 'Please enter a message.' })
    .trim()
    .min(1, 'Please enter a message.')
    .max(5000),
})

/** NewsletterController::check — inline availability check on the footer form. */
export const check = asyncHandler(async (req, res) => {
  const { email } = emailSchema.parse(req.body)
  const existing = await prisma.subscriber.findUnique({ where: { email }, select: { id: true } })

  return ok(
    res,
    { available: !existing },
    existing ? 'This email is already subscribed.' : 'Email is available.',
  )
})

export const subscribe = asyncHandler(async (req, res) => {
  const { email } = emailSchema.parse(req.body)

  const existing = await prisma.subscriber.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    throw new ValidationError(
      { email: ['This email is already subscribed.'] },
      'This email is already subscribed.',
    )
  }

  const subscriber = await prisma.subscriber.create({ data: { email } })

  meta.trackAsync(
    'Subscribe',
    req,
    { content_name: 'Email newsletter' },
    { email: subscriber.email, external_id: `subscriber_${subscriber.id}` },
  )

  return created(
    res,
    { subscriber: { id: subscriber.id, email: subscriber.email } },
    'Thanks for subscribing!',
  )
})

/**
 * Contact form.
 *
 * Note: `Contact` is declared in MetaConversionsService::SUPPORTED_EVENTS but has NO call
 * site in the source — Laravel never emitted it here. Not added, so the event stream stays
 * identical to production.
 */
export const contact = asyncHandler(async (req, res) => {
  const data = contactSchema.parse(req.body)
  const message = await prisma.contactMessage.create({ data })

  return created(
    res,
    { id: message.id },
    'Thanks for getting in touch. We will reply shortly.',
  )
})

export default { check, subscribe, contact }
