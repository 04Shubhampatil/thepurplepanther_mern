import { Link, useParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import Loading from '../../components/common/Loading.jsx'
import NotFound from '../NotFound.jsx'
import { useBodyClass, usePageTitle } from '../../theme/page.js'
import * as api from '../../services/endpoints.js'

/**
 * frontend/pages/blog-single.blade.php.
 *
 * The post body is stored HTML from the admin editor and Blade printed it with `{!! !!}`,
 * so it is rendered as HTML here too. That is the same trust boundary the source app has:
 * the content comes from an authenticated admin, not from customers.
 *
 * Prev/next walk by ID rather than publish date — the server's ordering, kept from Laravel
 * even though it can disagree with the list order.
 *
 * The literal "?" in the prev/next labels is in the Blade file itself (line 93 and 98): the
 * arrows were lost to a bad encoding at some point and the source now contains a question
 * mark. It is reproduced rather than guessed at, since guessing would change what ships.
 */
const INSTAGRAM = [1, 2, 3, 4, 5, 6, 7]

export default function BlogPost() {
  // blog.blade.php / blog-single.blade.php open with a bare `<body>`, like about. Keeping
  // `home21-type` would repaint the journal's headings in DM Sans — see useBodyClass.
  useBodyClass()
  const { slug } = useParams()
  const { data, error, loading } = useApi(() => api.cms.post(slug), [slug])

  const post = data?.post ?? null
  const relatedPosts = data?.relatedPosts ?? []
  const prevPost = data?.prevPost ?? null
  const nextPost = data?.nextPost ?? null

  usePageTitle(post ? `${post.title} - The Purple Panther` : 'Journal - The Purple Panther', post?.excerpt)

  if (error?.status === 404) return <NotFound />
  if (loading || !post) return <Loading full />

  const author = (post.authorName || 'ADMIN').toUpperCase()
  const date = post.publishedAt
    ? new Date(post.publishedAt)
        .toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })
        .toUpperCase()
    : ''

  return (
    <main className="body_content_wrapper position-relative">
      <section className="blog-single-area pt120 pb-0">
        <div className="gap-60">
          <div className="container-fluid">
            <div className="blog-header pb60">
              <div className="text-center">
                <h3 className="main-title text-uppercase">{post.title}</h3>
                <div className="post-date pb-0 d-flex pt25 justify-content-center align-items-center gap-3">
                  <p className="mb-0 name">BY {author}, {date}</p>
                  {post.newsType && (
                    <p className="comment mb-0"><span className="number">{post.newsType.title.toUpperCase()}</span></p>
                  )}
                </div>
              </div>
            </div>
            <div className="blog-single-post">
              <img src={post.image} alt={post.title} className="img-fluid w-100" />
            </div>
          </div>
        </div>

        <div className="container">
          <div className="row g-4">
            <div className="col-lg-8 mx-auto">
              <div className="blog-post-content pt60">
                <div
                  className="content-box journal-post-body"
                  dangerouslySetInnerHTML={{ __html: post.content ?? '' }}
                />

                <div className="blog-nav d-flex justify-content-between flex-wrap gap-3 mt60">
                  {prevPost ? (
                    <Link to={`/blog/${prevPost.slug}`} className="su-btn-4-black su-left-right">
                      <span className="su-text">? Previous</span>
                    </Link>
                  ) : (
                    <span></span>
                  )}
                  {nextPost && (
                    <Link to={`/blog/${nextPost.slug}`} className="su-btn-4-black su-left-right">
                      <span className="su-text">Next ?</span>
                    </Link>
                  )}
                </div>

                {relatedPosts.length > 0 && (
                  <div className="related-article mt90">
                    <h4 className="mb40">Related Articles</h4>
                    <div className="row g-4">
                      {relatedPosts.map((related) => (
                        <div className="col-md-6" key={related.id}>
                          <div className="for-blog position-relative">
                            <div className="thumb overflow-hidden mb20">
                              <Link to={related.url}>
                                <img src={related.image} alt={related.title} className="img-fluid w-100" />
                              </Link>
                            </div>
                            <h5 className="title"><Link to={related.url}>{related.title}</Link></h5>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="su-instagram-feed-16-area style14 gap-60 pt90 pb-0">
        <div className="container-fluid">
          <div className="row">
            <div className="col-lg-12">
              <div className="section-title style14 mb60 text-center">
                <h2 className="sub-title">JOIN US</h2>
                <h2 className="title">@WOOMEN</h2>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-lg-12">
              <div className="insta-container-home7 d-flex">
                {INSTAGRAM.map((n) => (
                  <div className="item" key={n}>
                    <div className="instagram-item mb30 text-center">
                      <div className="thumb"><img src={`/frontend/images/home1/insta-${n}.jpg`} alt="" /></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
