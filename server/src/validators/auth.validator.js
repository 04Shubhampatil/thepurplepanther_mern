import { z } from 'zod'

/**
 * Request validation. Rules and messages mirror the Laravel validators exactly — the
 * storefront displays these strings, so a reworded message is a visible change.
 *
 * Laravel's TrimStrings + ConvertEmptyStringsToNull middleware ran globally; the .trim()
 * transforms here reproduce that per-field.
 */

const email = z
  .string({ error: 'Please enter a valid email address.' })
  .trim()
  .min(1, 'Please enter your email address.')
  .max(255)
  .email('Please enter a valid email address.')
  .transform((v) => v.toLowerCase())

// min:6 — matches Laravel. Deliberately NOT raised: it would lock out existing customers
// whose passwords are shorter than a new minimum. Revisit as a product decision.
const password = z
  .string({ error: 'Password is required.' })
  .min(6, 'Password must be at least 6 characters.')
  .max(255)

export const loginSchema = z.object({
  email,
  password: z.string({ error: 'Password is required.' }).min(6, 'Password must be at least 6 characters.'),
  remember: z.union([z.boolean(), z.string()]).optional(),
})

/*
 * Laravel's `confirmed` rule requires `<field>_confirmation` to be PRESENT and equal. It
 * was optional here, so a client that simply omitted it skipped the check entirely — the
 * server has to be the authority (brief §22), and a caller that is not the project's own
 * form is exactly the case that matters.
 */
export const registerSchema = z
  .object({
    name: z.string({ error: 'Name is required.' }).trim().min(1, 'Name is required.').max(255),
    email,
    password,
    password_confirmation: z.string({ error: 'Passwords do not match.' }),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'Passwords do not match.',
    path: ['password'],
  })

export const checkEmailSchema = z.object({ email })

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({
    token: z.string({ error: 'Token is required.' }).min(1, 'Token is required.'),
    email,
    password,
    password_confirmation: z.string({ error: 'Passwords do not match.' }),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'Passwords do not match.',
    path: ['password'],
  })

/** Admin login takes ONE field that may hold a username or an email. */
export const adminLoginSchema = z.object({
  username: z.string({ error: 'Username is required.' }).trim().min(1, 'Username is required.').max(255),
  password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.'),
  remember: z.union([z.boolean(), z.string()]).optional(),
})

export const adminForgotPasswordSchema = z.object({ email })

/**
 * `Admin\AuthController::resetPassword` validates `min:8`, where the customer controller
 * validates `min:6`. Both are reproduced rather than unified — an admin credential is the
 * higher-value one and the source draws the distinction deliberately.
 */
export const adminResetPasswordSchema = z
  .object({
    token: z.string({ error: 'Token is required.' }).min(1, 'Token is required.'),
    email,
    password: z
      .string({ error: 'Password is required.' })
      .min(8, 'Password must be at least 8 characters.')
      .max(255),
    password_confirmation: z.string({ error: 'Passwords do not match.' }),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'Passwords do not match.',
    path: ['password'],
  })

export default {
  loginSchema,
  registerSchema,
  checkEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  adminLoginSchema,
  adminForgotPasswordSchema,
  adminResetPasswordSchema,
}
