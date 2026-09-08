import { Link, useSearchParams } from 'react-router-dom'

/** Page links that preserve every other query parameter, like Laravel's withQueryString(). */
export default function Pagination({ pagination, onPage = null }) {
  const [searchParams] = useSearchParams()
  if (!pagination || pagination.lastPage <= 1) return null

  const { page, lastPage } = pagination
  const pages = []
  const from = Math.max(1, page - 2)
  const to = Math.min(lastPage, from + 4)
  for (let i = from; i <= to; i += 1) pages.push(i)

  const hrefFor = (n) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(n))
    return `?${next.toString()}`
  }

  const Item = ({ n, label = null, disabled = false }) => {
    const content = label ?? n
    if (disabled) {
      return (
        <li className="page-item disabled">
          <span className="page-link">{content}</span>
        </li>
      )
    }
    return (
      <li className={`page-item ${n === page ? 'active' : ''}`}>
        {onPage ? (
          <button type="button" className="page-link" onClick={() => onPage(n)}>
            {content}
          </button>
        ) : (
          <Link className="page-link" to={hrefFor(n)}>
            {content}
          </Link>
        )}
      </li>
    )
  }

  return (
    <nav aria-label="Pagination">
      <ul className="pagination">
        <Item n={page - 1} label="Previous" disabled={page <= 1} />
        {pages.map((n) => (
          <Item key={n} n={n} />
        ))}
        <Item n={page + 1} label="Next" disabled={page >= lastPage} />
      </ul>
    </nav>
  )
}
