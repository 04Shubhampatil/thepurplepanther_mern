import { Link, useSearchParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import Pagination from '../../components/common/Pagination.jsx'
import Loading from '../../components/common/Loading.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import Seo from '../../components/common/Seo.jsx'
import Image from '../../components/ui/Image.jsx'
import Container from '../../components/ui/Container.jsx'
import { formatDate } from '../../utils/format.js'

/**
 * Journal index.
 *
 * The featured post is chosen by the server and excluded from the paginated list, so it
 * never appears twice. An unknown `?type=` falls through to all posts rather than 404ing,
 * matching Laravel.
 */
export default function Blog() {
  const [searchParams, setSearchParams] = useSearchParams()
  const type = searchParams.get('type') ?? ''
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10) || 1

  const { data, error, loading, refetch } = useApi(
    () => api.cms.blog({ type: type || undefined, page }),
    [type, page],
  )

  if (loading && !data) return <Loading full />
  if (error) return <ErrorMessage error={error} onRetry={refetch} />

  const {
    newsTypes = [],
    activeType,
    featuredPost,
    posts = [],
    pagination,
    journalBanner,
  } = data ?? {}

  const setType = (slug) => {
    const params = new URLSearchParams()
    if (slug) params.set('type', slug)
    setSearchParams(params)
  }

  const goToPage = (next) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(next))
    setSearchParams(params)
  }

  const filterClass = (isActive) =>
    [
      'border-b pb-1 text-[13px] uppercase tracking-[0.1em] transition-colors',
      isActive ? 'border-brand text-brand' : 'border-transparent text-body hover:text-ink',
    ].join(' ')

  const meta = (post) =>
    [post.newsType?.title, post.publishedAt ? formatDate(post.publishedAt) : null]
      .filter(Boolean)
      .join(' · ')

  return (
    <div>
      <Seo title="Journal" description="Stories, notes and news from The Purple Panther." />

      {journalBanner?.images?.[0] && (
        <Image
          src={journalBanner.images[0].image}
          alt={journalBanner.title ?? ''}
          ratio="auto"
          eager
          className="h-[42vh] min-h-[260px] w-full md:h-[52vh]"
        />
      )}

      <Container className="py-10 md:py-14">
        <h1 className="pp-heading">{activeType?.title ?? 'Journal'}</h1>

        <nav aria-label="Journal categories" className="mt-6">
          <ul className="-mx-4 flex gap-6 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
            <li className="shrink-0">
              <button type="button" onClick={() => setType('')} className={filterClass(!type)}>
                All
              </button>
            </li>
            {newsTypes.map((newsType) => (
              <li key={newsType.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setType(newsType.slug)}
                  className={filterClass(type === newsType.slug)}
                >
                  {newsType.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {featuredPost && (
          <article className="mt-10 grid gap-6 md:mt-12 md:grid-cols-2 md:items-center md:gap-10">
            <Link to={`/blog/${featuredPost.slug}`} className="group block" tabIndex={-1}>
              <Image
                src={featuredPost.image}
                alt=""
                ratio="wide"
                eager
                imgClassName="transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </Link>

            <div>
              <p className="pp-eyebrow text-brand">Featured</p>
              <h2 className="pp-heading mt-2">
                <Link
                  to={`/blog/${featuredPost.slug}`}
                  className="transition-colors hover:text-brand"
                >
                  {featuredPost.title}
                </Link>
              </h2>
              <p className="mt-2 text-[13px] text-body">{meta(featuredPost)}</p>
              {featuredPost.excerpt && (
                <p className="mt-3 text-body">{featuredPost.excerpt}</p>
              )}
              <Link
                to={`/blog/${featuredPost.slug}`}
                className="mt-4 inline-block text-[13px] uppercase tracking-[0.1em] text-ink underline underline-offset-4 transition-colors hover:text-brand"
              >
                Read the story
                <span className="sr-only">: {featuredPost.title}</span>
              </Link>
            </div>
          </article>
        )}

        {posts.length > 0 && (
          <ul className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <li key={post.id}>
                <article>
                  <Link to={`/blog/${post.slug}`} className="group block">
                    <Image
                      src={post.image}
                      alt=""
                      ratio="wide"
                      imgClassName="transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <h3 className="mt-3 text-[17px] font-semibold leading-snug text-ink transition-colors group-hover:text-brand">
                      {post.title}
                    </h3>
                  </Link>
                  <p className="mt-1 text-[13px] text-body">{meta(post)}</p>
                  {post.excerpt && <p className="mt-2 line-clamp-3 text-body">{post.excerpt}</p>}
                </article>
              </li>
            ))}
          </ul>
        )}

        {posts.length === 0 && !featuredPost && (
          <p className="mt-10 text-body">No stories published yet.</p>
        )}

        <Pagination pagination={pagination} onPage={goToPage} />
      </Container>
    </div>
  )
}
