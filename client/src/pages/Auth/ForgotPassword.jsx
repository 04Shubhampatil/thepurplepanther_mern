import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../../theme/page.js'
import * as api from '../../services/endpoints.js'

/**
 * frontend/pages/forgot-password.blade.php.
 *
 * The "up to 2 times every 24 hours" in the copy is a real server-side throttle, not a
 * reassurance — the endpoint returns an error once it is hit, and that error is shown here
 * rather than being swallowed into the generic success message.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [alert, setAlert] = useState({ message: '', error: false })
  const [submitting, setSubmitting] = useState(false)

  usePageTitle('Forgot password - The Purple Panther')

  async function onSubmit(event) {
    event.preventDefault()
    setAlert({ message: '', error: false })
    setSubmitting(true)

    try {
      const response = await api.auth.forgotPassword(email.trim())
      setAlert({ message: response?.message ?? 'If that email is registered, a reset link is on its way.', error: false })
    } catch (error) {
      setAlert({ message: error.message || 'Could not send a reset link right now.', error: true })
    } finally {
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
                <h2 className="title">Forgot password</h2>
                <p className="sub-title mb-0">
                  Enter your account email and we’ll send a reset link. You can request this up to 2 times every 24 hours.
                </p>
              </div>
              <div className="pp-auth-card">
                <form id="customer-forgot-form" noValidate onSubmit={onSubmit}>
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
                      id="forgot-email"
                      className="form-control shadow-none"
                      placeholder="Email address"
                      autoComplete="email"
                      maxLength="255"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                    <label htmlFor="forgot-email">Email address</label>
                    <div className="field-error text-danger mt-1"></div>
                  </div>
                  <button type="submit" className="su-btn-4 su-btn-16-black w-100 su-left-right" disabled={submitting}>
                    <span className="mr10 su-text d-inline-block">Send reset link</span>
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
