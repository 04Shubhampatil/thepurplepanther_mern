import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import SiteHeader from '../components/layout/SiteHeader.jsx'
import SiteFooter from '../components/layout/SiteFooter.jsx'
import MinicartDrawer from '../components/cart/MinicartDrawer.jsx'
import AccountDrawer from '../components/layout/AccountDrawer.jsx'
import WhatsAppButton from '../components/layout/WhatsAppButton.jsx'
import { useReveal } from '../theme/reveal.js'
import { useConfigStore, useCartStore, useOffersStore } from '../store/index.js'
import { useUiStore } from '../store/ui.js'
import '../theme/reveal.css'

/**
 * Storefront shell — the Blade layout every frontend page shared.
 *
 * `.wrapper.ovh` holding the preloader, the header, the page and the footer. The theme's
 * CSS is written against that structure, so it is layout rather than decoration.
 *
 * There is no theme bootstrap here any more. Blade loaded thirteen vendor scripts and a
 * 3,479-line script.js; everything that was still doing something on these pages is now
 * React — the sliders (swiper/react), the mobile menu, the search overlay, the footer
 * accordion, the sticky header, and the reveal-on-scroll that WOW.js was loaded for but
 * never initialised.
 *
 * The theme's yellow `.scrollToHome` scroll-to-top link is gone at the client's request;
 * its fixed bottom-right slot is now the WhatsApp button (components/layout/WhatsAppButton).
 */
export default function StoreLayout() {
  const loadConfig = useConfigStore((s) => s.load)
  const loadOffers = useOffersStore((s) => s.load)
  const refreshCart = useCartStore((s) => s.refresh)
  const closeAll = useUiStore((s) => s.closeAll)
  const { pathname } = useLocation()

  useEffect(() => {
    loadConfig()
    loadOffers()
    refreshCart()
  }, [loadConfig, loadOffers, refreshCart])

  // A drawer left open across a navigation would cover the page it opened.
  useEffect(() => {
    closeAll()
  }, [pathname, closeAll])

  // A full page load always started at the top; client-side navigation must match.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  // Re-scanned per route: each page brings its own `.wow` elements.
  useReveal([pathname])

  return (
    <div className="wrapper ovh">
      <div className="preloader"></div>

      <SiteHeader />

      {/*
        Each page supplies its own `.body_content_wrapper`, because Blade did not agree on
        one: home.blade.php wraps it in a <div> with the footer inside, collection and the
        rest use a <main class="body_content_wrapper ... collection-page"> with a
        page-specific modifier class that style.css keys off. Hoisting it here would either
        drop those modifiers or nest two wrappers.
      */}
      <Outlet />

      <SiteFooter />

      <WhatsAppButton />

      <MinicartDrawer />
      <AccountDrawer />
    </div>
  )
}
