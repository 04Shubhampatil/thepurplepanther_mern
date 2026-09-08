import { Link, useLocation } from 'react-router-dom'

/**
 * vendor/pagination/frontend.blade.php — Laravel's paginator window, reproduced.
 *
 * The window is Laravel's default "on each side = 3": first and last pages always shown,
 * three either side of the current one, and a literal "..." span where the run breaks.
 * Disabled Prev/Next are `<span class="page-btn disabled">`, not links — the theme styles
 * the two differently and a disabled anchor would still be clickable.
 */
function pageWindow(current, last, onEachSide = 3) {
  if (last <= onEachSide * 2 + 6) {
    return Array.from({ length: last }, (_, i) => i + 1)
  }

  const pages = []
  const push = (value) => {
    if (pages[pages.length - 1] !== value) pages.push(value)
  }

  for (let page = 1; page <= 2; page += 1) push(page)
  if (current - onEachSide > 3) push('...')
  for (let page = Math.max(3, current - onEachSide); page <= Math.min(last - 2, current + onEachSide); page += 1) {
    push(page)
  }
  if (current + onEachSide < last - 2) push('...')
  for (let page = last - 1; page <= last; page += 1) push(page)

  return pages
}

export default function CollectionPagination({ page, lastPage }) {
  const { pathname, search } = useLocation()

  if (lastPage <= 1) return null

  const href = (target) => {
    const params = new URLSearchParams(search)
    if (target === 1) params.delete('page')
    else params.set('page', String(target))
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }

  return (
    <nav
      className="collection-pagination d-flex flex-wrap align-items-center justify-content-center gap-2"
      role="navigation"
      aria-label="Pagination"
    >
      {page <= 1 ? (
        <span className="page-btn disabled">Prev</span>
      ) : (
        <Link className="page-btn" to={href(page - 1)} rel="prev">Prev</Link>
      )}

      {pageWindow(page, lastPage).map((entry, index) =>
        entry === '...' ? (
          <span className="page-btn disabled" key={`gap-${index}`}>...</span>
        ) : entry === page ? (
          <span className="page-btn active" aria-current="page" key={entry}>{entry}</span>
        ) : (
          <Link className="page-btn" to={href(entry)} key={entry}>{entry}</Link>
        ),
      )}

      {page < lastPage ? (
        <Link className="page-btn" to={href(page + 1)} rel="next">Next</Link>
      ) : (
        <span className="page-btn disabled">Next</span>
      )}
    </nav>
  )
}
