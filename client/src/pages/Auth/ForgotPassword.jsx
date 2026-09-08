import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import * as api from '../../services/endpoints.js'
import Seo from '../../components/common/Seo.jsx'

/**
 * Forgot password.
 *
 * The server caps this at 2 emails per address per 24 hours and returns 429 with an
 * explanatory message, which is surfaced as-is rather than retried.
 */
export default function ForgotPassword() {
  const [status, setStatus] = useState(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async ({ email }) => {
    setStatus(null)
    try {
      const data = await api.auth.forgotPassword(email)
      const remaining =
        data?.remaining_attempts !== undefined
          ? ` You have ${data.remaining_attempts} request(s) left today.`
          : ''
      setStatus({
        ok: true,
        message: `A password reset link has been sent to your email.${remaining}`,
      })
    } catch (error) {
      setStatus({ ok: false, message: error.message })
    }
  }

  return (
    <div className="container" style={{ padding: '48px 0', maxWidth: 460 }}>
      <Seo title="Reset your password" noIndex />
      <h1>Reset your password</h1>
      <p style={{ opacity: 0.8 }}>
        Enter your email address and we will send you a link to choose a new password.
      </p>

      {status && (
        <div className={`alert ${status.ok ? 'alert-success' : 'alert-danger'}`} role="alert">
          {status.message}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-group">
          <label htmlFor="fp-email">Email</label>
          <input
            id="fp-email"
            type="email"
            autoComplete="email"
            className="form-control"
            {...register('email', { required: 'Please enter your email address.' })}
          />
          {errors.email && <p style={{ color: '#b00' }}>{errors.email.message}</p>}
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
          style={{ width: '100%' }}
        >
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        <Link to="/login">Back to sign in</Link>
      </p>
    </div>
  )
}
