import { useSearchParams, Link } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import { useConfigStore } from '../../store/index.js'
import CollectionGrid from '../../components/product/CollectionGrid.jsx'
import CollectionPagination from '../../components/common/CollectionPagination.jsx'
import Loading from '../../components/common/Loading.jsx'
import NotFound from '../NotFound.jsx'
import { useBodyClass, usePageTitle } from '../../theme/page.js'

/**
 * frontend/pages/collection.blade.php — serves /shop, /collection and every clean
 * category URL, as FrontendController::collection was one method for all three.
 *
 * Filters and the page number live in the query string, so a filtered view is linkable
 * and survives a refresh — which is also what the Blade page did, since its filter links
 * were plain hrefs.
 */
export default function Collection({ categorySlug = null }) {
  const [searchParams] = useSearchParams()
  const categories = useConfigStore((s) => s.categories)

  const search = searchParams.get('q') ?? searchParams.get('search') ?? ''
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10) || 1

  const { data, error, loading } = useApi(
    () => api.catalog.products({ category: categorySlug, q: search, page }),
    [categorySlug, search, page],
  )

  const activeCategory = data?.activeCategory ?? null
  const products = data?.products ?? []
  const newArrivals = data?.newArrivals ?? []
  const pagination = data?.pagination ?? { page: 1, lastPage: 1, total: 0, perPage: 50 }

  useBodyClass('collection-template')
  usePageTitle(
    activeCategory ? `${activeCategory.title} - The Purple Panther` : 'Collection - The Purple Panther',
  )

  // The server 404s an unknown or inactive category slug, matching Laravel's abort(404).
  if (error?.status === 404) return <NotFound />
  if (loading) return <Loading full />

  // Blade's `$products->firstItem()`/`lastItem()` — 1-based and clamped to the total.
  const firstItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.perPage + 1
  const lastItem = Math.min(pagination.page * pagination.perPage, pagination.total)

  // The "All" link keeps an active search, exactly as `route('shop', request()->only('q'))`.
  const withSearch = (base) => (search ? `${base}?q=${encodeURIComponent(search)}` : base)

  return (
    <main className="body_content_wrapper position-relative collection-page" id="main-content">
      <section className="collection-page__section" aria-labelledby="collection-title">
        <div className="container collection-page__inner">
          <header className="collection-page__heading">
            <h1 id="collection-title">{activeCategory?.title ?? 'Collection'}</h1>

            <nav className="collection-page__filters" aria-label="Shop by category">
              <Link to={withSearch('/shop')} className={!activeCategory ? 'is-active' : ''}>All</Link>
              {categories.map((category) => (
                <Link
                  to={withSearch(category.url)}
                  className={activeCategory?.id === category.id ? 'is-active' : ''}
                  key={category.id}
                >
                  {category.title}
                </Link>
              ))}
            </nav>

            {search && (
              <p className="collection-page__search-note mt-2 mb-0">Results for “{search}”</p>
            )}
          </header>

          <div className="collection-page__grid">
            <CollectionGrid products={products} />
          </div>

          {pagination.total > 0 && (
            <div className="collection-page__pagination pt60 pb30">
              <p className="collection-page__count mb-3">
                Showing {firstItem}–{lastItem} of {pagination.total} products
              </p>
              <CollectionPagination page={pagination.page} lastPage={pagination.lastPage} />
            </div>
          )}
        </div>
      </section>

      {newArrivals.length > 0 && (
        <section className="collection-page__section collection-page__section--new" aria-labelledby="new-products-title">
          <div className="container collection-page__inner">
            <header className="collection-page__heading">
              <h2 id="new-products-title">New Arrivals</h2>
            </header>
            <div className="collection-page__grid">
              <CollectionGrid products={newArrivals} />
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
