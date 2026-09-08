import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Search, ArrowRight } from 'lucide-react'
import Drawer from '../ui/Drawer.jsx'
import Image from '../ui/Image.jsx'
import { Skeleton } from '../ui/Skeleton.jsx'
import * as api from '../../services/endpoints.js'

/**
 * Search panel.
 *
 * Debounced at 250ms, and the server returns nothing below two characters without
 * querying — so typing in an empty box never scans the product table.
 *
 * Responses are discarded by sequence number, which stops a slow early request
 * overwriting a fast later one and showing results for a query the customer has already
 * moved past.
 */
export default function SearchDrawer({ open, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const sequence = useRef(0)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
    }
  }, [open])

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      setLoading(false)
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
    if (!query.trim()) return
    navigate(`/shop?q=${encodeURIComponent(query.trim())}`)
    onClose()
  }

  const showEmpty = query.trim().length >= 2 && !loading && results.length === 0

  return (
    <Drawer open={open} onClose={onClose} title="Search" widthClass="w-full max-w-[520px]">
      <div className="px-6 py-6">
        <form onSubmit={submit} role="search">
          <label htmlFor="site-search" className="sr-only">
            Search products
          </label>
          <div className="flex items-center gap-3 border-b border-ink pb-3">
            <Search size={20} strokeWidth={1.5} aria-hidden="true" className="text-body" />
            <input
              id="site-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What are you looking for?"
              autoComplete="off"
              className="w-full bg-transparent text-[15px] text-ink placeholder:text-body/60 focus:outline-none"
            />
          </div>
        </form>

        <div className="mt-6" aria-live="polite">
          {loading && (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-[84px] w-[64px]" />
                  <div className="flex-1 space-y-2 py-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3.5 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {showEmpty && (
            <p className="py-8 text-center text-body">
              No products match “{query.trim()}”.
            </p>
          )}

          <AnimatePresence>
            {!loading && results.length > 0 && (
              <motion.ul
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="divide-y divide-line"
              >
                {results.map((product, index) => (
                  <motion.li
                    key={product.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.25 }}
                  >
                    <Link
                      to={product.url}
                      onClick={onClose}
                      className="group flex items-center gap-4 py-3"
                    >
                      <Image
                        src={product.image}
                        alt=""
                        ratio="product"
                        className="w-[64px] shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] text-ink transition-colors group-hover:text-brand">
                          {product.title}
                        </span>
                        <span className="block text-[13px] text-body">
                          {product.priceFormatted}
                        </span>
                      </span>
                    </Link>
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>

          {!loading && results.length > 0 && (
            <Link
              to={`/shop?q=${encodeURIComponent(query.trim())}`}
              onClick={onClose}
              className="group mt-6 inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink hover:text-brand"
            >
              See all results
              <ArrowRight
                size={16}
                strokeWidth={1.5}
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
          )}
        </div>
      </div>
    </Drawer>
  )
}
