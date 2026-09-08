import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/index.js'
import { usePageTitle } from '../../theme/page.js'

/**
 * frontend/pages/login.blade.php, with customer-auth.js's submit handling.
 *
 * The `?account=required` query is set by the wishlist button when a guest tries to save
 * something, and `pp_account_return` is where they were heading. Honouring both is what
 * makes "save this, sign in, land back on your wishlist" work rather than dumping someone
 * on the homepage having forgotten why they signed in.
 */
export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((s) => s.login)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [alert, setAlert] = useState('')
  const [submitting, setSubmitting] = useState(false)

  usePageTitle('Login - The Purple Panther')

  const accountRequired = new URLSearchParams(location.search).get('account') === 'required'

  async function onSubmit(event) {
    event.preventDefault()
    setAlert('')
    setSubmitting(true)

    try {
      await login({ email: email.trim(), password, remember })

      let destination = location.state?.from ?? '/account/overview'
      try {
        const stored = sessionStorage.getItem('pp_account_return')
        if (stored) {
          destination = stored
          sessionStorage.removeItem('pp_account_return')
        }
      } catch {
        // Blocked storage only costs the redirect target.
      }

      navigate(destination, { replace: true })
    } catch (error) {
      setAlert(error.message || 'These credentials do not match our records.')
      setSubmitting(false)
    }
  }

  return (
    <main className="body_content_wrapper position-relative">
      <section className="registration-section pt120 pb80">
        <div className="container">
          <div className="row pb15">
            <div className="col-lg-6 mx-auto">
              <div className="section-title text-center">
                <h2 className="title wow fadeInUp" data-wow-delay=".2s">LOGIN</h2>
                <p className="sub-title wow fadeInUp" data-wow-delay=".4s">
                  Log in and enjoy a personalised experience. If you don’t have an account, <br /> please create one instead.
                </p>
              </div>
            </div>
          </div>
          <div className="blog-single-area">
            <div className="row justify-content-center">
              <div className="col-lg-6">
                <div className="blog-post-content wow fadeInUp" data-wow-delay=".6s">
                  <div className="content-box">
                    <div className="review-box">
                      <form id="customer-login-form" noValidate onSubmit={onSubmit}>
                        <div
                          className={`auth-form-alert alert alert-danger mb-3${alert ? '' : ' d-none'}`}
                          role="alert"
                          hidden={!alert}
                        >
                          {alert}
                        </div>
                        {accountRequired && (
                          <div className="alert alert-success mb-3">Please sign in to continue.</div>
                        )}
                        <div className="row g-4">
                          <div className="col-lg-12">
                            <div className="form-floating">
                              <input
                                type="email"
                                name="email"
                                id="login-email"
                                className="form-control shadow-none"
                                placeholder="Email *"
                                required
                                autoComplete="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                              />
                              <label htmlFor="login-email">Email *</label>
                              <div className="field-error text-danger mt-1"></div>
                            </div>
                          </div>
                          <div className="col-lg-12">
                            <div className="form-floating">
                              <input
                                type="password"
                                name="password"
                                id="login-password"
                                className="form-control shadow-none"
                                placeholder="Password *"
                                required
                                minLength="6"
                                autoComplete="current-password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                              />
                              <label htmlFor="login-password">Password *</label>
                              <div className="field-error text-danger mt-1"></div>
                            </div>
                          </div>
                          <div className="col-lg-12">
                            <div className="form-check mb-2">
                              <input
                                className="form-check-input shadow-none"
                                type="checkbox"
                                name="remember"
                                value="1"
                                id="login-remember"
                                checked={remember}
                                onChange={(event) => setRemember(event.target.checked)}
                              />
                              <label className="form-check-label" htmlFor="login-remember">Remember me</label>
                            </div>
                            <p className="mb-3"><Link to="/forgot-password">Forgot password?</Link></p>
                            <button type="submit" className="su-btn-4 su-btn-16-black w-100 su-left-right" disabled={submitting}>
                              <span className="mr10 su-text d-inline-block">LOGIN</span>
                              <span className="su-arrow-angle">
                                <svg className="su-arrow-svg-top-right" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10.00 10.00">
                                  <path d="M1.018 10.009 0 8.991l7.569-7.582H1.723L1.737 0h8.26v8.274H8.574l.013-5.847Z"></path>
                                  <path d="M1.018 10.009 0 8.991l7.569-7.582H1.723L1.737 0h8.26v8.274H8.574l.013-5.847Z"></path>
                                </svg>
                              </span>
                            </button>
                            <p className="text-center mt20 mb-0">
                              Don't have an account? <Link to="/signup">CREATE ACCOUNT</Link>
                            </p>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
