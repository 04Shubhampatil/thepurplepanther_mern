import { useSearchParams, NavLink } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import { useConfigStore } from '../../store/index.js'
import ProductGrid from '../../components/product/ProductGrid.jsx'
import Pagination from '../../components/common/Pagination.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import Seo from '../../components/common/Seo.jsx'
import Container from '../../components/ui/Container.jsx'
import NotFound from '../NotFound.jsx'

/**
 * Product listing — serves /shop, /collection and every clean category URL.
 *
 * One component for all three, as `FrontendController::collection` was one method.
 * Filters and pagination live in the query string, so a filtered view is linkable and
 * survives a refresh.
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

  if (error) {
    return (
      <Container className="py-24">
        <ErrorMessage error={error} onRetry={refetch} />
      </Container>
    )
  }

  const { products = [], activeCategory, pagination } = data ?? {}
  const title = activeCategory?.title ?? (search ? `Search results` : 'Shop')

  const goToPage = (next) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(next))
    setSearchParams(params)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const filterLink = ({ isActive }) =>
    `whitespace-nowrap border-b-2 pb-1 text-[13px] uppercase tracking-[0.1em] transition-colors ${
      isActive ? 'border-brand text-brand' : 'border-transparent text-body hover:text-ink'
    }`

  return (
    <Container className="pb-16 pt-10 md:pt-14">
      <Seo
        title={title}
        description={
          activeCategory?.shortDescription ?? `Shop ${title} at The Purple Panther.`
        }
      />

      <header className="mb-8 md:mb-10">
        <h1 className="pp-heading">
          {title}
          {search && <span className="text-body"> — “{search}”</span>}
        </h1>

        {activeCategory?.shortDescription && (
          <p className="mt-2 max-w-xl text-body">{activeCategory.shortDescription}</p>
        )}

        {pagination && !loading && (
          <p className="mt-2 text-[13px] text-body">
            {pagination.total} product{pagination.total === 1 ? '' : 's'}
          </p>
        )}
      </header>

      <nav aria-label="Categories" className="mb-10 border-b border-line">
        <ul className="-mb-px flex gap-6 overflow-x-auto pb-px">
          <li>
            <NavLink to="/shop" end className={filterLink}>
              All
            </NavLink>
          </li>
          {categories.map((category) => (
            <li key={category.id}>
              <NavLink to={`/${category.slug}`} className={filterLink}>
                {category.title}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <ProductGrid
        products={products}
        loading={loading}
        skeletonCount={12}
        empty={
          search
            ? `No products match “${search}”.`
            : 'No products in this collection yet.'
        }
      />

      {pagination && pagination.lastPage > 1 && (
        <div className="mt-14">
          <Pagination pagination={pagination} onPage={goToPage} />
        </div>
      )}
    </Container>
  )
}
