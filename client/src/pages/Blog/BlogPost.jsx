import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import Loading from '../../components/common/Loading.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import Seo from '../../components/common/Seo.jsx'
import NotFound from '../NotFound.jsx'
import Container from '../../components/ui/Container.jsx'
import Image from '../../components/ui/Image.jsx'
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
    <article>
      <Seo
        title={post.title}
        description={post.excerpt ?? truncate(stripTags(post.content), 160)}
      />

      {(post.bannerImage || post.image) && (
        <Image
          src={post.bannerImage ?? post.image}
          alt=""
          ratio="auto"
          eager
          className="h-[40vh] min-h-[240px] w-full md:h-[56vh]"
        />
      )}

      <Container className="py-10 md:py-14">
        <div className="mx-auto max-w-[760px]">
          <p className="pp-eyebrow text-brand">
            {[post.newsType?.title, post.publishedAt ? formatDate(post.publishedAt) : null]
              .filter(Boolean)
              .join(' · ')}
          </p>

          <h1 className="pp-heading mt-3">{post.title}</h1>

          {post.authorName && (
            <p className="mt-2 text-[13px] text-body">By {post.authorName}</p>
          )}

          {post.excerpt && (
            <p className="mt-5 border-l-2 border-brand pl-5 text-[17px] leading-relaxed text-ink">
              {post.excerpt}
            </p>
          )}

          {/* CMS content is authored by admins in the panel, not by the public.
              `.pp-prose` restores the typography Tailwind's Preflight strips. */}
          {post.content && (
            <div
              className="pp-prose mt-8"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          )}

          <nav
            aria-label="Post navigation"
            className="mt-12 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-start sm:justify-between"
          >
            {prevPost ? (
              <Link
                to={`/blog/${prevPost.slug}`}
                className="group flex max-w-xs items-start gap-2 text-[14px] text-ink transition-colors hover:text-brand"
              >
                <ArrowLeft
                  size={16}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className="mt-1 shrink-0"
                />
                <span>
                  <span className="pp-eyebrow block text-body">Previous</span>
                  {prevPost.title}
                </span>
              </Link>
            ) : (
              <span />
            )}

            {nextPost ? (
              <Link
                to={`/blog/${nextPost.slug}`}
                className="group flex max-w-xs items-start gap-2 text-[14px] text-ink transition-colors hover:text-brand sm:text-right"
              >
                <span className="sm:order-1">
                  <span className="pp-eyebrow block text-body">Next</span>
                  {nextPost.title}
                </span>
                <ArrowRight
                  size={16}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className="mt-1 shrink-0 sm:order-2"
                />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </div>
      </Container>

      {relatedPosts.length > 0 && (
        <Container className="pb-14 md:pb-20">
          <h2 className="pp-heading">More stories</h2>

          <ul className="mt-6 grid gap-x-6 gap-y-8 sm:grid-cols-2">
            {relatedPosts.map((related) => (
              <li key={related.id}>
                <Link to={`/blog/${related.slug}`} className="group block">
                  <Image
                    src={related.image}
                    alt=""
                    ratio="wide"
                    imgClassName="transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <h3 className="mt-3 text-[17px] font-semibold leading-snug text-ink transition-colors group-hover:text-brand">
                    {related.title}
                  </h3>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      )}
    </article>
  )
}
