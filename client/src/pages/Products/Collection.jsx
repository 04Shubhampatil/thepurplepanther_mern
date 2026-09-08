import { useSearchParams, Link } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import { useConfigStore } from '../../store/index.js'
import ProductGrid from '../../components/product/ProductGrid.jsx'
import Pagination from '../../components/common/Pagination.jsx'
import Loading from '../../components/common/Loading.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import Seo from '../../components/common/Seo.jsx'
import NotFound from '../NotFound.jsx'

/**
 * Product listing — serves /shop, /collection and every clean category URL.
 *
 * One component for all three, as `FrontendController::collection` was one method:
 *   /shop                 -> no category filter
 *   /collection           -> the "collection" category
 *   /{categorySlug}       -> that category
 *
 * Filtering and pagination live in the query string, so a filtered view is linkable and
 * survives a refresh — the same behaviour Laravel's withQueryString() gave.
 */
export default function Collection({ categorySlug = null }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const categories = useConfigStore((s) => s.categories)

  const search = searchParams.get('q') ?? searchParams.get('search') ?? ''
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10) || 1

  const { data, error, loading, refetch } = useApi(
    () => api.catalog.products({ category: categorySlug, q: search, page }),
    [categorySlug, search, page],
  )

  // The server 404s an unknown or inactive category slug, matching Laravel's abort(404).
  if (error?.status === 404) return <NotFound />
  if (loading && !data) return <Loading full />
  if (error) return <ErrorMessage error={error} onRetry={refetch} />

  const { products = [], activeCategory, pagination } = data ?? {}
  const title = activeCategory?.title ?? (search ? `Search: ${search}` : 'Shop')

  const goToPage = (next) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(next))
    setSearchParams(params)
  }

  return (
    <div className="container pp-collection">
      <Seo
        title={title}
        description={activeCategory?.shortDescription ?? `Shop ${title} at The Purple Panther.`}
      />

      <header className="pp-collection__head" style={{ padding: '32px 0' }}>
        <h1>{title}</h1>
        {activeCategory?.shortDescription && (
          <p style={{ opacity: 0.75 }}>{activeCategory.shortDescription}</p>
        )}
        {pagination && (
          <p style={{ opacity: 0.6, fontSize: 14 }}>
            {pagination.total} product{pagination.total === 1 ? '' : 's'}
          </p>
        )}
      </header>

      <nav className="pp-collection__filters" aria-label="Categories" style={{ marginBottom: 24 }}>
        <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 12, listStyle: 'none', padding: 0 }}>
          <li>
            <Link to="/shop" className={!categorySlug ? 'is-active' : ''}>
              All
            </Link>
          </li>
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                to={`/${category.slug}`}
                className={categorySlug === category.slug ? 'is-active' : ''}
              >
                {category.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {loading && <Loading />}

      <ProductGrid
        products={products}
        empty={search ? `No products match “${search}”.` : 'No products in this collection yet.'}
      />

      <div style={{ padding: '32px 0' }}>
        <Pagination pagination={pagination} onPage={goToPage} />
      </div>
    </div>
  )
}
