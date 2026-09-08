import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/index.js'
import { usePageTitle } from '../../theme/page.js'

/**
 * frontend/pages/signup.blade.php.
 *
 * Note the asymmetry the original had and this keeps: first name is `required`, last name
 * is not. The server's validator is the authority either way; this only mirrors what the
 * form asked for.
 */
export default function Signup() {
  const navigate = useNavigate()
  const register = useAuthStore((s) => s.register)

  const [values, setValues] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    password_confirmation: '',
  })
  const [alert, setAlert] = useState('')
  const [submitting, setSubmitting] = useState(false)

  usePageTitle('Create Account - The Purple Panther')

  const bind = (name) => ({
    value: values[name],
    onChange: (event) => setValues((current) => ({ ...current, [name]: event.target.value })),
  })

  async function onSubmit(event) {
    event.preventDefault()
    setAlert('')

    if (values.password !== values.password_confirmation) {
      setAlert('The password confirmation does not match.')
      return
    }

    setSubmitting(true)
    try {
      await register({
        ...values,
        name: `${values.first_name} ${values.last_name}`.trim(),
      })
      navigate('/account/overview', { replace: true })
    } catch (error) {
      setAlert(error.message || 'We could not create your account.')
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
                <h2 className="title wow fadeInUp" data-wow-delay=".2s">CREATE ACCOUNT</h2>
                <p className="sub-title wow fadeInUp" data-wow-delay=".4s">
                  Enter your information below to proceed. If you already have an account, <br /> please log in instead.
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
                      <form id="customer-register-form" noValidate onSubmit={onSubmit}>
                        <div
                          className={`auth-form-alert alert alert-danger mb-3${alert ? '' : ' d-none'}`}
                          role="alert"
                          hidden={!alert}
                        >
                          {alert}
                        </div>
                        <div className="row g-4">
                          <div className="col-lg-6">
                            <div className="form-floating">
                              <input type="text" name="first_name" id="register-first-name" className="form-control shadow-none" placeholder="First Name *" required autoComplete="given-name" {...bind('first_name')} />
                              <label htmlFor="register-first-name">First Name *</label>
                              <div className="field-error text-danger mt-1"></div>
                            </div>
                          </div>
                          <div className="col-lg-6">
                            <div className="form-floating">
                              <input type="text" name="last_name" id="register-last-name" className="form-control shadow-none" placeholder="Last Name *" autoComplete="family-name" {...bind('last_name')} />
                              <label htmlFor="register-last-name">Last Name *</label>
                              <div className="field-error text-danger mt-1"></div>
                            </div>
                          </div>
                          <div className="col-lg-12">
                            <div className="form-floating">
                              <input type="email" name="email" id="register-email" className="form-control shadow-none" placeholder="Email *" required autoComplete="email" {...bind('email')} />
                              <label htmlFor="register-email">Email *</label>
                              <div className="field-error text-danger mt-1"></div>
                            </div>
                          </div>
                          <div className="col-lg-12">
                            <div className="form-floating">
                              <input type="password" name="password" id="register-password" className="form-control shadow-none" placeholder="Password *" required minLength="6" autoComplete="new-password" {...bind('password')} />
                              <label htmlFor="register-password">Password *</label>
                              <div className="field-error text-danger mt-1"></div>
                            </div>
                          </div>
                          <div className="col-lg-12">
                            <div className="form-floating">
                              <input type="password" name="password_confirmation" id="register-password-confirmation" className="form-control shadow-none" placeholder="Confirm Password *" required minLength="6" autoComplete="new-password" {...bind('password_confirmation')} />
                              <label htmlFor="register-password-confirmation">Confirm Password *</label>
                              <div className="field-error text-danger mt-1"></div>
                            </div>
                          </div>
                          <div className="col-lg-12">
                            <button type="submit" className="su-btn-4 su-btn-16-black w-100 su-left-right" disabled={submitting}>
                              <span className="mr10 su-text d-inline-block">CREATE ACCOUNT</span>
                              <span className="su-arrow-angle">
                                <svg className="su-arrow-svg-top-right" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10.00 10.00">
                                  <path d="M1.018 10.009 0 8.991l7.569-7.582H1.723L1.737 0h8.26v8.274H8.574l.013-5.847Z"></path>
                                  <path d="M1.018 10.009 0 8.991l7.569-7.582H1.723L1.737 0h8.26v8.274H8.574l.013-5.847Z"></path>
                                </svg>
                              </span>
                            </button>
                            <p className="text-center mt20 mb-0">
                              Already have an account? <Link to="/login">LOGIN</Link>
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
