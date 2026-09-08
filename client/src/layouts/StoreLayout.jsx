import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from '../components/layout/Header.jsx'
import Footer from '../components/layout/Footer.jsx'
import CartDrawer from '../components/cart/CartDrawer.jsx'
import { useConfigStore, useCartStore } from '../store/index.js'

/**
 * Storefront shell — the React equivalent of the Blade layout.
 *
 * Site config, categories and the cart are loaded once here rather than in every page, so
 * navigating between pages does not re-fetch the header's data.
 */
export default function StoreLayout() {
  const loadConfig = useConfigStore((s) => s.load)
  const refreshCart = useCartStore((s) => s.refresh)
  const { pathname } = useLocation()

  useEffect(() => {
    loadConfig()
    refreshCart()
  }, [loadConfig, refreshCart])

  // A full page load always started at the top; client-side navigation must do the same.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <div className="pp-site">
      <Header />
      <main id="main-content">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
    </div>
  )
}
