import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from '../components/layout/Header.jsx'
import Footer from '../components/layout/Footer.jsx'
import CartDrawer from '../components/cart/CartDrawer.jsx'
import { useConfigStore, useCartStore } from '../store/index.js'

/**
 * Storefront shell.
 *
 * Config, categories and the cart load once here rather than per page, so navigating does
 * not re-fetch the header's data.
 *
 * The header is transparent only over the homepage hero, where it sits on top of the
 * video; everywhere else it is solid from the start.
 */
export default function StoreLayout() {
  const loadConfig = useConfigStore((s) => s.load)
  const refreshCart = useCartStore((s) => s.refresh)
  const { pathname } = useLocation()

  useEffect(() => {
    loadConfig()
    refreshCart()
  }, [loadConfig, refreshCart])

  // A full page load always started at the top; client-side navigation must match.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:bg-brand focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <Header transparent={pathname === '/'} />

      <main id="main-content" className="flex-1">
        <Outlet />
      </main>

      <Footer />
      <CartDrawer />
    </div>
  )
}
