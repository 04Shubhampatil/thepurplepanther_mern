import { useEffect } from 'react'

/**
 * Per-page document metadata.
 *
 * SEO parity matters: Laravel rendered <title> and meta description server-side from
 * `products.seo_title` / `meta_description`. A SPA sets them after mount, which crawlers
 * that execute JavaScript will pick up, but it is NOT equivalent for those that do not.
 *
 * Recorded as a known limitation in docs/migration-status.md — the durable fix is SSR or
 * prerendering for product and category pages before cutover.
 */
export default function Seo({ title, description = null, keywords = null, noIndex = false, canonical = null }) {
  useEffect(() => {
    const appName = 'The Purple Panther'
    document.title = title ? `${title} — ${appName}` : appName

    const setMeta = (selector, attrs) => {
      let tag = document.head.querySelector(selector)
      if (!tag) {
        tag = document.createElement('meta')
        Object.entries(attrs.identity).forEach(([k, v]) => tag.setAttribute(k, v))
        document.head.appendChild(tag)
      }
      tag.setAttribute('content', attrs.content)
      return tag
    }

    if (description) {
      setMeta('meta[name="description"]', {
        identity: { name: 'description' },
        content: description,
      })
    }
    if (keywords) {
      setMeta('meta[name="keywords"]', { identity: { name: 'keywords' }, content: keywords })
    }
    setMeta('meta[name="robots"]', {
      identity: { name: 'robots' },
      content: noIndex ? 'noindex,nofollow' : 'index,follow',
    })

    // Open Graph, so shared links keep their preview.
    setMeta('meta[property="og:title"]', {
      identity: { property: 'og:title' },
      content: title ?? appName,
    })
    if (description) {
      setMeta('meta[property="og:description"]', {
        identity: { property: 'og:description' },
        content: description,
      })
    }

    let link = document.head.querySelector('link[rel="canonical"]')
    if (!link) {
      link = document.createElement('link')
      link.setAttribute('rel', 'canonical')
      document.head.appendChild(link)
    }
    link.setAttribute('href', canonical ?? window.location.href.split('?')[0])
  }, [title, description, keywords, noIndex, canonical])

  return null
}
