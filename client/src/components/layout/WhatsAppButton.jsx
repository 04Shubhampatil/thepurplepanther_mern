import { useLocation } from 'react-router-dom'

/**
 * Floating WhatsApp button — replaces the theme's yellow scroll-to-top link, and sits
 * exactly where it sat (fixed, 45px from the bottom-right corner).
 *
 * The chat opens with the CURRENT PAGE URL as the entire message and nothing else — no
 * greeting, no template text. `text` is the encoded absolute URL of whatever route the
 * visitor is on, recomputed on every navigation because it is derived from
 * `useLocation()` in render rather than captured once. The rest of the WhatsApp URL is
 * fixed and must stay exactly as given:
 *
 *   https://api.whatsapp.com/send/?phone=918788605592&text=<encoded page url>&type=phone_number&app_absent=0
 *
 * The origin is FIXED to the public site address, not taken from `window.location`: the
 * client wants the message to carry the real store URL even when the page is being viewed
 * on localhost or a staging host, so only the path and query are taken from the browser.
 *
 * Styled inline rather than through style.css on purpose: the theme stylesheet is served
 * with a 30-day cache, and a control that must be right on first paint should not depend
 * on a version bump reaching every browser.
 */
const PHONE = '918788605592'
const SITE_ORIGIN = 'https://thepurplepanther.in'

export default function WhatsAppButton() {
  const { pathname, search } = useLocation()

  const pageUrl = `${SITE_ORIGIN}${pathname}${search}`
  const href =
    `https://api.whatsapp.com/send/?phone=${PHONE}` +
    `&text=${encodeURIComponent(pageUrl)}` +
    `&type=phone_number&app_absent=0`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      title="Chat with us on WhatsApp"
      style={{
        position: 'fixed',
        right: '45px',
        bottom: '45px',
        zIndex: 999,
        width: '56px',
        height: '56px',
        display: 'block',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
        lineHeight: 0,
      }}
    >
      {/* The brand icon the client supplied (client/public/images/brand); served straight
          from Vite's public dir — /images is not one of the proxied prefixes. */}
      <img
        src="/images/brand/whatsapp-icon-free-png.webp"
        alt=""
        width="56"
        height="56"
        style={{ width: '56px', height: '56px', borderRadius: '12px', display: 'block' }}
      />
    </a>
  )
}
