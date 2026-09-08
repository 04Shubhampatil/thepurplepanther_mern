import { z } from 'zod'

/** Checkout validation — rules from CheckoutController::place and ::verify. */

const optionalString = (max) =>
  z.string().max(max).nullish().transform((v) => (v == null || v === '' ? null : v.trim()))

export const placeOrderSchema = z.object({
  first_name: z
    .string({ error: 'Please enter your first name.' })
    .trim()
    .min(1, 'Please enter your first name.')
    .max(100),
  last_name: z
    .string({ error: 'Please enter your last name.' })
    .trim()
    .min(1, 'Please enter your last name.')
    .max(100),
  email: z
    .string({ error: 'Please enter a valid email address.' })
    .trim()
    .max(255)
    .email('Please enter a valid email address.')
    .transform((v) => v.toLowerCase()),
  phone: z
    .string({ error: 'Please enter a phone number.' })
    .trim()
    .min(1, 'Please enter a phone number.')
    .max(30),
  company: optionalString(150),
  // Accepted for compatibility with the existing form, then overridden server-side:
  // the store ships only within India.
  country: optionalString(100),
  address_line1: z
    .string({ error: 'Please enter your address.' })
    .trim()
    .min(1, 'Please enter your address.')
    .max(255),
  address_line2: optionalString(255),
  city: z.string({ error: 'Please enter a city.' }).trim().min(1, 'Please enter a city.').max(120),
  state: z.string({ error: 'Please enter a state.' }).trim().min(1, 'Please enter a state.').max(120),
  pincode: z
    .string({ error: 'Please enter a pincode.' })
    .trim()
    .min(1, 'Please enter a pincode.')
    .max(20),
  notes: optionalString(1000),
})

/**
 * Payment verification.
 *
 * Note what is NOT accepted: an amount, a status, or any claim that payment succeeded.
 * The only inputs are the order id and the three Razorpay identifiers, and the signature
 * is what decides the outcome.
 */
export const verifyPaymentSchema = z.object({
  order_id: z.coerce.number({ error: 'Order is required.' }).int().positive('Order is required.'),
  razorpay_payment_id: z
    .string({ error: 'Payment id is required.' })
    .trim()
    .min(1, 'Payment id is required.')
    .max(255),
  razorpay_order_id: z
    .string({ error: 'Razorpay order id is required.' })
    .trim()
    .min(1, 'Razorpay order id is required.')
    .max(255),
  razorpay_signature: z
    .string({ error: 'Signature is required.' })
    .trim()
    .min(1, 'Signature is required.')
    .max(512),
})

export default { placeOrderSchema, verifyPaymentSchema }
