import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/index.js'
import Seo from '../../components/common/Seo.jsx'

export default function Signup() {
  const registerUser = useAuthStore((s) => s.register)
  const navigate = useNavigate()
  const [failure, setFailure] = useState(null)

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async (values) => {
    setFailure(null)
    try {
      await registerUser(values)
      navigate('/account/overview', { replace: true })
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
      <Seo title="Create an account" noIndex />
      <h1>Create an account</h1>

      {failure && (
        <div className="alert alert-danger" role="alert">
          {failure}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-group">
          <label htmlFor="su-name">Full name</label>
          <input
            id="su-name"
            autoComplete="name"
            className="form-control"
            aria-invalid={Boolean(errors.name)}
            {...register('name', { required: 'Please enter your name.' })}
          />
          {errors.name && <p style={{ color: '#b00' }}>{errors.name.message}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="su-email">Email</label>
          <input
            id="su-email"
            type="email"
            autoComplete="email"
            className="form-control"
            aria-invalid={Boolean(errors.email)}
            {...register('email', { required: 'Please enter your email address.' })}
          />
          {errors.email && <p style={{ color: '#b00' }}>{errors.email.message}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="su-password">Password</label>
          <input
            id="su-password"
            type="password"
            autoComplete="new-password"
            className="form-control"
            aria-invalid={Boolean(errors.password)}
            {...register('password', {
              required: 'Please choose a password.',
              minLength: { value: 6, message: 'Password must be at least 6 characters.' },
            })}
          />
          {errors.password && <p style={{ color: '#b00' }}>{errors.password.message}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="su-confirm">Confirm password</label>
          <input
            id="su-confirm"
            type="password"
            autoComplete="new-password"
            className="form-control"
            {...register('password_confirmation', {
              validate: (value) => value === watch('password') || 'Passwords do not match.',
            })}
          />
          {errors.password_confirmation && (
            <p style={{ color: '#b00' }}>{errors.password_confirmation.message}</p>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
          style={{ width: '100%' }}
        >
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  )
}
