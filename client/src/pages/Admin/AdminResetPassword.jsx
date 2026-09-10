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
  validateField,
  validateAll,
} from '../../components/admin/AdminAuthShell.jsx'

/**
 * admin-auth.js's reset rules. Note the password minimum is EIGHT here, not the six the
 * login form enforces — a password being set deserves a stricter floor than one being typed
 * back, and that is the source's own choice.
 */
const SCHEMA = {
  email: [
    { type: 'required', message: 'Email is required.' },
    { type: 'email', message: 'Please enter a valid email address.' },
  ],
  password: [
    { type: 'required', message: 'Password is required.' },
    { type: 'min', value: 8, message: 'Password must be at least 8 characters.' },
  ],
  password_confirmation: [
    { type: 'required', message: 'Please confirm your password.' },
    { type: 'match', field: 'password', message: 'Passwords do not match.' },
  ],
}

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

  const [values, setValues] = useState({
    email: params.get('email') ?? '',
    password: '',
    password_confirmation: '',
  })
  const [errors, setErrors] = useState({})
  const [alert, setAlert] = useState(null)
  const [busy, setBusy] = useState(false)

  const bind = (name) => ({
    value: values[name],
    error: errors[name],
    onChange: (event) => {
      const next = { ...values, [name]: event.target.value }
      setValues(next)
      setErrors((prev) => ({ ...prev, [name]: validateField(next[name], SCHEMA[name], next) }))
    },
    onBlur: () =>
      setErrors((prev) => ({ ...prev, [name]: validateField(values[name], SCHEMA[name], values) })),
  })

  async function onSubmit(event) {
    event.preventDefault()
    setAlert(null)

    const found = validateAll(values, SCHEMA)
    setErrors(found)
    if (Object.keys(found).length) return

    setBusy(true)
    try {
      await api.auth.resetPassword({
        token,
        email: values.email.trim(),
        password: values.password,
        password_confirmation: values.password_confirmation,
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
          placeholder="Email"
          autoComplete="email"
          {...bind('email')}
        />

        <AuthField
          icon={ICONS.key}
          type="password"
          name="password"
          placeholder="New Password"
          autoComplete="new-password"
          {...bind('password')}
        />

        <AuthField
          icon={ICONS.key}
          type="password"
          name="password_confirmation"
          placeholder="Confirm Password"
          autoComplete="new-password"
          {...bind('password_confirmation')}
        />

        <AuthLink to="/admin/login">Click here to Login</AuthLink>

        <AuthButton type="submit" disabled={busy}>
          {busy ? 'RESETTING…' : 'RESET PASSWORD'}
        </AuthButton>
      </form>
    </AdminAuthShell>
  )
}
