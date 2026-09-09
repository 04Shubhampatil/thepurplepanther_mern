import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useConfigStore, useAuthStore } from '../../store/index.js'
import { useUiStore } from '../../store/ui.js'
import { useBodyClasses, useScrollLock } from '../../theme/chrome.js'
import { MMENU_SOCIAL } from '../../theme/site.js'

/**
 * The mobile menu — replacing mmenu.js and frontend/partials/mobile-menu.blade.php.
 *
 * mmenu took a plain `<nav id="menu"><ul>…</ul></nav>` and rebuilt it into a fixed
 * off-canvas panel, prepending the result to <body>. The markup below is that OUTPUT,
 * captured from the running page and reproduced element for element, because the theme's
 * stylesheet is written against those generated class names — `mm-menu_offcanvas` for the
 * fixed positioning, `mm-panel`/`mm-listview`/`mm-listitem__text` for the list, and
 * `mm-navbars_top` / `mm-navbars_bottom` for the header and social strips that script.js
 * passed to mmenu as `navbars` options.
 *
 * Three details that are behaviour, not decoration:
 *
 *   - It renders through a PORTAL to <body>. mmenu placed the panel there so it could sit
 *     outside the page's stacking context and slide the page across; a portal puts it in
 *     the same place while React still owns and cleans up the nodes.
 *   - `#page` carries `mm-page mm-slideout` (set in SiteHeader) and `<body>` carries
 *     `mm-wrapper`, plus the four `mm-wrapper_*` classes while open. That combination is
 *     what actually moves the page aside and dims it.
 *   - `.mm-wrapper__blocker` is the click-catcher over the dimmed page. Without it the menu
 *     can only be closed from its own X.
 *
 * Links are `<Link>`, which mmenu's rebuilt anchors could never be — under jQuery they were
 * detached from React's tree and every tap reloaded the document.
 */
const MENU_LINKS = (accessoriesUrl) => [
  ['/', 'HOME'],
  ['/collection', 'COLLECTION'],
  [accessoriesUrl, 'ACCESSORIES'],
  ['/about', 'OUR STORY'],
  ['/support', 'CUSTOMER SUPPORT'],
]

export default function MobileMenu() {
  const categories = useConfigStore((s) => s.categories)
  const user = useAuthStore((s) => s.user)
  const { menuOpen, closeMenu, openSearch, openAccount } = useUiStore()

  const accessories = categories.find((c) => c.slug === 'accessories')
  const loggedIn = Boolean(user) && user.role !== 'admin'

  const parts = String(user?.name ?? '').trim().split(/\s+/).filter(Boolean)
  const initials = ((parts[0] ?? 'U').charAt(0) + (parts[1] ? parts[1].charAt(0) : '')).toUpperCase()

  // mmenu put `mm-wrapper` on <body> at init and added the rest while open.
  useBodyClasses(['mm-wrapper'])
  useBodyClasses(
    ['mm-wrapper_opened', 'mm-wrapper_blocking', 'mm-wrapper_background', 'mm-wrapper_opening'],
    menuOpen,
  )
  useScrollLock(menuOpen)

  // script.js bound Escape to `api.close()`.
  useEffect(() => {
    if (!menuOpen) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeMenu()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen, closeMenu])

  return createPortal(
    <>
      <nav
        id="menu"
        className={`mm-menu mm-menu_offcanvas mm-menu_position-left mm-menu_pagedim-white mm-menu_theme-light${menuOpen ? ' mm-menu_opened' : ''}`}
        aria-hidden={menuOpen ? undefined : true}
      >
        <div className="mm-navbars_top">
          <div className="mm-navbar">
            <div className="mmx-header">
              <div className="mmx-left">
                <a
                  href="#"
                  className="js-mm-close"
                  aria-label="Close menu"
                  onClick={(event) => {
                    event.preventDefault()
                    closeMenu()
                  }}
                >
                  <i className="flaticon-close"></i>
                </a>
                <a
                  href="#"
                  className="js-mm-search cart-search-btn"
                  aria-label="Search"
                  onClick={(event) => {
                    event.preventDefault()
                    openSearch()
                  }}
                >
                  <i className="flaticon-web"></i>
                </a>
              </div>

              <Link className="mmx-logo" to="/" aria-label="Purple Panther home" onClick={closeMenu}>
                <img src="/frontend/images/logo-new.svg" alt="Purple Panther" />
              </Link>

              <div className="mmx-right">
                <Link
                  className={`signin-cart-btn${loggedIn ? ' is-logged-in' : ''}`}
                  to={loggedIn ? '/account/overview' : '/login'}
                  aria-label={loggedIn ? 'My account' : 'Account'}
                  onClick={
                    loggedIn
                      ? closeMenu
                      : (event) => {
                          event.preventDefault()
                          openAccount()
                        }
                  }
                >
                  {loggedIn ? (
                    <span className="site-account-avatar" aria-hidden="true">{initials}</span>
                  ) : (
                    <i className="flaticon-user-1"></i>
                  )}
                </Link>
                <Link to="/cart" aria-label="Shopping bag" onClick={closeMenu}>
                  <i className="flaticon-shopping-bag"></i>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mm-panels">
          <div id="mm-0" className="mm-panel mm-panel_opened">
            <div className="mm-navbar mm-navbar_sticky">
              <a className="mm-navbar__title"><span>Menu</span></a>
            </div>
            <ul className="mm-listview">
              {MENU_LINKS(accessories ? accessories.url : '/shop').map(([href, label]) => (
                <li className="mm-listitem" key={label}>
                  <Link to={href} className="mm-listitem__text" onClick={closeMenu}>{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mm-navbars_bottom">
          <div className="mm-navbar">
            <div className="mmx-footer">
              <h4 className="social-title">FOLLOW US</h4>
              <div className="mmx-social">
                <a href={MMENU_SOCIAL.facebook} target="_blank" rel="noopener" aria-label="Facebook">
                  <i className="fa-brands fa-facebook-f"></i>
                </a>
                <a href={MMENU_SOCIAL.instagram} target="_blank" rel="noopener" aria-label="Instagram">
                  <i className="fa-brands fa-instagram"></i>
                </a>
                <a href={MMENU_SOCIAL.youtube} target="_blank" rel="noopener" aria-label="YouTube">
                  <i className="fa-brands fa-youtube"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {menuOpen && (
        <div className="mm-wrapper__blocker mm-slideout" onClick={closeMenu}></div>
      )}
    </>,
    document.body,
  )
}
