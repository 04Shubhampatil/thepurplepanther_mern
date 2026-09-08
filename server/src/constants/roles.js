/**
 * Mirrors the `users.role` enum('admin','customer').
 *
 * There is no separate admin guard in the source application: admin and customer share
 * one users table and one auth guard, separated only by this column plus the `admin` /
 * `customer` middleware. The Node port keeps that model so both apps can read the same
 * rows during the parallel run.
 */
export const ROLES = Object.freeze({
  ADMIN: 'admin',
  CUSTOMER: 'customer',
})

export const isAdmin = (user) => user?.role === ROLES.ADMIN
export const isCustomer = (user) => user?.role === ROLES.CUSTOMER

/** Laravel's `login_provider` values. Google login exists in the schema but has no routes. */
export const LOGIN_PROVIDERS = Object.freeze({
  EMAIL: 'email',
  GOOGLE: 'google',
})

export default ROLES
