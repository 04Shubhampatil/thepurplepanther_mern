import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import SiteHeader from '../components/layout/SiteHeader.jsx'
import SiteFooter from '../components/layout/SiteFooter.jsx'
import MinicartDrawer from '../components/cart/MinicartDrawer.jsx'
import { bootTheme, initPagePlugins, applyDataBackgrounds } from '../theme/runtime.js'
import { syncSiteConfig } from '../theme/site.js'
import { useConfigStore, useCartStore, useAuthStore, useOffersStore } from '../store/index.js'

/**
 * Storefront shell — the Blade layout every frontend page shared.
 *
 * The DOM here reproduces what Blade emitted around `@yield`: `.wrapper.ovh` holding the
 * preloader, the header, the sign-in side panel, then `.body_content_wrapper` with the
 * page, the footer and the scroll-to-top link. The theme's CSS and script.js both select
 * on that structure, so it is layout, not decoration.
 *
 * BOOT ORDER IS LOAD-BEARING. script.js runs once, and when it runs it takes over `#menu`
 * and reads window.PP_SITE for the logo and account link it builds into the mmenu navbar.
 * So: categories and session first, then PP_SITE, then the theme. Booting earlier gives a
 * mobile menu with a missing accessories link and a permanent "Account" label for someone
 * who is signed in — and mmenu refuses to re-initialise, so it never corrects itself.
 */
export default function StoreLayout() {
  const loadConfig = useConfigStore((s) => s.load)
  const loadOffers = useOffersStore((s) => s.load)
  const categoriesLoaded = useConfigStore((s) => s.loaded)
  const categories = useConfigStore((s) => s.categories)
  const refreshCart = useCartStore((s) => s.refresh)
  const user = useAuthStore((s) => s.user)
  const authLoading = useAuthStore((s) => s.loading)
  const { pathname } = useLocation()

  const [themeReady, setThemeReady] = useState(false)

  useEffect(() => {
    loadConfig()
    loadOffers()
    refreshCart()
  }, [loadConfig, loadOffers, refreshCart])

  useEffect(() => {
    syncSiteConfig({ user, categories })
  }, [user, categories])

  useEffect(() => {
    if (!categoriesLoaded || authLoading) return
    bootTheme().then(() => setThemeReady(true))
  }, [categoriesLoaded, authLoading])

  // Per-route work script.js only ever did once per document.
  useEffect(() => {
    if (!themeReady) return
    applyDataBackgrounds()
    initPagePlugins()
  }, [themeReady, pathname])

  // A full page load always started at the top; client-side navigation must match.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <div className="wrapper ovh">
      <div className="preloader"></div>

      <SiteHeader />

      <div className="body_content_wrapper position-relative">
        <Outlet />

        <SiteFooter />
        <a className="scrollToHome" href="#"><i className="fas fa-angle-up"></i></a>
      </div>

      <MinicartDrawer />
    </div>
  )
}
