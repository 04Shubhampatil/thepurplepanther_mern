import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Menu, Search, User, Heart, ShoppingBag } from 'lucide-react'
import Container from '../ui/Container.jsx'
import MobileMenu from './MobileMenu.jsx'
import SearchDrawer from './SearchDrawer.jsx'
import { useAuthStore, useCartStore } from '../../store/index.js'

/**
 * Site header.
 *
 * Layout mirrors the live site exactly: MENU + search on the left, the wordmark centred,
 * account / wishlist / cart on the right. Navigation lives in a slide-out panel on every
 * breakpoint, which is how the original behaves — it is not a mobile-only pattern.
 *
 * The header is transparent over the homepage hero and becomes solid once scrolled, so
 * the wordmark stays legible against the video.
 */
export default function Header({ transparent = false }) {
  const { user } = useAuthStore()
  const { cart, openDrawer } = useCartStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const overlay = transparent && !scrolled
  const tone = overlay ? 'text-white' : 'text-ink'

  const iconButton =
    'grid size-10 place-items-center transition-colors duration-200 hover:text-brand ' +
    (overlay ? 'hover:text-white/70' : '')

  return (
    <>
      <motion.header
        initial={false}
        animate={{
          backgroundColor: overlay ? 'rgba(255,255,255,0)' : 'rgba(255,255,255,1)',
          borderBottomColor: overlay ? 'rgba(230,226,221,0)' : 'rgba(230,226,221,1)',
        }}
        transition={{ duration: 0.3 }}
        className={`sticky top-0 z-50 border-b ${tone}`}
      >
        <Container>
          <div className="flex h-16 items-center justify-between gap-4 md:h-20">
            {/* left */}
            <div className="flex flex-1 items-center gap-1">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className={`${iconButton} -ml-2 flex w-auto items-center gap-2 px-2`}
                aria-label="Open menu"
                aria-expanded={menuOpen}
              >
                <Menu size={20} strokeWidth={1.5} aria-hidden="true" />
                <span className="hidden text-[12px] font-semibold uppercase tracking-[0.14em] sm:inline">
                  Menu
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className={iconButton}
                aria-label="Search products"
              >
                <Search size={20} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>

            {/* wordmark */}
            <Link
              to="/"
              className="shrink-0 text-center"
              aria-label="The Purple Panther — home"
            >
              <span
                className={`font-alt text-[15px] font-bold uppercase leading-none tracking-[0.22em] md:text-[17px] ${
                  overlay ? 'text-white' : 'text-brand'
                }`}
              >
                Purple Panther
              </span>
            </Link>

            {/* right */}
            <div className="flex flex-1 items-center justify-end gap-1">
              <button
                type="button"
                onClick={() => navigate(user ? '/account/overview' : '/login')}
                className={iconButton}
                aria-label={user ? 'Your account' : 'Sign in'}
              >
                <User size={20} strokeWidth={1.5} aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => navigate(user ? '/account/wishlist' : '/login')}
                className={`${iconButton} hidden sm:grid`}
                aria-label="Wishlist"
              >
                <Heart size={20} strokeWidth={1.5} aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={openDrawer}
                className={`${iconButton} relative`}
                aria-label={`Cart, ${cart.count} item${cart.count === 1 ? '' : 's'}`}
              >
                <ShoppingBag size={20} strokeWidth={1.5} aria-hidden="true" />
                {cart.count > 0 && (
                  <span
                    className="absolute right-1 top-1 grid size-[18px] place-items-center rounded-full bg-brand text-[10px] font-semibold text-white"
                    aria-hidden="true"
                  >
                    {cart.count}
                  </span>
                )}
              </button>
            </div>
          </div>
        </Container>
      </motion.header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <SearchDrawer open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
