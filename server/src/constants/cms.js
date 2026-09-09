/**
 * CMS constants, ported from App\Support\BannerSections and App\Support\SitePages, plus
 * the inline allow-lists in FrontendController.
 *
 * These are allow-lists, not decoration: Laravel returned 404 for any slug outside them,
 * and the admin banner UI is driven by the section keys.
 */

/**
 * App\Support\BannerSections::all() — the 13 placements, verbatim.
 *
 * label, page AND hint all matter: the admin's Banners screen prints the label and page
 * on every chip and card, and the section filter is built from these keys. An earlier
 * port abbreviated four of the labels ('Home — Journal' for 'Home — From The Journal',
 * 'Mega Menu Promo' for 'Mega Menu Promo Images') and dropped the pages down to one word,
 * which showed up directly in the UI.
 */
export const BANNER_SECTIONS = Object.freeze({
  global_top_strip: {
    label: 'Global Top Strip',
    page: 'All Pages',
    hint: 'Announcement bar e.g. "WINTER SALE: UP TO 50% OFF". Multiple slides supported.',
    multi: true,
  },
  home_hero: {
    label: 'Home Hero Slider',
    page: 'Home',
    hint: 'Full-bleed hero at top of homepage. Multiple images/slides.',
    multi: true,
  },
  home_complete_collection: {
    label: 'Home — Complete Collection',
    page: 'Home',
    hint: 'Three category promo tiles (Shirts / Kurtis / Accessories).',
    multi: true,
  },
  home_shoppable_look: {
    label: 'Home — Shop the Look',
    page: 'Home',
    hint: 'Large lifestyle / shoppable mid banner.',
    multi: true,
  },
  home_new_arrivals_banner: {
    label: 'Home — New Arrivals Banner',
    page: 'Home',
    hint: 'Left promo block next to New Arrivals products (COLLECTION 22).',
    multi: true,
  },
  home_our_story: {
    label: 'Home — Our Story',
    page: 'Home',
    hint: 'Mid brand story banner with CTA.',
    multi: true,
  },
  home_fabric_library: {
    label: 'Home — Fabric Library',
    page: 'Home',
    hint: 'Fabric / material image carousel with overlay titles.',
    multi: true,
  },
  home_closing_content: {
    label: 'Home — Final Image / Content',
    page: 'Home',
    hint: 'Closing editorial section: image, title, content and optional button.',
    multi: true,
  },
  home_journal: {
    label: 'Home — From The Journal',
    page: 'Home',
    hint: 'Journal / blog teaser cards on homepage.',
    multi: true,
  },
  journal_page_banner: {
    label: 'Journal Page Banner',
    page: 'Journal / Blog',
    hint: 'Top featured banner on /blog journal listing page.',
    multi: true,
  },
  mega_menu_promo: {
    label: 'Mega Menu Promo Images',
    page: 'Global Nav',
    hint: 'Promo images inside category mega menu.',
    multi: true,
  },
  category_page_banner: {
    label: 'Category Page Banner',
    page: 'Category / Listing',
    hint: 'Banner / featured tile on category listing pages.',
    multi: true,
  },
  about_story_grid: {
    label: 'About — Story Image Grid',
    page: 'About',
    hint: 'Image grid on Our Story / About page.',
    multi: true,
  },
})

export const BANNER_SECTION_KEYS = Object.freeze(Object.keys(BANNER_SECTIONS))
export const isValidBannerSection = (section) =>
  Object.prototype.hasOwnProperty.call(BANNER_SECTIONS, section)

/**
 * App\Support\SitePages::all() — the four admin-editable CMS pages backed by the `pages`
 * table.
 *
 * ⚠️ These are currently WRITE-ONLY in the source application: `Page::` is referenced only
 * by Admin\PageSettingController, and no storefront view reads the table. Admins can edit
 * this content but nothing displays it (audit R11). The public endpoint below is provided
 * so the data is reachable, but the React app must not be described as rendering it until
 * that is a deliberate product decision.
 */
export const SITE_PAGES = Object.freeze({
  'about-us': 'About Us',
  'terms-of-use': 'Terms Of Use',
  privacy: 'Privacy',
  'refund-return-policy': 'Refund Return Policy',
})

export const SITE_PAGE_KEYS = Object.freeze(Object.keys(SITE_PAGES))
export const isValidSitePage = (slug) => Object.prototype.hasOwnProperty.call(SITE_PAGES, slug)

/**
 * FrontendController::support allow-list. Content lives in Blade templates (now React
 * components), not the database — the API only resolves the slug and its title.
 * Default page is `faqs`.
 */
export const SUPPORT_PAGES = Object.freeze({
  shipping: 'Shipping',
  returns: 'Returns & Exchanges',
  'start-return': 'Start a Return',
  international: 'International Customers',
  'size-guide': 'Size Guide',
  faqs: 'FAQs',
  terms: 'Terms & Conditions',
  privacy: 'Privacy & Cookies',
  affiliates: 'Affiliates',
})

export const SUPPORT_PAGE_KEYS = Object.freeze(Object.keys(SUPPORT_PAGES))
export const isValidSupportPage = (slug) =>
  Object.prototype.hasOwnProperty.call(SUPPORT_PAGES, slug)

/** FrontendController::account allow-list, used in phase 8. */
export const ACCOUNT_PAGES = Object.freeze({
  overview: 'Overview',
  orders: 'Orders',
  information: 'Account Information',
  addresses: 'Addresses',
  wishlist: 'Wishlist',
  reviews: 'My Reviews',
})

/** `/account/favorites` and `/account/wishlists` both redirect to `/account/wishlist`. */
export const ACCOUNT_PAGE_ALIASES = Object.freeze({
  favorites: 'wishlist',
  wishlists: 'wishlist',
})

export default {
  BANNER_SECTIONS,
  BANNER_SECTION_KEYS,
  isValidBannerSection,
  SITE_PAGES,
  SITE_PAGE_KEYS,
  isValidSitePage,
  SUPPORT_PAGES,
  SUPPORT_PAGE_KEYS,
  isValidSupportPage,
  ACCOUNT_PAGES,
  ACCOUNT_PAGE_ALIASES,
}
