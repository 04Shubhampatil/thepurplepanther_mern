/**
 * window.PP_SITE — the object Blade's `site-config` partial printed inline.
 *
 * script.js reads it to build the mmenu header and footer (logo, account link, cart link,
 * social icons), so it has to exist BEFORE the theme boots, and be refreshed when the
 * signed-in user changes so the mobile menu shows initials rather than "Account".
 *
 * Only the presentation keys are carried over. The Laravel version also published every
 * cart, wishlist and auth ENDPOINT for the legacy jQuery to post to; those behaviours are
 * React's now and go through services/endpoints.js, so republishing the URLs here would
 * just be a second, silently diverging copy of the API surface.
 */

/**
 * The footer's social links (site-footer.blade.php).
 *
 * These are the real accounts, and they are NOT the same list script.js gets below: the
 * Blade site-config partial published generic placeholder URLs for the mmenu navbar while
 * the footer hard-coded the live ones. Both are reproduced rather than merged, because
 * merging them would change what the mobile menu links to.
 */
const SOCIAL = {
  facebook: 'https://www.facebook.com/share/1Bv5L4iHWE/?mibextid=wwXIfr',
  instagram: 'https://www.instagram.com/thepurplepanther.in?igsh=MWZxOTdiaGVjYnZ6MQ%3D%3D&utm_source=qr',
  x: 'https://x.com/',
  youtube: 'https://www.youtube.com/',
  pinterest: 'https://www.pinterest.com/',
}

/** What site-config.blade.php put on window.PP_SITE for the mmenu navbar. */
const MMENU_SOCIAL = {
  facebook: 'https://www.facebook.com/',
  instagram: 'https://www.instagram.com/',
  youtube: 'https://www.youtube.com/',
  pinterest: 'https://www.pinterest.com/',
  tiktok: 'https://www.tiktok.com/',
}

export function syncSiteConfig({ user = null, categories = [] } = {}) {
  const authenticated = Boolean(user)

  window.PP_SITE = {
    name: 'The Purple Panther',
    basePath: '',
    home: '/',
    collection: '/collection',
    shop: '/shop',
    cart: '/cart',
    checkout: '/checkout',
    blog: '/blog',
    about: '/about',
    support: '/support',
    login: '/login',
    signup: '/signup',
    account: '/account',
    accountOverview: '/account/overview',
    searchUrl: '/search',
    assetBase: '/frontend',
    authenticated,
    user: authenticated ? { id: user.id, name: user.name, email: user.email } : null,
    logo: '/frontend/images/logo-new.svg',
    logoAlt: '/frontend/images/logo.svg',
    logoHeader: '/frontend/images/logo.svg',
    logoDark: '/frontend/images/logo-new.svg',
    categories: categories.map((c) => ({ title: c.title, slug: c.slug, url: c.url })),
    social: MMENU_SOCIAL,
  }

  return window.PP_SITE
}

export { SOCIAL }
