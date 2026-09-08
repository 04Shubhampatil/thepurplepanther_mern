import { useParams, Link } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import Loading from '../../components/common/Loading.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import Seo from '../../components/common/Seo.jsx'
import NotFound from '../NotFound.jsx'
import { formatDate, stripTags, truncate } from '../../utils/format.js'

export default function BlogPost() {
  const { slug } = useParams()
  const { data, error, loading, refetch } = useApi(() => api.cms.post(slug), [slug])

  if (error?.status === 404) return <NotFound />
  if (loading && !data) return <Loading full />
  if (error) return <ErrorMessage error={error} onRetry={refetch} />
  if (!data?.post) return <NotFound />

  const { post, relatedPosts = [], prevPost, nextPost } = data

  return (
    <article className="pp-journal-post">
      <Seo
        title={post.title}
        description={post.excerpt ?? truncate(stripTags(post.content), 160)}
      />

      {(post.bannerImage || post.image) && (
        <img src={post.bannerImage ?? post.image} alt="" style={{ width: '100%', display: 'block' }} />
      )}

      <div className="container" style={{ maxWidth: 760, padding: '32px 0' }}>
        <p style={{ opacity: 0.6, fontSize: 13 }}>
          {post.newsType?.title} · {formatDate(post.publishedAt)} · {post.authorName}
        </p>

        <h1>{post.title}</h1>

        {post.excerpt && <p style={{ fontSize: 18, opacity: 0.85 }}>{post.excerpt}</p>}

        {/* CMS content is authored by admins in the panel, not by the public. */}
        {post.content && (
          <div className="pp-journal-post__body" dangerouslySetInnerHTML={{ __html: post.content }} />
        )}

        <nav
          style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40 }}
          aria-label="Post navigation"
        >
          {prevPost ? <Link to={`/blog/${prevPost.slug}`}>← {prevPost.title}</Link> : <span />}
          {nextPost ? <Link to={`/blog/${nextPost.slug}`}>{nextPost.title} →</Link> : <span />}
        </nav>
      </div>

      {relatedPosts.length > 0 && (
        <div className="container" style={{ padding: '32px 0' }}>
          <h2>More stories</h2>
          <div className="row">
            {relatedPosts.map((related) => (
              <div className="col-md-6" key={related.id}>
                <Link to={`/blog/${related.slug}`}>
                  <img src={related.image} alt="" style={{ width: '100%' }} loading="lazy" />
                  <h3 style={{ fontSize: 17 }}>{related.title}</h3>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}
