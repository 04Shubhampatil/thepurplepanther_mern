import { Link } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import ProductGrid from '../../components/product/ProductGrid.jsx'
import Loading from '../../components/common/Loading.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import Seo from '../../components/common/Seo.jsx'
import BannerMedia from '../../components/common/BannerMedia.jsx'

/**
 * Homepage.
 *
 * One request. The server applies all of Laravel's fallback chains — curated shop-the-look
 * → featured → any; new arrivals → any; popular accessories → the accessories category —
 * so no section can render empty and the client does not need to know the rules.
 */
export default function Home() {
  const { data, error, loading, refetch } = useApi(() => api.catalog.home(), [])

  if (loading) return <Loading full />
  if (error) return <ErrorMessage error={error} onRetry={refetch} />

  const { banners = {}, shopTheLook = [], newArrivals = [], popularAccessories = [], journalPosts = [] } =
    data ?? {}

  const hero = banners.home_hero
  const heroSlide = hero?.images?.[0]

  return (
    <>
      <Seo
        title={null}
        description="The Purple Panther — beyond ordinary. Discover our latest collection."
      />

      {heroSlide && (
        <section className="pp-hero">
          {/* The live hero is an .mp4, so this must handle video as well as images. */}
          <BannerMedia
            src={heroSlide.image}
            mobileSrc={heroSlide.mobileImage}
            alt={heroSlide.title ?? hero.title ?? ''}
            eager
          />
          <div className="pp-hero__content container">
            {(heroSlide.title || hero.title) && <h1>{heroSlide.title ?? hero.title}</h1>}
            {(heroSlide.subtitle || hero.subtitle) && <p>{heroSlide.subtitle ?? hero.subtitle}</p>}
            {heroSlide.buttonLink && (
              <Link to={heroSlide.buttonLink} className="btn btn-primary">
                {heroSlide.buttonText || 'Shop now'}
              </Link>
            )}
          </div>
        </section>
      )}

      {shopTheLook.length > 0 && (
        <section className="pp-section container">
          <h2>{banners.home_shoppable_look?.title ?? 'Shop the look'}</h2>
          <ProductGrid products={shopTheLook} />
        </section>
      )}

      {newArrivals.length > 0 && (
        <section className="pp-section container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2>{banners.home_new_arrivals_banner?.title ?? 'New arrivals'}</h2>
            <Link to="/shop">View all</Link>
          </div>
          <ProductGrid products={newArrivals} />
        </section>
      )}

      {banners.home_our_story?.images?.[0] && (
        <section className="pp-section pp-story">
          <BannerMedia
            src={banners.home_our_story.images[0].image}
            mobileSrc={banners.home_our_story.images[0].mobileImage}
            alt={banners.home_our_story.title ?? 'Our story'}
          />
          <div className="container">
            <h2>{banners.home_our_story.title}</h2>
            {banners.home_our_story.description && <p>{banners.home_our_story.description}</p>}
            {banners.home_our_story.buttonLink && (
              <Link to={banners.home_our_story.buttonLink} className="btn btn-outline-dark">
                {banners.home_our_story.buttonText || 'Read more'}
              </Link>
            )}
          </div>
        </section>
      )}

      {popularAccessories.length > 0 && (
        <section className="pp-section container">
          <h2>Popular accessories</h2>
          <ProductGrid products={popularAccessories} />
        </section>
      )}

      {journalPosts.length > 0 && (
        <section className="pp-section container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2>From the journal</h2>
            <Link to="/blog">All stories</Link>
          </div>

          <div className="row">
            {journalPosts.map((post) => (
              <div className="col-md-3 col-sm-6" key={post.id}>
                <article className="pp-journal-card">
                  <Link to={`/blog/${post.slug}`}>
                    <img src={post.image} alt="" loading="lazy" style={{ width: '100%' }} />
                    <h3>{post.title}</h3>
                  </Link>
                  {post.excerpt && <p style={{ opacity: 0.75 }}>{post.excerpt}</p>}
                </article>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
