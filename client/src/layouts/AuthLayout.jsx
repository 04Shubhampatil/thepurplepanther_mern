import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import SiteFooter from '../components/layout/SiteFooter.jsx'
import { useConfigStore } from '../store/index.js'
import { useBodyClass } from '../theme/page.js'

/**
 * The stripped shell used by forgot-password and reset-password.
 *
 * These two Blade pages are the only storefront pages WITHOUT the site header: they open
 * with a centred logo inside a bare `#page`, keep the footer, and load almost none of the
 * theme's JavaScript. That is deliberate on a page someone reaches from a reset email —
 * there is nothing to navigate to, and the header's cart and account controls would be
 * noise. Reproducing it means a separate layout rather than StoreLayout with pieces hidden.
 */
export default function AuthLayout() {
  const loadConfig = useConfigStore((s) => s.load)
  const { pathname } = useLocation()

  useBodyClass('pp-auth-page')

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <div className="wrapper ovh">
      <div id="page">
        <div className="text-center py-4">
          <Link to="/">
            <img src="/frontend/images/logo-new.svg" alt="Purple Panther" style={{ maxHeight: '56px' }} />
          </Link>
        </div>

        <Outlet />

        <SiteFooter />
      </div>
    </div>
  )
}
