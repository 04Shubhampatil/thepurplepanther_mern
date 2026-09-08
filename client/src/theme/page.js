import { useEffect } from 'react'

/**
 * `<body class="...">` per page.
 *
 * Blade set this on the document and it is not decorative: `.collection-template`,
 * `.product-detail-page`, `.pp-auth-page` and the rest each carry page-scoped rules in
 * style.css and custom.css. The homepage's `home21-type` is the default in index.html, so
 * it is removed while another page is mounted and restored on the way out.
 */
const DEFAULT_BODY_CLASS = 'home21-type'

export function useBodyClass(...classes) {
  const key = classes.filter(Boolean).join(' ')

  useEffect(() => {
    const applied = key.split(' ').filter(Boolean)
    if (applied.length === 0) return undefined

    document.body.classList.remove(DEFAULT_BODY_CLASS)
    document.body.classList.add(...applied)

    return () => {
      document.body.classList.remove(...applied)
      document.body.classList.add(DEFAULT_BODY_CLASS)
    }
  }, [key])
}

/**
 * `<title>` and the meta description, which Blade rendered server-side per page.
 *
 * Titles are set from the page's own data, so the browser tab and history match what
 * Laravel produced. Search engines that do not run JavaScript will not see these — that
 * gap is tracked as a pre-cutover SSR task in docs/migration-status.md, not solved here.
 */
export function usePageTitle(title, description) {
  useEffect(() => {
    if (!title) return undefined

    const previous = document.title
    document.title = title

    const meta = document.querySelector('meta[name="description"]')
    const previousDescription = meta?.getAttribute('content')
    if (meta && description) meta.setAttribute('content', description)

    return () => {
      document.title = previous
      if (meta && previousDescription !== undefined && previousDescription !== null) {
        meta.setAttribute('content', previousDescription)
      }
    }
  }, [title, description])
}

/**
 * A stylesheet only one page needs.
 *
 * beyond-ordinary.blade.php is the only page that loads beyond-ordinary.css, and its rules
 * are written to win against style.css. Loading it globally would leak those overrides onto
 * every other page, so the <link> is added on mount and removed on unmount — and reference
 * counted, because React can mount the next page before unmounting the last and a naive
 * remove would strip the sheet from under it.
 */
const sheetUsers = new Map()

export function usePageStylesheet(href) {
  useEffect(() => {
    if (!href) return undefined

    const count = sheetUsers.get(href) ?? 0
    sheetUsers.set(href, count + 1)

    if (count === 0) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      link.dataset.pageStylesheet = href
      document.head.appendChild(link)
    }

    return () => {
      const remaining = (sheetUsers.get(href) ?? 1) - 1
      sheetUsers.set(href, remaining)
      if (remaining > 0) return

      document.head.querySelector(`link[data-page-stylesheet="${href}"]`)?.remove()
    }
  }, [href])
}
