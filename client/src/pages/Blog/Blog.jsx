import { Link, useSearchParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import Loading from '../../components/common/Loading.jsx'
import CollectionPagination from '../../components/common/CollectionPagination.jsx'
import { useBodyClass, usePageTitle } from '../../theme/page.js'
import * as api from '../../services/endpoints.js'

/**
 * frontend/pages/blog.blade.php and its blog-list-body partial.
 *
 * The featured post is EXCLUDED from the grid below it — the server drops it from the
 * listing query — so a post never appears twice on the page. Its image prefers the journal
 * banner's own image when the CMS has one, falling back to the post's banner.
 *
 * The Instagram strip and the three feature boxes underneath are static theme content, not
 * a feed; they are part of the page as shipped.
 */
const ARROW = (
  <span className="su-arrow-angle">
    <svg className="su-arrow-svg-top-right" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10.00 10.00">
      <path d="M1.018 10.009 0 8.991l7.569-7.582H1.723L1.737 0h8.26v8.274H8.574l.013-5.847Z"></path>
      <path d="M1.018 10.009 0 8.991l7.569-7.582H1.723L1.737 0h8.26v8.274H8.574l.013-5.847Z"></path>
    </svg>
  </span>
)

const INSTAGRAM = [1, 2, 3, 4, 5, 6, 7]

function byline(post) {
  const author = (post.authorName || 'ADMIN').toUpperCase()
  const date = post.publishedAt
    ? new Date(post.publishedAt)
        .toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })
        .toUpperCase()
    : ''
  return `BY ${author}, ${date}`
}

export default function Blog() {
  // blog.blade.php / blog-single.blade.php open with a bare `<body>`, like about. Keeping
  // `home21-type` would repaint the journal's headings in DM Sans — see useBodyClass.
  useBodyClass()
  const [searchParams] = useSearchParams()
  const type = searchParams.get('type') ?? ''
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10) || 1

  const { data, loading } = useApi(() => api.cms.blog({ type, page }), [type, page])

  usePageTitle('Journal - The Purple Panther')

  if (loading) return <Loading full />

  const newsTypes = data?.newsTypes ?? []
  const activeType = data?.activeType ?? null
  const journalBanner = data?.journalBanner ?? null
  const featuredPost = data?.featuredPost ?? null
  const posts = data?.posts ?? []
  const pagination = data?.pagination ?? { page: 1, lastPage: 1, total: 0, perPage: 9 }

  const featuredImage = journalBanner?.images?.[0]?.image ?? featuredPost?.bannerImage ?? featuredPost?.image

  const firstItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.perPage + 1
  const lastItem = Math.min(pagination.page * pagination.perPage, pagination.total)

  return (
    <main className="body_content_wrapper position-relative">
      <section className="blog-list-area pt120 pb-0">
        <div className="container">
          <div className="blog-header pb90">
            <div className="text-center">
              <h2 className="title text-uppercase">{journalBanner?.subtitle || 'JOURNAL'}</h2>
              <h5 className="sub-title mt20">{journalBanner?.description || "Let's Talk Fashion"}</h5>
            </div>
            <div className="blog-filter d-flex flex-wrap mt25">
              <Link to="/blog" className={`filter-btn flex-grow-1 text-center ${!activeType ? 'active' : ''}`}>All Post</Link>
              {newsTypes.map((newsType) => (
                <Link
                  to={`/blog?type=${newsType.slug}`}
                  className={`filter-btn flex-grow-1 text-center ${activeType?.id === newsType.id ? 'active' : ''}`}
                  key={newsType.id}
                >
                  {newsType.title}
                </Link>
              ))}
            </div>
          </div>

          {featuredPost && (
            <div className="for-blog blog-big position-relative">
              <div className="thumb overflow-hidden">
                <img src={featuredImage} alt={featuredPost.title} className="img-fluid w-100" />
              </div>
              <div className="details position-absolute w-100 h-100 top-0 start-0 p60">
                <div className="info">
                  <div className="post-date pb30 d-flex align-items-center gap-3">
                    <p className="mb-0 name">{byline(featuredPost)}</p>
                  </div>
                  <h4 className="title pb30">
                    <Link to={featuredPost.url}>{featuredPost.title}</Link>
                  </h4>
                  <Link className="su-btn-4-black text-white su-left-right" to={featuredPost.url}>
                    <span className="mr10 su-text d-inline-block">READ MORE</span>
                    {ARROW}
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="row g-4 mt60">
            {posts.length === 0 ? (
              <div className="col-12 text-center py-5">
                <p className="mb-0">No journal posts yet.</p>
              </div>
            ) : (
              posts.map((post) => (
                <div className="col-lg-4 col-sm-6" key={post.id}>
                  <div className="for-blog position-relative">
                    <div className="thumb overflow-hidden mb20 position-relative">
                      <Link to={post.url}>
                        <img src={post.image} alt={post.title} className="img-fluid w-100" />
                      </Link>
                      {post.newsType && (
                        <span className="label position-absolute">{post.newsType.title.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="details">
                      <div className="info">
                        <div className="post-date pb15 d-flex align-items-center gap-3">
                          <p className="mb-0 name">{byline(post)}</p>
                        </div>
                        <h4 className="title pb10">
                          <Link to={post.url}>{post.title}</Link>
                        </h4>
                        <Link className="su-btn-4-black su-left-right" to={post.url}>
                          <span className="mr10 su-text d-inline-block">READ MORE</span>
                          {ARROW}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {pagination.total > 0 && (
            <div className="collection-page__pagination pt60 pb90">
              <p className="collection-page__count mb-3">
                Showing {firstItem}–{lastItem} of {pagination.total} posts
              </p>
              <CollectionPagination page={pagination.page} lastPage={pagination.lastPage} />
            </div>
          )}
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

      <section className="feature-16-area pt90 pb-0">
        <div className="container">
          <div className="row g-4">
            <div className="col-lg-4 col-md-6">
              <div className="icon-box-home1 text-center">
                <div className="icon title-color"><i className="flaticon-world-wide"></i></div>
                <h6 className="title text-uppercase">WORLDWIDE SHIPPING</h6>
                <div className="text title-color">Receive your order an estimated 3-5 days after shipment</div>
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="icon-box-home1 text-center">
                <div className="icon title-color"><i className="flaticon-return-1"></i></div>
                <h6 className="title text-uppercase">EASY RETURNS</h6>
                <div className="text title-color">Your exchange ships out as soon as you email us.</div>
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="icon-box-home1 text-center">
                <div className="icon title-color"><i className="flaticon-feedback"></i></div>
                <h6 className="title text-uppercase">PRIVATE SESSION</h6>
                <div className="text title-color">We are available from Monday to Friday to answer your questions.</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
