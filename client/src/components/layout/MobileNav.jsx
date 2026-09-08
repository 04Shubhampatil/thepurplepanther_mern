import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfigStore } from '../../store/index.js'

/**
 * frontend/partials/mobile-menu.blade.php — the `<nav id="menu">` mmenu takes over.
 *
 * This one partial is built imperatively rather than rendered, and that is deliberate:
 * mmenu PREPENDS `#menu` to `<body>`, moving it out of the React tree entirely. A node
 * React believes it owns, living under a parent React never gave it, is how you get a
 * `removeChild` crash on the next unmount — and any re-render would also be fighting the
 * `.mm-*` structure mmenu builds inside it.
 *
 * So React builds the markup once, hands it over, and never touches it again. The links
 * stay plain `<a href>` exactly as Blade emitted them; a delegated listener turns them
 * back into client-side navigation, since a moved node is outside React's event root and
 * would otherwise reload the whole document.
 */
export default function MobileNav() {
  const categories = useConfigStore((s) => s.categories)
  const navigate = useNavigate()

  useEffect(() => {
    if (document.getElementById('menu')) return

    const accessories = categories.find((c) => c.slug === 'accessories')

    const nav = document.createElement('nav')
    nav.id = 'menu'
    nav.innerHTML = `
  <ul>
    <li><a href="/">HOME</a></li>
    <li><a href="/collection">COLLECTION</a></li>
    <li><a href="${accessories ? accessories.url : '/shop'}">ACCESSORIES</a></li>
    <li><a href="/about">OUR STORY</a></li>
    <li><a href="/support">CUSTOMER SUPPORT</a></li>
  </ul>`

    document.body.appendChild(nav)
  }, [categories])

  // mmenu's own header/footer links (logo, account, bag) are built by script.js and land in
  // the same detached tree, so the listener covers the whole menu rather than just the list.
  useEffect(() => {
    function onClick(event) {
      const link = event.target.closest('#menu a, .mm-menu a, .mm-navbars-top a, .mm-navbars-bottom a')
      if (!link) return

      const href = link.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('http') || link.target === '_blank') return

      event.preventDefault()
      window.jQuery?.('#menu').data('mmenu')?.close()
      navigate(href)
    }

    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [navigate])

  return null
}
