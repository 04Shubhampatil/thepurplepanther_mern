import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/index.js'
import Seo from '../../components/common/Seo.jsx'

export default function Login() {
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const location = useLocation()
  const [failure, setFailure] = useState(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async (values) => {
    setFailure(null)
    try {
      await login(values)
      // Return the customer to wherever they were headed before the guard intervened.
      navigate(location.state?.from ?? '/account/overview', { replace: true })
    } catch (error) {
      if (error.errors) {
        Object.entries(error.errors).forEach(([field, messages]) =>
          setError(field, { type: 'server', message: messages[0] }),
        )
      }
      setFailure(error.message)
    }
  }

  return (
    <div className="container" style={{ padding: '48px 0', maxWidth: 460 }}>
      <Seo title="Sign in" noIndex />
      <h1>Sign in</h1>

      {failure && (
        <div className="alert alert-danger" role="alert">
          {failure}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-group">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            className="form-control"
            aria-invalid={Boolean(errors.email)}
            {...register('email', { required: 'Please enter your email address.' })}
          />
          {errors.email && <p style={{ color: '#b00' }}>{errors.email.message}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            className="form-control"
            aria-invalid={Boolean(errors.password)}
            {...register('password', { required: 'Please enter your password.' })}
          />
          {errors.password && <p style={{ color: '#b00' }}>{errors.password.message}</p>}
        </div>

        <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ width: '100%' }}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        <Link to="/forgot-password">Forgotten your password?</Link>
      </p>
      <p>
        New here? <Link to="/signup">Create an account</Link>
      </p>
    </div>
  )
}
