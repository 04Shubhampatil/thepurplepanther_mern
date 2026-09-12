import { Link } from 'react-router-dom'
import SearchPanel from './SearchPanel.jsx'
import MobileMenu from './MobileMenu.jsx'
import AccountHeaderIcon from './AccountHeaderIcon.jsx'
import ThemeSwiper, { SwiperSlide } from '../ui/ThemeSwiper.jsx'
import { useAuthStore, useCartStore, useOffersStore } from '../../store/index.js'
import { useUiStore } from '../../store/ui.js'
import { useStickyHeader } from '../../theme/chrome.js'

/**
 * frontend/partials/site-header.blade.php.
 *
 * The markup is the Blade partial's, element for element and class for class, because the
 * theme's stylesheet is written against it — `.su-header-4-middle` for the bar itself,
 * `.site-header-fixed` for its pinned state, `.mm-page mm-slideout` on `#page` for the
 * slide-aside when the menu opens.
 *
 * What used to be jQuery is now ordinary React: `.menubar` and `.cart-search-btn` were
 * delegated handlers in script.js that toggled classes on nodes elsewhere in the document;
 * they are click handlers on shared state (store/ui.js) now. The classes stay because the
 * stylesheet still needs them, but nothing selects on them any more.
 *
 * The bag icon is cart.js's, not a page link. Its delegated handler on `.cart-filter-btn`
 * called preventDefault, reloaded the cart and then opened the bag drawer — so clicking the
 * icon never left the page. The href stays `/cart` for the same reason it did there: with
 * no JavaScript it still goes somewhere useful. cart.js's ensureBadges() also appended a
 * `.site-cart-count` badge to the icon and hid it below one item; that is the count span.
 */
