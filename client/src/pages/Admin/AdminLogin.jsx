import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../../services/endpoints.js'
import { useAuthStore } from '../../store/index.js'
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
 * admin/auth/login.blade.php + the login half of public/js/admin-auth.js.
 *
 * The rules and their wording are that file's, verbatim. Each field carries its OWN message
 * under it — the `.alert` box at the top is only ever the SERVER's (`session('error')` or
 * the validation bag), never a client-side summary.
 *
 * The single field accepts a username OR an email address, reproducing
 * Admin\AuthController::login — existing admins may be using either, which is why the
 * placeholder says "Username" while the endpoint takes both.
 */
const SCHEMA = {
  username: [
    { type: 'required', message: 'Username is required.' },
    { type: 'min', value: 3, message: 'Username must be at least 3 characters.' },
  ],
  password: [
    { type: 'required', message: 'Password is required.' },
    { type: 'min', value: 6, message: 'Password must be at least 6 characters.' },
  ],
}

export default function AdminLogin() {
  // The panel's stylesheet is admin-only and loaded on demand, as in AdminLayout.
  useEffect(() => {
    import('../../admin.css')
  }, [])

  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()

  const [values, setValues] = useState({ username: '', password: '' })
  const [errors, setErrors] = useState({})
  const [failure, setFailure] = useState(null)
  const [busy, setBusy] = useState(false)

  const fields = { username: useRef(null), password: useRef(null) }

  /** Blur AND input both revalidate, so a message clears as soon as the field is fixed. */
  const bind = (name) => ({
    ref: fields[name],
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
    setFailure(null)

    const found = validateAll(values, SCHEMA)
    setErrors(found)

    if (Object.keys(found).length) {
      // `form.querySelector('.is-invalid').focus()` — the first failing field takes focus.
      const first = Object.keys(SCHEMA).find((name) => found[name])
      fields[first]?.current?.focus()
      return
    }

    setBusy(true)
    try {
      const { user } = await api.adminAuth.login({
        username: values.username.trim(),
        password: values.password,
      })
      setUser(user)
      navigate('/admin/dashboard', { replace: true })
    } catch (error) {
      setFailure(error.message)
      setBusy(false)
    }
  }

  return (
    <AdminAuthShell>
      <Seo title="Login" noIndex />

      <AuthAlert>{failure}</AuthAlert>

      <form onSubmit={onSubmit} noValidate className="w-full">
        <AuthField
          icon={ICONS.user}
          type="text"
          name="username"
          placeholder="Username"
          autoComplete="username"
          autoFocus
          {...bind('username')}
        />

        <AuthField
          icon={ICONS.key}
          type="password"
          name="password"
          placeholder="Password"
          autoComplete="current-password"
          {...bind('password')}
        />

        <AuthLink to="/admin/forgot-password">Forgot Password?</AuthLink>

        <AuthButton type="submit" disabled={busy}>
          {busy ? 'SIGNING IN…' : 'LOGIN'}
        </AuthButton>
      </form>
    </AdminAuthShell>
  )
}
