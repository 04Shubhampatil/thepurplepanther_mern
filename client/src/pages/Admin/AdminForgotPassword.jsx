import { useEffect, useState } from 'react'
import * as api from '../../services/endpoints.js'
import Seo from '../../components/common/Seo.jsx'
import AdminAuthShell, {
  ICONS,
  AuthField,
  AuthButton,
  AuthLink,
  AuthAlert,
  validateField,
} from '../../components/admin/AdminAuthShell.jsx'

/** admin-auth.js's rules for this form, with its wording. */
const RULES = [
  { type: 'required', message: 'Email is required.' },
  { type: 'email', message: 'Please enter a valid email address.' },
]

/**
 * admin/auth/forgot-password.blade.php.
 *
 * Points at the SAME endpoint the storefront's reset uses. Laravel's admin controller calls
 * `Password::sendResetLink` on the default broker — one `users` table, one broker — so an
 * admin and a customer go through the identical flow, including the 2-per-day cap.
 */
export default function AdminForgotPassword() {
  useEffect(() => {
    import('../../admin.css')
  }, [])

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [alert, setAlert] = useState(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    setAlert(null)

    const found = validateField(email, RULES)
    setError(found)
    if (found) return

    setBusy(true)
    try {
      const res = await api.auth.forgotPassword(email.trim())
      // Deliberately not "we found your account" — the endpoint answers the same either
      // way, so the page must not leak whether an address is registered.
      setAlert({ tone: 'success', text: res.$message ?? 'If that email is registered, a reset link is on its way.' })
    } catch (err) {
      setAlert({ tone: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminAuthShell>
      <Seo title="Forgot Password" noIndex />

      <AuthAlert tone={alert?.tone}>{alert?.text}</AuthAlert>

      <form onSubmit={onSubmit} noValidate className="w-full">
        <AuthField
          icon={ICONS.mail}
          type="email"
          name="email"
          value={email}
          error={error}
          onChange={(event) => {
            setEmail(event.target.value)
            setError(validateField(event.target.value, RULES))
          }}
          onBlur={() => setError(validateField(email, RULES))}
          placeholder="Email"
          autoComplete="email"
          autoFocus
        />

        <AuthLink to="/admin/login">Click here to Login</AuthLink>

        <AuthButton type="submit" disabled={busy}>{busy ? 'SENDING…' : 'SEND'}</AuthButton>
      </form>
    </AdminAuthShell>
  )
}
