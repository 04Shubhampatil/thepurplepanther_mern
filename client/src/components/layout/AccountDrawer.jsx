import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/index.js'
import { useUiStore } from '../../store/ui.js'
import { useScrollLock } from '../../theme/chrome.js'
import * as api from '../../services/endpoints.js'

/**
 * The "My account" slide-over — the account half of site-drawers.js.
 *
 * This is the one piece of that file that never got ported: the cart and search behaviour
 * was rebuilt in React, but the account panel was left behind and the header icon just
 * linked to /login instead. The markup here is `drawerMarkup()` + `loginForm()` +
 * `registerForm()` from that file, so site-drawers.css styles it with no new CSS —
 * `.site-drawer`, `.site-account-tabs`, `.site-account-form.is-active`, `.site-password`
 * and the rest are all already defined.
 *
 * Its sibling in the original — a Wishlist drawer — is deliberately NOT ported. That one
 * renders two hard-coded "CROPPED VARSITY" products at ₹3,198 with a fake quantity stepper;
 * it is a design placeholder, not a feature, and the real wishlist lives in the account
 * area.
 *
 * Validation messages are copied exactly. They are what a customer reads, and "Password
 * must be at least 6 characters." landing differently from the standalone /login page would
 * be a visible inconsistency.
 */
const CLOSE_ICON = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const isValidEmail = (value) => EMAIL_RE.test(String(value ?? '').trim())

function PasswordField({ label, name, value, onChange, autoComplete, error }) {
  const [visible, setVisible] = useState(false)

  return (
    <label>
      {label}
      <span className="site-password">
        <input
          type={visible ? 'text' : 'password'}
          name={name}
          required
          minLength="6"
          autoComplete={autoComplete}
          placeholder={label}
          value={value}
          onChange={onChange}
          className={error ? 'is-invalid' : undefined}
        />
        <button type="button" className="site-show-password" onClick={() => setVisible((v) => !v)}>
          {visible ? 'Hide' : 'Show'}
        </button>
      </span>
      <span className="site-field-error" data-error-for={name}>{error ?? ''}</span>
    </label>
  )
}

