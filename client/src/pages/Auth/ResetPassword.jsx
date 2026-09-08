import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { usePageTitle } from '../../theme/page.js'
import * as api from '../../services/endpoints.js'

/**
 * frontend/pages/reset-password.blade.php.
 *
 * The token and email arrive in the URL, exactly as Laravel's signed reset link delivered
 * them — the token as the path/query value and the email pre-filled but still editable,
 * because the server checks the pair and a mismatch has to be correctable without asking
 * for a fresh email.
 */
export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const { token: tokenParam } = useParams()
  const navigate = useNavigate()

  // Laravel's link was /reset-password/{token}?email=..., but the token also travelled as a
  // query parameter in older mails. Both are accepted so an unexpired link still works.
  const token = tokenParam ?? searchParams.get('token') ?? ''
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [alert, setAlert] = useState({ message: '', error: false })
  const [submitting, setSubmitting] = useState(false)

  usePageTitle('Create new password - The Purple Panther')

  async function onSubmit(event) {
    event.preventDefault()
    setAlert({ message: '', error: false })

    if (password !== confirmation) {
      setAlert({ message: 'The password confirmation does not match.', error: true })
      return
    }

    setSubmitting(true)
    try {
      await api.auth.resetPassword({
        token,
        email: email.trim(),
        password,
        password_confirmation: confirmation,
      })
      navigate('/login', { replace: true })
    } catch (error) {
      setAlert({ message: error.message || 'That reset link is no longer valid.', error: true })
      setSubmitting(false)
    }
  }

  return (
    <main className="body_content_wrapper">
      <section className="registration-section pt40 pb80">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-5 col-md-7">
              <div className="section-title text-center mb-4">
                <h2 className="title">Create new password</h2>
                <p className="sub-title mb-0">Choose a new password for your account, then sign in.</p>
              </div>
              <div className="pp-auth-card">
                <form id="customer-reset-form" noValidate onSubmit={onSubmit}>
                  <input type="hidden" name="token" value={token} readOnly />
                  <div
                    className={`auth-form-alert alert mb-3${alert.message ? (alert.error ? ' alert-danger' : ' alert-success') : ' d-none'}`}
                    role="alert"
                    hidden={!alert.message}
                  >
                    {alert.message}
                  </div>
                  <div className="form-floating mb-3">
                    <input
                      type="email"
                      name="email"
                      id="reset-email"
                      className="form-control shadow-none"
                      placeholder="Email address"
                      autoComplete="email"
                      maxLength="255"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                    <label htmlFor="reset-email">Email address</label>
                    <div className="field-error text-danger mt-1"></div>
                  </div>
                  <div className="form-floating mb-3">
                    <input
                      type="password"
                      name="password"
                      id="reset-password"
                      className="form-control shadow-none"
                      placeholder="New password"
                      autoComplete="new-password"
                      minLength="6"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <label htmlFor="reset-password">New password</label>
                    <div className="field-error text-danger mt-1"></div>
                  </div>
                  <div className="form-floating mb-3">
                    <input
                      type="password"
                      name="password_confirmation"
                      id="reset-password-confirmation"
                      className="form-control shadow-none"
                      placeholder="Confirm password"
                      autoComplete="new-password"
                      minLength="6"
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                    />
                    <label htmlFor="reset-password-confirmation">Confirm password</label>
                    <div className="field-error text-danger mt-1"></div>
                  </div>
                  <button type="submit" className="su-btn-4 su-btn-16-black w-100 su-left-right" disabled={submitting}>
                    <span className="mr10 su-text d-inline-block">Update password</span>
                  </button>
                  <p className="text-center mt-4 mb-0">
                    <Link to="/login">Back to login</Link>
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
