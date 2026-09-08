/**
 * The bottom-centre toast from wishlist-toggle.js and cart.js.
 *
 * Deliberately still a detached DOM node rather than React state: it is called from
 * anywhere, outlives the component that triggered it, and the theme has no stylesheet rule
 * for it — the inline styles below are the original's, copied so it looks the same.
 */
const TOAST_ID = 'pp-wishlist-toast'
const STYLE =
  'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;' +
  'background:#3a1651;color:#fff;padding:12px 18px;font-size:14px;border-radius:4px;' +
  'box-shadow:0 8px 24px rgba(0,0,0,.2);'

let hideTimer = null

export function toast(message) {
  let el = document.getElementById(TOAST_ID)

  if (!el) {
    el = document.createElement('div')
    el.id = TOAST_ID
    el.style.cssText = STYLE
    document.body.appendChild(el)
  }

  el.textContent = message
  el.hidden = false

  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    el.hidden = true
  }, 2500)
}

export default toast
