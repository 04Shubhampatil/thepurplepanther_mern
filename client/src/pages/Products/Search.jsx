import { Navigate, useSearchParams } from 'react-router-dom'

/**
 * Laravel's /search returned JSON for the type-ahead; the browsable results page was
 * /shop?q=. This route preserves the URL and forwards to the listing, so an inbound link
 * to /search?q=… still lands somewhere useful.
 */
export default function Search() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  return <Navigate to={query ? `/shop?q=${encodeURIComponent(query)}` : '/shop'} replace />
}
