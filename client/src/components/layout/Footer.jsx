import { useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../../services/endpoints.js'

const SUPPORT_LINKS = [
  ['shipping', 'Shipping'],
  ['returns', 'Returns & Exchanges'],
  ['size-guide', 'Size Guide'],
  ['faqs', 'FAQs'],
  ['terms', 'Terms & Conditions'],
  ['privacy', 'Privacy & Cookies'],
]

export default function Footer() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  const subscribe = async (event) => {
    event.preventDefault()
    setBusy(true)
    setStatus(null)

    try {
      await api.misc.subscribe(email)
      setStatus({ ok: true, message: 'Thanks for subscribing!' })
      setEmail('')
    } catch (error) {
      // The server distinguishes "already subscribed" from a bad address; show its message.
      setStatus({ ok: false, message: error.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <footer className="pp-footer">
      <div className="container">
        <div className="row">
          <div className="col-md-4">
            <h4>The Purple Panther</h4>
            <p>Beyond ordinary.</p>
          </div>

          <div className="col-md-4">
            <h5>Customer care</h5>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {SUPPORT_LINKS.map(([slug, label]) => (
                <li key={slug}>
                  <Link to={`/support/${slug}`}>{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-md-4">
            <h5>Newsletter</h5>
            <form onSubmit={subscribe} noValidate>
              <label htmlFor="footer-newsletter" className="sr-only">
                Email address
              </label>
              <input
                id="footer-newsletter"
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                required
              />
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Subscribing…' : 'Subscribe'}
              </button>
            </form>

            {status && (
              <p role="status" style={{ marginTop: 8, color: status.ok ? 'inherit' : '#b00' }}>
                {status.message}
              </p>
            )}
          </div>
        </div>

        <p className="pp-footer__copy" style={{ marginTop: 32, opacity: 0.7 }}>
          © {new Date().getFullYear()} The Purple Panther. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
