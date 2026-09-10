import { useEffect, useState } from 'react'
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
} from '../../components/admin/AdminAuthShell.jsx'

/**
 * admin/auth/login.blade.php.
 *
 * The single field accepts a username OR an email address, reproducing
 * Admin\AuthController::login — existing admins may be using either, which is why the
 * placeholder says "Username" while the endpoint takes both.
 */
export default function AdminLogin() {
  // The panel's stylesheet is admin-only and loaded on demand, as in AdminLayout.
  useEffect(() => {
    import('../../admin.css')
  }, [])

  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [failure, setFailure] = useState(null)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()
    setFailure(null)

    const next = {}
    if (!username.trim()) next.username = true
    if (!password) next.password = true
    setErrors(next)

    if (Object.keys(next).length) {
      setFailure('Please enter your username and password.')
      return
    }

    setBusy(true)
    try {
      const { user } = await api.adminAuth.login({ username: username.trim(), password })
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
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Username"
          autoComplete="username"
          autoFocus
          invalid={errors.username}
        />

        <AuthField
          icon={ICONS.key}
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          invalid={errors.password}
        />

        <AuthLink to="/admin/forgot-password">Forgot Password?</AuthLink>

        <AuthButton type="submit" disabled={busy}>
          {busy ? 'SIGNING IN…' : 'LOGIN'}
        </AuthButton>
      </form>
    </AdminAuthShell>
  )
}
