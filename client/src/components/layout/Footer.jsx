import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Check, AlertCircle } from 'lucide-react'
import SocialIcon from '../ui/SocialIcon.jsx'
import Container from '../ui/Container.jsx'
import * as api from '../../services/endpoints.js'

/**
 * Footer.
 *
 * Column structure and link set match the live site, which uses a warm sand background
 * (#F6F4F1) rather than the dark footer common to the underlying theme.
 */
const SHOP = [
  ['/shop', 'All'],
  ['/collection', 'Collection'],
  ['/accessories', 'Accessories'],
  ['/blog', 'Journal'],
]

const COMPANY = [
  ['/', 'Home'],
  ['/about', 'Our Story'],
  ['/beyond-ordinary', 'Beyond Ordinary'],
  ['/support/faqs', 'Contact'],
]

const POLICIES = [
  ['/support/returns', 'Refund Policy'],
  ['/support/privacy', 'Privacy Policy'],
  ['/support/shipping', 'Shipping Policy'],
  ['/support/terms', 'Terms of Service'],
]

function LinkColumn({ heading, links }) {
  return (
    <nav aria-label={heading}>
      <h2 className="pp-eyebrow mb-4 text-ink">{heading}</h2>
      <ul className="space-y-2.5">
        {links.map(([to, label]) => (
          <li key={to + label}>
            <Link
              to={to}
              className="text-[14px] text-body transition-colors duration-200 hover:text-brand"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

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
      // The server distinguishes "already subscribed" from an invalid address.
      setStatus({ ok: false, message: error.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <footer className="mt-16 bg-sand md:mt-[90px]">
      <Container>
        <div className="grid gap-10 py-14 md:grid-cols-2 md:py-16 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <p className="font-alt text-[16px] font-bold uppercase tracking-[0.22em] text-brand">
              Purple Panther
            </p>
            <p className="mt-4 max-w-sm text-body">
              Quiet authority for women who move seamlessly from boardroom to dinner.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="The Purple Panther on Instagram"
                className="grid size-10 place-items-center border border-line text-ink transition-colors hover:border-brand hover:text-brand"
              >
                <SocialIcon name="instagram" />
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="The Purple Panther on Facebook"
                className="grid size-10 place-items-center border border-line text-ink transition-colors hover:border-brand hover:text-brand"
              >
                <SocialIcon name="facebook" />
              </a>
              <a
                href="mailto:Info@thepurplepanther.in"
                aria-label="Email The Purple Panther"
                className="grid size-10 place-items-center border border-line text-ink transition-colors hover:border-brand hover:text-brand"
              >
                <Mail size={18} strokeWidth={1.5} aria-hidden="true" />
              </a>
            </div>
          </div>

          <LinkColumn heading="Shop" links={SHOP} />
          <LinkColumn heading="Company" links={COMPANY} />
          <LinkColumn heading="Policies" links={POLICIES} />
        </div>

        <div className="border-t border-line py-10">
          <div className="grid gap-6 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="pp-eyebrow mb-2 text-ink">Newsletter</h2>
              <p className="text-body">
                New arrivals, private sales and the occasional note from the studio.
              </p>
            </div>

            <form onSubmit={subscribe} noValidate>
              <label htmlFor="footer-newsletter" className="sr-only">
                Email address
              </label>

              <div className="flex">
                <input
                  id="footer-newsletter"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  aria-describedby={status ? 'newsletter-status' : undefined}
                  className="min-w-0 flex-1 border border-line bg-white px-4 py-3.5 text-[14px] text-ink placeholder:text-body/60 focus:border-brand focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="shrink-0 bg-brand px-6 py-3.5 text-[13px] font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-brand-soft disabled:opacity-60"
                >
                  {busy ? 'Sending…' : 'Subscribe'}
                </button>
              </div>

              {status && (
                <p
                  id="newsletter-status"
                  role="status"
                  className={`mt-2 flex items-center gap-1.5 text-[13px] ${
                    status.ok ? 'text-brand' : 'text-red-700'
                  }`}
                >
                  {status.ok ? (
                    <Check size={14} strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <AlertCircle size={14} strokeWidth={2} aria-hidden="true" />
                  )}
                  {status.message}
                </p>
              )}
            </form>
          </div>
        </div>

        <p className="border-t border-line py-6 text-center text-[13px] text-body">
          © {new Date().getFullYear()} The Purple Panther. All rights reserved.
        </p>
      </Container>
    </footer>
  )
}
