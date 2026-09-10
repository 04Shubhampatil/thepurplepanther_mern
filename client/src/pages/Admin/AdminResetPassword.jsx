import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import * as api from '../../services/endpoints.js'
import Seo from '../../components/common/Seo.jsx'
import AdminAuthShell, {
  ICONS,
  AuthField,
  AuthButton,
  AuthLink,
  AuthAlert,
} from '../../components/admin/AdminAuthShell.jsx'

/**
 * admin/auth/reset-password.blade.php.
 *
 * The token rides in the URL and the email is pre-filled from the query string, exactly as
 * Laravel's reset link carries them. The email field stays EDITABLE rather than read-only —
 * the Blade renders a normal input, and the token is validated against the address on the
 * server anyway, so locking it here would add nothing.
 */
export default function AdminResetPassword() {
  useEffect(() => {
    import('../../admin.css')
  }, [])

  const { token: tokenParam } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const token = tokenParam ?? params.get('token') ?? ''

  const [email, setEmail] = useState(params.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [alert, setAlert] = useState(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    setAlert(null)

    if (!email.trim() || !password) {
      setAlert({ tone: 'error', text: 'Please fill in every field.' })
      return
    }
    if (password !== confirmation) {
      setAlert({ tone: 'error', text: 'The password confirmation does not match.' })
      return
    }

    setBusy(true)
    try {
      await api.auth.resetPassword({
        token,
        email: email.trim(),
        password,
        password_confirmation: confirmation,
      })
      // The reset does NOT sign you in — Laravel redirected to the login form, and so does
      // this, so the new password is used once before it is trusted.
      navigate('/admin/login', { replace: true })
    } catch (err) {
      setAlert({ tone: 'error', text: err.message })
      setBusy(false)
    }
  }

  return (
    <AdminAuthShell>
      <Seo title="Reset Password" noIndex />

      <AuthAlert tone={alert?.tone}>{alert?.text}</AuthAlert>

      <form onSubmit={onSubmit} noValidate className="w-full">
        <AuthField
          icon={ICONS.mail}
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          autoComplete="email"
        />

        <AuthField
          icon={ICONS.key}
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="New Password"
          autoComplete="new-password"
        />

        <AuthField
          icon={ICONS.key}
          type="password"
          name="password_confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder="Confirm Password"
          autoComplete="new-password"
        />

        <AuthLink to="/admin/login">Click here to Login</AuthLink>

        <AuthButton type="submit" disabled={busy}>
          {busy ? 'RESETTING…' : 'RESET PASSWORD'}
        </AuthButton>
      </form>
    </AdminAuthShell>
  )
}
