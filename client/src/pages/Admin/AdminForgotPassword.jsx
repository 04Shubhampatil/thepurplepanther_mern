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
 * Points at the ADMIN endpoint, not the storefront's. The two are not interchangeable: the
 * customer flow scopes every lookup to role='customer', so an administrator's address came
 * back as "This email is not registered with us." and this form could never succeed.
 *
 * The admin flow also follows the broker's rules rather than the customer controller's —
 * a 60-second throttle between requests instead of the 2-per-day cap, and the broker's own
 * status wording.
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
      const res = await api.adminAuth.forgotPassword(email.trim())
      // The server decides the wording: the broker's RESET_LINK_SENT string on success,
      // and its INVALID_USER / RESET_THROTTLED strings as errors on the catch path.
      setAlert({ tone: 'success', text: res.$message ?? 'We have emailed your password reset link.' })
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
