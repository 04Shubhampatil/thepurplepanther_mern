import { Link, useSearchParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import Pagination from '../../components/common/Pagination.jsx'
import Loading from '../../components/common/Loading.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import Seo from '../../components/common/Seo.jsx'
import BannerMedia from '../../components/common/BannerMedia.jsx'
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

  const { newsTypes = [], activeType, featuredPost, posts = [], pagination, journalBanner } = data ?? {}

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

  return (
    <div className="pp-journal">
      <Seo title="Journal" description="Stories, notes and news from The Purple Panther." />

      {journalBanner?.images?.[0] && (
        <BannerMedia
          src={journalBanner.images[0].image}
          mobileSrc={journalBanner.images[0].mobileImage}
          alt={journalBanner.title ?? ''}
          eager
        />
      )}

      <div className="container" style={{ padding: '32px 0' }}>
        <h1>{activeType?.title ?? 'Journal'}</h1>

        <nav aria-label="Journal categories" style={{ margin: '16px 0 32px' }}>
          <ul style={{ display: 'flex', gap: 14, listStyle: 'none', padding: 0, flexWrap: 'wrap' }}>
            <li>
              <button type="button" onClick={() => setType('')} className={!type ? 'is-active' : ''}>
                All
              </button>
            </li>
            {newsTypes.map((newsType) => (
              <li key={newsType.id}>
                <button
                  type="button"
                  onClick={() => setType(newsType.slug)}
                  className={type === newsType.slug ? 'is-active' : ''}
                >
                  {newsType.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {featuredPost && (
          <article className="pp-journal__featured" style={{ marginBottom: 40 }}>
            <Link to={`/blog/${featuredPost.slug}`}>
              <img src={featuredPost.image} alt="" style={{ width: '100%' }} />
              <h2>{featuredPost.title}</h2>
            </Link>
            <p style={{ opacity: 0.7, fontSize: 13 }}>
              {featuredPost.newsType?.title} · {formatDate(featuredPost.publishedAt)}
            </p>
            {featuredPost.excerpt && <p>{featuredPost.excerpt}</p>}
          </article>
        )}

        <div className="row">
          {posts.map((post) => (
            <div className="col-md-4 col-sm-6" key={post.id}>
              <article style={{ marginBottom: 32 }}>
                <Link to={`/blog/${post.slug}`}>
                  <img src={post.image} alt="" style={{ width: '100%' }} loading="lazy" />
                  <h3 style={{ fontSize: 17, marginTop: 10 }}>{post.title}</h3>
                </Link>
                <p style={{ opacity: 0.6, fontSize: 13 }}>
                  {post.newsType?.title} · {formatDate(post.publishedAt)}
                </p>
                {post.excerpt && <p style={{ opacity: 0.8 }}>{post.excerpt}</p>}
              </article>
            </div>
          ))}
        </div>

        {posts.length === 0 && !featuredPost && (
          <p style={{ opacity: 0.7 }}>No stories published yet.</p>
        )}

        <Pagination pagination={pagination} onPage={goToPage} />
      </div>
    </div>
  )
}
