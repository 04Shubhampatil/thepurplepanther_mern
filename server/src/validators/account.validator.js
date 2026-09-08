import { z } from 'zod'

/** Account validation — rules and messages from AccountController. */

const optionalString = (max) =>
  z.string().max(max).nullish().transform((v) => (v == null || v === '' ? null : v.trim()))

export const updateProfileSchema = z
  .object({
    first_name: z
      .string({ error: 'Please enter your first name.' })
      .trim()
      .min(1, 'Please enter your first name.')
      .max(120),
    last_name: optionalString(120),
    email: z
      .string({ error: 'Please enter a valid email address.' })
      .trim()
      .max(255)
      .email('Please enter a valid email address.')
      .transform((v) => v.toLowerCase()),
    phone: optionalString(30),
    birth_date: z
      .string()
      .nullish()
      .transform((v) => (v == null || v === '' ? null : v))
      .refine((v) => v === null || !Number.isNaN(Date.parse(v)), 'Please enter a valid date.')
      // Laravel's `before:today`.
      .refine((v) => v === null || new Date(v) < new Date(), 'Birth date must be in the past.'),
    marketing_opt_in: z.coerce.boolean().optional(),
    current_password: z.string().nullish(),
    new_password: z
      .string()
      .min(6, 'New password must be at least 6 characters.')
      .max(255)
      .nullish()
      .transform((v) => (v === '' ? null : v)),
    new_password_confirmation: z.string().nullish(),
  })
  .refine(
    (data) =>
      !data.new_password ||
      data.new_password_confirmation == null ||
      data.new_password === data.new_password_confirmation,
    { message: 'New passwords do not match.', path: ['new_password'] },
  )
  // Caught here as well as in the service so the request never reaches a password write
  // without the current password having been supplied.
  .refine((data) => !data.new_password || Boolean(data.current_password), {
    message: 'Please enter your current password.',
    path: ['current_password'],
  })

export const addressSchema = z.object({
  name: z.string({ error: 'Please enter a name.' }).trim().min(1, 'Please enter a name.').max(255),
  address_line1: z
    .string({ error: 'Please enter an address.' })
    .trim()
    .min(1, 'Please enter an address.')
    .max(255),
  address_line2: optionalString(255),
  city: z.string({ error: 'Please enter a city.' }).trim().min(1, 'Please enter a city.').max(120),
  state: optionalString(120),
  pincode: z
    .string({ error: 'Please enter a pincode.' })
    .trim()
    .min(1, 'Please enter a pincode.')
    .max(20),
  country: z
    .string({ error: 'Please enter a country.' })
    .trim()
    .min(1, 'Please enter a country.')
    .max(120),
  label: optionalString(50),
  phone: optionalString(30),
  is_default: z.coerce.boolean().optional(),
})

export const wishlistSchema = z.object({
  product_id: z.coerce
    .number({ error: 'Please choose a product.' })
    .int()
    .positive('Please choose a product.'),
})

export default { updateProfileSchema, addressSchema, wishlistSchema }