export default function AccountDrawer() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)
  const { accountOpen, accountReturn, closeAccount } = useUiStore()

  const [tab, setTab] = useState('login')
  const [values, setValues] = useState({ name: '', email: '', password: '', password_confirmation: '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState({ text: '', error: false })
  const [submitting, setSubmitting] = useState(false)
  const firstFieldRef = useRef(null)

  useScrollLock(accountOpen)

  // site-drawers.js focused the drawer's first control 120ms after opening, once the
  // transition had started — focusing into a panel that is still off-screen scrolls the
  // page to it.
  useEffect(() => {
    if (!accountOpen) return undefined

    const timer = setTimeout(() => firstFieldRef.current?.focus(), 120)
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeAccount()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [accountOpen, closeAccount])

  // A fresh open starts clean rather than showing the last attempt's errors.
  useEffect(() => {
    if (accountOpen) return
    setErrors({})
    setMessage({ text: '', error: false })
    setValues((current) => ({ ...current, password: '', password_confirmation: '' }))
  }, [accountOpen])

  useEffect(() => {
    document.body.classList.toggle('site-drawer-open', accountOpen)
    return () => document.body.classList.remove('site-drawer-open')
  }, [accountOpen])

  const bind = (name) => ({
    value: values[name],
    onChange: (event) => setValues((current) => ({ ...current, [name]: event.target.value })),
  })

  function switchTab(next) {
    setTab(next)
    setErrors({})
    setMessage({ text: '', error: false })
  }

  /** validateLogin() — same checks, same order, same wording. */
  function validateLogin() {
    const next = {}
    const email = values.email.trim()

    if (!email) next.email = 'Email is required.'
    else if (!isValidEmail(email)) next.email = 'Please enter a valid email.'

    if (!values.password) next.password = 'Password is required.'
    else if (values.password.length < 6) next.password = 'Password must be at least 6 characters.'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  /** validateRegister() — likewise. */
  function validateRegister() {
    const next = {}
    const email = values.email.trim()

    if (!values.name.trim()) next.name = 'Full name is required.'

    if (!email) next.email = 'Email is required.'
    else if (!isValidEmail(email)) next.email = 'Please enter a valid email.'

    if (!values.password) next.password = 'Password is required.'
    else if (values.password.length < 6) next.password = 'Password must be at least 6 characters.'

    if (!values.password_confirmation) next.password_confirmation = 'Please confirm your password.'
    else if (values.password !== values.password_confirmation) {
      next.password_confirmation = 'Passwords do not match.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  /**
   * checkDuplicateEmail() — the register tab warned about an existing address on blur,
   * before the customer filled in the rest of the form and hit a rejection.
   */
  async function onRegisterEmailBlur() {
    const email = values.email.trim()
    if (!email || !isValidEmail(email)) return

    try {
      const result = await api.auth.checkEmail(email)
      if (result?.available === false) {
        setErrors((current) => ({ ...current, email: result.message ?? 'This email is already registered.' }))
      }
    } catch {
      // A failed availability check must not block signing up; the server checks again.
    }
  }

  function afterAuth(defaultPath = '/account/overview') {
    let destination = accountReturn ?? defaultPath
    try {
      const stored = sessionStorage.getItem('pp_account_return')
      if (stored) {
        destination = stored
        sessionStorage.removeItem('pp_account_return')
      }
    } catch {
      // Blocked storage costs the redirect target, nothing else.
    }

    closeAccount()
    navigate(destination)
  }

  async function onSubmit(event) {
    event.preventDefault()
    setMessage({ text: '', error: false })

    const valid = tab === 'login' ? validateLogin() : validateRegister()
    if (!valid) return

    setSubmitting(true)
    try {
      if (tab === 'login') {
        await login({ email: values.email.trim(), password: values.password })
      } else {
        await register({
          name: values.name.trim(),
          first_name: values.name.trim().split(/\s+/)[0],
          last_name: values.name.trim().split(/\s+/).slice(1).join(' '),
          email: values.email.trim(),
          password: values.password,
          password_confirmation: values.password_confirmation,
        })
      }
      setMessage({ text: 'Success.', error: false })
      afterAuth()
    } catch (error) {
      // Field-level errors from the server land on their fields; anything else is a
      // one-line message under the form, as applyServerErrors/setMessage did.
      if (error.errors) {
        setErrors(
          Object.fromEntries(
            Object.entries(error.errors).map(([key, msgs]) => [key, Array.isArray(msgs) ? msgs[0] : String(msgs)]),
          ),
        )
      }
      setMessage({ text: error.message || 'Something went wrong.', error: true })
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <>
      <div
        className={`site-drawer-overlay${accountOpen ? ' is-open' : ''}`}
        aria-hidden="true"
        onClick={closeAccount}
      ></div>

      <aside
        id="siteAccountDrawer"
        className={`site-drawer site-account${accountOpen ? ' is-open' : ''}`}
        aria-hidden={accountOpen ? 'false' : 'true'}
        aria-labelledby="accountTitle"
      >
        <div className="site-drawer-head">
          <h2 id="accountTitle">My account</h2>
          <button className="site-drawer-close" type="button" aria-label="Close account panel" onClick={closeAccount}>
            {CLOSE_ICON}
          </button>
        </div>

        <div className="site-account-inner">
          <div className="site-account-tabs" role="tablist">
            <button
              className={tab === 'login' ? 'is-active' : undefined}
              data-account-tab="login"
              type="button"
              onClick={() => switchTab('login')}
            >
              Login
            </button>
            <button
              className={tab === 'register' ? 'is-active' : undefined}
              data-account-tab="register"
              type="button"
              onClick={() => switchTab('register')}
            >
              Register
            </button>
          </div>

          <form
            className={`site-account-form${tab === 'login' ? ' is-active' : ''}`}
            data-account-panel="login"
            noValidate
            onSubmit={onSubmit}
          >
            <label>
              Email address
              <input
                ref={tab === 'login' ? firstFieldRef : null}
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="Email address"
                className={errors.email ? 'is-invalid' : undefined}
                {...bind('email')}
              />
              <span className="site-field-error" data-error-for="email">{errors.email ?? ''}</span>
            </label>

            <PasswordField
              label="Password"
              name="password"
              autoComplete="current-password"
              error={errors.password}
              {...bind('password')}
            />

            <Link className="site-forgot" to="/forgot-password" onClick={closeAccount}>Forgot password?</Link>

            <button className="site-btn" type="submit" disabled={submitting}>Sign in</button>
          </form>

          <form
            className={`site-account-form${tab === 'register' ? ' is-active' : ''}`}
            data-account-panel="register"
            noValidate
            onSubmit={onSubmit}
          >
            <label>
              Full name
              <input
                ref={tab === 'register' ? firstFieldRef : null}
                type="text"
                name="name"
                required
                autoComplete="name"
                placeholder="Full name"
                className={errors.name ? 'is-invalid' : undefined}
                {...bind('name')}
              />
              <span className="site-field-error" data-error-for="name">{errors.name ?? ''}</span>
            </label>

            <label>
              Email address
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="Email address"
                className={errors.email ? 'is-invalid' : undefined}
                onBlur={onRegisterEmailBlur}
                {...bind('email')}
              />
              <span className="site-field-error" data-error-for="email">{errors.email ?? ''}</span>
            </label>

            <PasswordField
              label="Password"
              name="password"
              autoComplete="new-password"
              error={errors.password}
              {...bind('password')}
            />

            <PasswordField
              label="Confirm password"
              name="password_confirmation"
              autoComplete="new-password"
              error={errors.password_confirmation}
              {...bind('password_confirmation')}
            />

            <button className="site-btn" type="submit" disabled={submitting}>Create account</button>
          </form>

          <p className={`site-form-message${message.error ? ' is-error' : ''}`} aria-live="polite">
            {message.text}
          </p>
        </div>
      </aside>
    </>,
    document.body,
  )
}
