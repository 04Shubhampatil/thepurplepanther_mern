import { useEffect } from 'react'

/**
 * Detach the storefront's stylesheets while the admin panel is mounted.
 *
 * index.html loads bootstrap.min.css, style.css, custom.css, site-drawers.css and
 * journal.css for the storefront, and they are ~2.3MB of rules written against a theme the
 * admin has nothing to do with. The Laravel admin loaded ONLY its own admin.css; leaving
 * the theme attached means Bootstrap restyling every admin button, table and form control
 * and the parity this rebuild is measured against quietly failing.
 *
 * Disabling the <link> elements rather than removing them keeps this instant and exactly
 * reversible: the browser has already parsed them, `disabled = false` on the way out costs
 * nothing, and the storefront never sees a flash of unstyled content the way it would if
 * these were loaded on demand instead.
 */
const THEME_SHEET = 'link[rel="stylesheet"][href^="/frontend/css/"]'

export function useAdminStylesheets() {
  useEffect(() => {
    const sheets = Array.from(document.querySelectorAll(THEME_SHEET))
    const previous = sheets.map((sheet) => sheet.disabled)

    sheets.forEach((sheet) => {
      sheet.disabled = true
    })

    // The admin has its own background; the storefront's body classes would fight it.
    const bodyClass = document.body.className
    document.body.className = 'admin-body'

    return () => {
      sheets.forEach((sheet, index) => {
        sheet.disabled = previous[index]
      })
      document.body.className = bodyClass
    }
  }, [])
}

export default useAdminStylesheets