export default function SiteHeader() {
  const offers = useOffersStore((s) => s.offers)
  const cartCount = useCartStore((s) => s.cart.count ?? 0)
  const refreshCart = useCartStore((s) => s.refresh)
  const openBag = useCartStore((s) => s.openDrawer)
  const { openMenu, openSearch, openAccount } = useUiStore()
  const user = useAuthStore((s) => s.user)
  const customer = Boolean(user) && user.role !== 'admin'
  const fixed = useStickyHeader()

  /*
   * site-drawers.js addHeaderButtons(): a wishlist heart inserted between the account icon
   * and the bag on every page. A signed-in customer goes to /account/wishlist; a guest gets
   * the account panel with the wishlist recorded as where to land after signing in — the
   * `pp_account_return` the ui store carries as `accountReturn`.
   */
  function openWishlist(event) {
    if (customer) return
    event.preventDefault()
    openAccount('/account/wishlist')
  }

  function openBagDrawer(event) {
    event.preventDefault()
    // cart.js: loadCart().finally(openBagDrawer) — open even if the reload fails.
    refreshCart().finally(openBag)
  }

  const ticker = offers.length > 0
    ? offers
    : [{ id: 'default', bannerText: 'SHOP NEW ARRIVALS' }]

  return (
    <>
      {/* header-area */}
      <header>
        <div className="su-header-4-area d-none d-lg-block bgc-light-orange">
          <div className="su-header-4-top home21-style">
            <div className="container container-fluid">
              <div className="row justify-content-center">
                <div className="col-md-4 mx-auto">
                  <ThemeSwiper
                    className="swiper one-grid-slider overflow-hidden"
                    data-pp-offer-slider
                    slidesPerView={1}
                    speed={1500}
                    spaceBetween={0}
                    loop={ticker.length > 1}
                    parallax
                    autoplay={{ delay: 3500 }}
                    navigation={{ nextEl: '.su-banner-4-next, .next', prevEl: '.su-banner-4-prev, .prev' }}
                    pagination={{ el: '.swiper-pagination', type: 'fraction' }}
                  >
                    {ticker.map((offer) => (
                      <SwiperSlide key={offer.id}>
                        <div className="discount text-center">
                          <div className="mb0 text text-dark">{offer.bannerText}</div>
                        </div>
                      </SwiperSlide>
                    ))}
                  </ThemeSwiper>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      {/* header-area-end */}

      <div id="page" className="stylehome4 mobile-menu-home21-style dark-menu mm-page mm-slideout">
        <div className={`header su-header-4-middle home21-style${fixed ? ' site-header-fixed' : ''}`}>
          <div className="menu_and_widgets">
            <div className="mobile_menu_bar">
              <div className="menu-bar text-white d-flex align-items-center">
                <a
                  className="menubar"
                  href="#menu"
                  onClick={(event) => {
                    event.preventDefault()
                    openMenu()
                  }}
                ><span></span><span></span></a>
                <span className="text-white menu-text">Menu</span>
              </div>
              <button
                type="button"
                className="search cart-search-btn bg-transparent border-0 d-flex align-items-center gap-2 text-white"
                onClick={openSearch}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g clipPath="url(#clip0_site_header_search)">
                    <path d="M7.09841 1.63574C7.36716 1.63574 7.63591 1.65449 7.9031 1.69043C7.86091 1.68418 7.82028 1.67949 7.7781 1.67324C8.29528 1.74512 8.79997 1.88262 9.28122 2.08418C9.24372 2.06855 9.20622 2.05293 9.16872 2.0373C9.47028 2.16543 9.76091 2.31699 10.0359 2.49199C10.1562 2.56855 10.275 2.6498 10.389 2.73418C10.4156 2.75449 10.4437 2.7748 10.4703 2.79512C10.3437 2.6998 10.4437 2.7748 10.4734 2.79824C10.5312 2.84512 10.589 2.89355 10.6468 2.94199C10.8656 3.13105 11.0703 3.33574 11.2578 3.55449C11.3015 3.60605 11.3453 3.65762 11.3875 3.71074C11.4015 3.72949 11.475 3.82324 11.4203 3.75137C11.3672 3.68262 11.4156 3.74512 11.425 3.75762C11.439 3.77637 11.4515 3.79355 11.4656 3.8123C11.55 3.92793 11.6312 4.04512 11.7078 4.16543C11.8812 4.44043 12.0328 4.72949 12.1593 5.02949C12.1437 4.99199 12.1281 4.95449 12.1125 4.91699C12.3156 5.40293 12.4547 5.9123 12.525 6.43262C12.5187 6.39043 12.514 6.3498 12.5078 6.30762C12.5765 6.82949 12.5765 7.35918 12.5078 7.88262C12.514 7.84043 12.5187 7.7998 12.525 7.75762C12.4547 8.27949 12.3156 8.78887 12.1125 9.27324C12.1281 9.23574 12.1437 9.19824 12.1593 9.16074C12.0453 9.42949 11.9125 9.68887 11.7609 9.93887C11.6859 10.0607 11.6078 10.1811 11.525 10.2967C11.4859 10.3514 11.4453 10.4061 11.4047 10.4592C11.3687 10.5076 11.4828 10.3607 11.4297 10.4264C11.4203 10.4389 11.4109 10.4498 11.4015 10.4623C11.3765 10.4951 11.35 10.5264 11.3234 10.5576C11.139 10.7795 10.9375 10.9873 10.7218 11.1795C10.6718 11.2248 10.6203 11.2686 10.5687 11.3123C10.5422 11.3342 10.5172 11.3561 10.4906 11.3764C10.4625 11.3998 10.3375 11.492 10.4703 11.3936C10.3562 11.4795 10.2406 11.5639 10.1218 11.642C9.82028 11.8404 9.50153 12.0107 9.16872 12.1529L9.28122 12.1061C8.79997 12.3076 8.29528 12.4467 7.7781 12.517C7.82028 12.5107 7.86091 12.5061 7.9031 12.4998C7.37028 12.5701 6.82966 12.5717 6.29528 12.4998C6.33747 12.5061 6.3781 12.5107 6.42028 12.517C5.90466 12.4467 5.39997 12.3092 4.92028 12.1076C4.95778 12.1232 4.99528 12.1389 5.03278 12.1545C4.75935 12.0389 4.49528 11.9029 4.24372 11.7482C4.1156 11.6701 3.98903 11.5857 3.86716 11.4982C3.83903 11.4779 3.81247 11.4576 3.78435 11.4373C3.77028 11.4264 3.74528 11.4139 3.73591 11.3998C3.73435 11.3982 3.83591 11.4779 3.78278 11.4357C3.72341 11.3889 3.6656 11.342 3.60778 11.2936C3.38435 11.1045 3.17341 10.8982 2.97966 10.6779C2.92966 10.6217 2.88122 10.5639 2.83435 10.5061C2.81247 10.4795 2.79216 10.4529 2.77028 10.4264C2.76247 10.4154 2.7531 10.4045 2.74528 10.3936C2.84685 10.5217 2.7781 10.4357 2.75622 10.4076C2.67028 10.292 2.58747 10.1748 2.51091 10.0529C2.3281 9.76855 2.17185 9.47012 2.03903 9.15918C2.05466 9.19668 2.07028 9.23418 2.08591 9.27168C1.88435 8.79199 1.74685 8.2873 1.67653 7.77168C1.68278 7.81387 1.68747 7.85449 1.69372 7.89668C1.62185 7.36387 1.62185 6.82324 1.69372 6.29043C1.68747 6.33262 1.68278 6.37324 1.67653 6.41543C1.74685 5.8998 1.88435 5.39512 2.08591 4.91543C2.07028 4.95293 2.05466 4.99043 2.03903 5.02793C2.15466 4.75449 2.2906 4.49043 2.44528 4.23887C2.52341 4.11074 2.60778 3.98418 2.69528 3.8623C2.7156 3.83418 2.73591 3.80762 2.75622 3.77949C2.76716 3.76543 2.77966 3.74043 2.79372 3.73105C2.79528 3.72949 2.7156 3.83105 2.75778 3.77793C2.80466 3.71855 2.85153 3.66074 2.89997 3.60293C3.08903 3.37949 3.29528 3.16855 3.5156 2.9748C3.57185 2.9248 3.62966 2.87637 3.68747 2.82949C3.71403 2.80762 3.7406 2.7873 3.76716 2.76543C3.7781 2.75762 3.78903 2.74824 3.79997 2.74043C3.67185 2.84199 3.75778 2.77324 3.78591 2.75137C3.90153 2.66543 4.01872 2.58262 4.1406 2.50605C4.42497 2.32324 4.72341 2.16699 5.03435 2.03418C4.99685 2.0498 4.95935 2.06543 4.92185 2.08105C5.40153 1.87949 5.90622 1.74199 6.42185 1.67168C6.37966 1.67793 6.33903 1.68262 6.29685 1.68887C6.56091 1.65449 6.82966 1.63574 7.09841 1.63574C7.34372 1.63574 7.5781 1.42012 7.56716 1.16699C7.55622 0.913867 7.36091 0.698242 7.09841 0.698242C5.87028 0.699805 4.6406 1.05605 3.61247 1.73105C2.61716 2.38418 1.79372 3.31074 1.29685 4.39668C1.0406 4.95605 0.856221 5.54043 0.771846 6.1498C0.678096 6.81387 0.682783 7.46855 0.784346 8.13262C0.968721 9.32949 1.52497 10.4576 2.3281 11.3623C3.12028 12.2545 4.17497 12.9154 5.32028 13.2467C6.67341 13.6389 8.1781 13.5732 9.48278 13.0357C10.1562 12.7576 10.7687 12.3857 11.3203 11.9076C11.8078 11.4842 12.2297 10.9764 12.5672 10.4264C13.2703 9.27637 13.5984 7.89043 13.4734 6.54668C13.4078 5.83887 13.2328 5.16699 12.9531 4.51543C12.6937 3.91387 12.3312 3.36074 11.9 2.86699C10.975 1.81074 9.6781 1.06543 8.29685 0.812305C7.90153 0.74043 7.49997 0.699805 7.09841 0.698242C6.8531 0.698242 6.61872 0.913867 6.62966 1.16699C6.6406 1.42168 6.83591 1.63574 7.09841 1.63574Z" fill="currentColor"></path>
                    <path d="M10.9609 11.6235L12.1609 12.8235L14.0656 14.7282L14.5015 15.1641C14.675 15.3375 14.9937 15.35 15.164 15.1641C15.3359 14.9766 15.35 14.686 15.164 14.5016C14.764 14.1016 14.364 13.7016 13.964 13.3016C13.3296 12.6672 12.6937 12.0313 12.0593 11.3969C11.914 11.2516 11.7687 11.1063 11.6234 10.961C11.45 10.7875 11.1312 10.775 10.9609 10.961C10.789 11.1469 10.775 11.4375 10.9609 11.6235Z" fill="currentColor"></path>
                  </g>
                  <defs><clipPath id="clip0_site_header_search"><rect width="16" height="16" fill="white" /></clipPath></defs>
                </svg>
                <span className="d-none d-xl-flex">Search</span>
              </button>
              {/* open search start */}
              <SearchPanel />
              {/* open search end */}

              <div className="mobile-menu-logo">
                <Link to="/" className="site-header-logo" aria-label="Purple Panther home">
                  <img className="site-header-logo__img site-header-logo__img--light" src="/frontend/images/logo.svg" alt="Purple Panther" />
                  <img className="site-header-logo__img site-header-logo__img--dark d-none" src="/frontend/images/logo-new.svg" alt="Purple Panther" />
                </Link>
              </div>
            </div>
            <div className="mobile_menu_widget_icons">
              <div className="cart-btn text-end">
                <nav>
                  <ul>
                    <li className="ms-0">
                      <AccountHeaderIcon />
                    </li>
                    <li className="position-relative ms-2 site-wishlist-entry">
                      <Link to="/account/wishlist" className="wishlist-panel-btn" aria-label="Open wishlist" onClick={openWishlist}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" /></svg>
                      </Link>
                    </li>
                    <li className="position-relative ms-2">
                      <a
                        href="/cart"
                        className="cart-filter-btn site-cart-link"
                        style={{ position: 'relative' }}
                        aria-label="Shopping bag"
                        onClick={openBagDrawer}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M11.9 15H4.09998C2.44998 15 1.09998 13.65 1.09998 12V11.9L1.39998 3.9C1.44998 2.25 2.79998 1 4.39998 1H11.6C13.2 1 14.55 2.25 14.6 3.9L14.9 11.9C14.95 12.7 14.65 13.45 14.1 14.05C13.55 14.65 12.8 15 12 15C12 15 11.95 15 11.9 15ZM4.39998 2C3.29998 2 2.44998 2.85 2.39998 3.9L2.09998 12C2.09998 13.1 2.99998 14 4.09998 14H12C12.55 14 13.05 13.75 13.4 13.35C13.75 12.95 13.95 12.45 13.95 11.9L13.65 3.9C13.6 2.8 12.75 2 11.65 2H4.39998Z" fill="currentColor" />
                          <path d="M8 7C6.05 7 4.5 5.45 4.5 3.5C4.5 3.2 4.7 3 5 3C5.3 3 5.5 3.2 5.5 3.5C5.5 4.9 6.6 6 8 6C9.4 6 10.5 4.9 10.5 3.5C10.5 3.2 10.7 3 11 3C11.3 3 11.5 3.2 11.5 3.5C11.5 5.45 9.95 7 8 7Z" fill="currentColor" />
                        </svg>
                        <span className="site-cart-count" data-cart-count="" hidden={cartCount < 1}>{cartCount}</span>
                      </a>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>
          </div>
        </div>
        {/* /.mobile-menu */}
        <MobileMenu />
      </div>
    </>
  )
}
