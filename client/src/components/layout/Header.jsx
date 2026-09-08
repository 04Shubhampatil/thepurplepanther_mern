import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore, useCartStore, useConfigStore } from '../../store/index.js'
import SearchBox from './SearchBox.jsx'

/** Site header: navigation, search, account and the cart count. */
export default function Header() {
  const { user, logout } = useAuthStore()
  const { cart, openDrawer } = useCartStore()
  const categories = useConfigStore((s) => s.categories)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <header className="pp-header">
      <div className="container">
        <div
          className="pp-header__inner"
          style={{ display: 'flex', alignItems: 'center', gap: 16 }}
        >
          <button
            type="button"
            className="pp-header__toggle d-lg-none"
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <i className="fa fa-bars" aria-hidden="true" />
          </button>

          <Link to="/" className="pp-header__logo" aria-label="The Purple Panther — home">
            <img src="/frontend/images/logo.png" alt="The Purple Panther" height="44" />
          </Link>

          <nav className={`pp-header__nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main">
            <ul style={{ display: 'flex', gap: 20, listStyle: 'none', margin: 0, padding: 0 }}>
              <li>
                <NavLink to="/shop" onClick={() => setMenuOpen(false)}>
                  Shop
                </NavLink>
              </li>

              {categories.slice(0, 6).map((category) => (
                <li key={category.id}>
                  {/* Clean category URL, preserved from Laravel: /accessories, /shirts, … */}
                  <NavLink to={`/${category.slug}`} onClick={() => setMenuOpen(false)}>
                    {category.title}
                  </NavLink>
                </li>
              ))}

              <li>
                <NavLink to="/blog" onClick={() => setMenuOpen(false)}>
                  Journal
                </NavLink>
              </li>
              <li>
                <NavLink to="/about" onClick={() => setMenuOpen(false)}>
                  About
                </NavLink>
              </li>
            </ul>
          </nav>

          <div
            className="pp-header__actions"
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}
          >
            <button type="button" aria-label="Search" onClick={() => setSearchOpen((v) => !v)}>
              <i className="fa fa-search" aria-hidden="true" />
            </button>

            {user ? (
              <div className="pp-header__account" style={{ display: 'flex', gap: 12 }}>
                <Link to="/account/overview">{user.firstName || 'Account'}</Link>
                <button type="button" onClick={handleLogout}>
                  Sign out
                </button>
              </div>
            ) : (
              <Link to="/login">Sign in</Link>
            )}

            <button
              type="button"
              className="pp-header__cart"
              onClick={openDrawer}
              aria-label={`Cart, ${cart.count} item${cart.count === 1 ? '' : 's'}`}
            >
              <i className="fa fa-shopping-bag" aria-hidden="true" />
              {cart.count > 0 && <span className="pp-header__cart-count">{cart.count}</span>}
            </button>
          </div>
        </div>

        {searchOpen && <SearchBox onClose={() => setSearchOpen(false)} />}
      </div>
    </header>
  )
}
