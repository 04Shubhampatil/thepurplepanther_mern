import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Page navigation. Uses buttons because the parent owns the query string. */
export default function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.lastPage <= 1) return null

  const { page, lastPage } = pagination
  const from = Math.max(1, Math.min(page - 2, lastPage - 4))
  const to = Math.min(lastPage, from + 4)
  const pages = []
  for (let i = from; i <= to; i += 1) pages.push(i)

  const base =
    'grid size-10 place-items-center border text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-30'

  return (
    <nav aria-label="Pagination">
      <ul className="flex items-center justify-center gap-2">
        <li>
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className={`${base} border-line text-ink hover:border-brand hover:text-brand`}
          >
            <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </li>

        {pages.map((n) => (
          <li key={n}>
            <button
              type="button"
              onClick={() => onPage(n)}
              aria-label={`Page ${n}`}
              aria-current={n === page ? 'page' : undefined}
              className={`${base} ${
                n === page
                  ? 'border-brand bg-brand text-white'
                  : 'border-line text-ink hover:border-brand hover:text-brand'
              }`}
            >
              {n}
            </button>
          </li>
        ))}

        <li>
          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={page >= lastPage}
            aria-label="Next page"
            className={`${base} border-line text-ink hover:border-brand hover:text-brand`}
          >
            <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </li>
      </ul>
    </nav>
  )
}
