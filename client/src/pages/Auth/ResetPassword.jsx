import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import * as api from '../../services/endpoints.js'
import Seo from '../../components/common/Seo.jsx'

/**
 * Reset password.
 *
 * The token comes from the URL and the email from the query string, matching the link
 * format Laravel emailed — so reset links already in customers' inboxes keep working
 * across cutover.
 */
export default function ResetPassword() {
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [failure, setFailure] = useState(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { email: searchParams.get('email') ?? '' } })

  const onSubmit = async (values) => {
    setFailure(null)
    try {
      await api.auth.resetPassword({ ...values, token })
      // The server deliberately does not sign the user in, so the new password is proven
      // at the login step.
      navigate('/login', {
        replace: true,
        state: { notice: 'Your password has been reset. Please sign in.' },
      })
    } catch (error) {
      setFailure(error.message)
    }
  }

  return (
    <div className="container" style={{ padding: '48px 0', maxWidth: 460 }}>
      <Seo title="Choose a new password" noIndex />
      <h1>Choose a new password</h1>

      {failure && (
        <div className="alert alert-danger" role="alert">
          {failure}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-group">
          <label htmlFor="rp-email">Email</label>
          <input
            id="rp-email"
            type="email"
            className="form-control"
            {...register('email', { required: 'Please enter your email address.' })}
          />
          {errors.email && <p style={{ color: '#b00' }}>{errors.email.message}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="rp-password">New password</label>
          <input
            id="rp-password"
            type="password"
            autoComplete="new-password"
            className="form-control"
            {...register('password', {
              required: 'Please choose a password.',
              minLength: { value: 6, message: 'Password must be at least 6 characters.' },
            })}
          />
          {errors.password && <p style={{ color: '#b00' }}>{errors.password.message}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="rp-confirm">Confirm new password</label>
          <input
            id="rp-confirm"
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
          {isSubmitting ? 'Saving…' : 'Save new password'}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        <Link to="/login">Back to sign in</Link>
      </p>
    </div>
  )
}
