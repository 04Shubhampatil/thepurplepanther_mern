import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as api from '../../services/endpoints.js'
import Money from '../common/Money.jsx'

/**
 * Type-ahead search.
 *
 * Debounced, and the server returns nothing below 2 characters without querying — so an
 * empty box never scans the product table. Stale responses are discarded by sequence
 * number, which stops a slow early request overwriting a fast later one.
 */
export default function SearchBox({ onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const sequence = useRef(0)
  const navigate = useNavigate()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return undefined
    }

    const id = sequence.current + 1
    sequence.current = id
    setLoading(true)

    const timer = setTimeout(async () => {
      try {
        const data = await api.catalog.search(query)
        if (id === sequence.current) setResults(data.products ?? [])
      } catch {
        if (id === sequence.current) setResults([])
      } finally {
        if (id === sequence.current) setLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [query])

  const submit = (event) => {
    event.preventDefault()
    if (query.trim()) {
      navigate(`/shop?q=${encodeURIComponent(query.trim())}`)
      onClose?.()
    }
  }

  return (
    <div className="pp-search" role="search">
      <form onSubmit={submit}>
        <label htmlFor="pp-search-input" className="sr-only">
          Search products
        </label>
        <input
          id="pp-search-input"
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className="form-control"
        />
        <button type="button" onClick={onClose} aria-label="Close search">
          ×
        </button>
      </form>

      {query.trim().length >= 2 && (
        <div className="pp-search__results" role="listbox" aria-label="Search results">
          {loading && <p style={{ padding: 12, opacity: 0.6 }}>Searching…</p>}

          {!loading && results.length === 0 && (
            <p style={{ padding: 12, opacity: 0.6 }}>No products found.</p>
          )}

          {results.map((product) => (
            <Link key={product.id} to={product.url} onClick={onClose} className="pp-search__result">
              <img src={product.image} alt="" width="48" height="64" loading="lazy" />
              <span>{product.title}</span>
              <Money formatted={product.priceFormatted} />
            </Link>
          ))}

          {results.length > 0 && (
            <Link to={`/shop?q=${encodeURIComponent(query.trim())}`} onClick={onClose}>
              See all results
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
