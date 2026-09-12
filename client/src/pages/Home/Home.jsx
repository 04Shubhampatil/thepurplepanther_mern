import { Link } from 'react-router-dom'
import PpPrice from '../../components/product/PpPrice.jsx'
import ProductSliderCard from '../../components/product/ProductSliderCard.jsx'
import HomeNewArrivals from '../../components/home/HomeNewArrivals.jsx'
import ShopTheLook from '../../components/home/ShopTheLook.jsx'
import Loading from '../../components/common/Loading.jsx'
import { useApi } from '../../hooks/useApi.js'
import HomeHero from '../../components/home/HomeHero.jsx'
import ThemeSwiper, { SwiperSlide } from '../../components/ui/ThemeSwiper.jsx'
import { variantLabel } from '../../utils/variant-label.js'
import * as api from '../../services/endpoints.js'

/**
 * frontend/pages/home.blade.php.
 *
 * Section for section and class for class: hero, the curated collection tiles, the
 * shoppable look, new arrivals beside the editorial image, Our Story, the two accessory
 * carousels, the fabric library and the closing panel. The journal block stays commented
 * out because it is commented out in the Blade file — uncommenting it here would put a
 * section on the live homepage that is not on the live homepage.
 *
 * Every banner section falls back to the theme's own copy and imagery when the CMS has no
 * row for it, which is what kept the homepage from ever rendering an empty slot.
 */

/**
 * The Fabric Library's fallback cards, from the `@else` branch of home.blade.php.
 *
 * The copy is the theme's, shown when no CMS banner supplies its own — the section is never
 * allowed to render empty, which is the same rule every other homepage block follows.
 */
const DEFAULT_FABRICS = [
  {
    id: 'tencel',
    image: '/frontend/images/fabric-1.jpg',
    alt: '',
    title: 'Tencel Cotton Blend',
    subtitle:
      'A modern blend that brings together the natural breathability of cotton and the silky softness of Tencel™. Lightweight, smooth, and exceptionally comfortable, this fabric is designed to move effortlessly through the day. Its fluid drape and moisture-managing properties help keep you feeling fresh, while the cotton base provides the familiarity and ease of a wardrobe staple. The result is a fabric that looks polished, feels luxurious, and performs beautifully from morning to night.',
  },
  {
    id: 'modal-linen',
    image: '/frontend/images/fabric-2.jpg',
    alt: '',
    title: 'Modal Linen',
    subtitle:
      "Our Modal Linen blend reimagines traditional linen for contemporary living. By combining linen's natural breathability with the softness and fluidity of modal, we've created a fabric that retains linen's relaxed character while offering a smoother hand feel and enhanced comfort. Light, airy, and effortlessly elegant, it delivers the sophistication of linen without the stiffness often associated with it, making it ideal for long days, warm weather, and everyday wear.",
  },
  {
    id: 'giza',
    image: '/frontend/images/fabric-3.jpg',
    alt: '',
    title: 'Giza Cotton',
    subtitle:
      "Widely regarded as one of the world's finest cottons, Giza Cotton is prized for its exceptionally long fibers, which create fabrics that are remarkably soft, strong, and refined. The result is a fabric with a smooth finish, superior durability, and a luxurious feel against the skin. Naturally breathable and crafted to maintain its quality over time, Giza Cotton elevates everyday dressing with a level of comfort and sophistication that sets it apart from ordinary cotton.",
  },
]

export default function Home() {
  const { data, loading } = useApi(() => api.catalog.home(), [])

  const banners = data?.banners ?? {}
  const homeHero = banners.home_hero
  const homeCollection = banners.home_complete_collection
  const homeShopLook = banners.home_shoppable_look
  const homeNewArrivalsBanner = banners.home_new_arrivals_banner
  const homeOurStory = banners.home_our_story
  const homeFabricLibrary = banners.home_fabric_library
  const homeClosingContent = banners.home_closing_content

  const heroImages = homeHero?.images ?? []
  const shopTheLook = data?.shopTheLook ?? []
  const newArrivals = data?.newArrivals ?? []
  const popularAccessories = data?.popularAccessories ?? []
  const fabricCards = homeFabricLibrary?.images?.length ? homeFabricLibrary.images : DEFAULT_FABRICS

  if (loading) return <Loading full />

  return (
    <div className="body_content_wrapper position-relative">

      {/* banner-area-start */}
      <HomeHero heroImages={heroImages} homeHero={homeHero} />
      {/* banner-area-end */}

      {/* Admin-managed collection tiles */}
      {(homeCollection?.images?.length ?? 0) > 0 && (
      <section className="curated-area pt90 pb-0">
        <div className="container container-1630">
          <div className="su-section-16-title-top mx-auto text-center">
            <div className="section-title">
              <div className="text text-uppercase"><img src="/frontend/images/icon.svg" /></div>
              <h2 className="title">{homeCollection.title}</h2>
            </div>
          </div>
          <div className="row align-items-center mb-5">
            {homeCollection.images.map((tile) => (
            <div className="col-xl-4 col-sm-6" key={tile.id}>
              <div className="for-blog position-relative">
                <div className="thumb rounded-3 overflow-hidden mb20 position-relative">
                  <Link className="su-btn-4-black su-left-right fw400 fz15" to={tile.buttonLink || '/shop'}>
                    <img src={tile.image} alt={tile.title} className="img-fluid w-100" /></Link>
                </div>
                <div className="details text-center">
                  <h4 className="title fw400 fz20 pe-0 mb-2"><Link to={tile.buttonLink || '/shop'}>{tile.title}</Link></h4>
                  {tile.subtitle && <h6>{tile.subtitle}</h6>}
                  <Link className="su-btn-4-black su-left-right fw400 fz15" to={tile.buttonLink || '/shop'}><span className="su-text d-inline-block text-decoration-underline">{tile.buttonText || 'Shop Collection'}</span></Link>
                </div>
              </div>
            </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Shop-Look-area-start */}
      <section
        className="shoplook-home43"
        style={homeShopLook?.images?.[0] ? { backgroundImage: `url('${homeShopLook.images[0].image}')` } : undefined}
      >
        <div className="container container-1630">
          <div className="row">
            <div className="col-lg-12">

              <ShopTheLook products={shopTheLook} />

              <Link to={homeShopLook?.buttonLink || '/collection'} className="shop-look-btn">
                <i className="flaticon-shopping-bag"></i>
                <span>{homeShopLook?.buttonText || 'Shop The Look'}</span>
              </Link>

            </div>
          </div>
        </div>
      </section>
      {/* Shop-Look-area-end */}

      {/* single-product-area-start */}
      <section className="home43-shop-look">
        <div className="container-fluid p-0">
          <div className="row">
            <div className="col-lg-6 position-relative">
              <div className="image-box">
                <img src={homeNewArrivalsBanner?.images?.[0]?.image ?? '/frontend/images/big-images.jpg'} alt={homeNewArrivalsBanner?.title || 'New arrivals'} className="w-100" />
              </div>
            </div>
            <div className="col-lg-6 align-self-center home43-slider home43-shop-look-slider">
              <HomeNewArrivals products={newArrivals} />
            </div>
          </div>
        </div>
      </section>
      {/* single-product-area-end */}
      {/* collections-area-start */}
      <section className="home43-banner2 su-product-step pt90">
        <div className="container container-1630">
          <div className="row g-4">
            <div className="col-lg-6 align-self-center">
              <div className="content-box-home43 text-center">
                <div className="text-dark1 text-uppercase mb25 wow fadeInUp" data-wow-delay="00ms" data-wow-duration="1500ms"><img src="/frontend/images/icon.svg" /><br /> {homeOurStory?.subtitle || 'Our Story'}</div>
                <h2 className="title mb25 wow fadeInUp" data-wow-delay="100ms" data-wow-duration="1500ms">{homeOurStory?.title || 'Inspiring women to cherish themselves and our planet'}</h2>
                <div className="max-text mx-auto mb-40 wow fadeInUp" data-wow-delay="200ms" data-wow-duration="1500ms">{homeOurStory?.description || 'Built on a foundation of environmental consciousness and driven by a sense of self-empowerment, we create timeless products that pay homage to the beauty of femininity.'}</div>
                <div className="mt30">
                  <Link className="su-btn-4 su-btn-7-black su-left-right rounded-3" to={homeOurStory?.buttonLink || '/about'}>
                    <span className="mr10 su-text d-inline-block">{homeOurStory?.buttonText || 'Discover More'}</span>
                    <span className="su-arrow-angle">
                      <svg className="su-arrow-svg-top-right" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10.00 10.00">
                        <path d="M1.018 10.009 0 8.991l7.569-7.582H1.723L1.737 0h8.26v8.274H8.574l.013-5.847Z"></path>
                        <path d="M1.018 10.009 0 8.991l7.569-7.582H1.723L1.737 0h8.26v8.274H8.574l.013-5.847Z"></path>
                      </svg>
                    </span>
                  </Link>
                </div>
              </div>
            </div>
            <div className="col-lg-6 align-self-center">
              <div className="img-box-home43">
                <img src={homeOurStory?.images?.[0]?.image ?? '/frontend/images/our-story.jpg'} alt={homeOurStory?.title || 'Our Story'} />
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* collections-area-end */}


      {/* products-area-start */}
      {newArrivals.length > 0 && (
      <section className="su-product-15-area pb-0 gap-60 legacy-home-accessories">
        <div className="container container-1830">
          <div className="row mb40">
            <div className="col-ms-8 col-sm-9 align-self-center">
              <div className="section-title mb-0 style12 text-start">
                <h2 className="title">Popular accessories</h2>
              </div>
            </div>
            <div className="col-ms-4 col-sm-3 align-self-center">
              <div className="navigation-12 d-flex justify-content-start justify-content-sm-end mt-3 mt-sm-0">
                <span className="prev">
                  <svg width="8" height="14" viewBox="0 0 8 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M7.31939 1.01386C7.05091 0.745379 6.61564 0.745379 6.34715 1.01386L0.847146 6.51389C0.578654 6.78238 0.578654 7.21761 0.847146 7.48611L6.34715 12.9861C6.61564 13.2546 7.05091 13.2546 7.31939 12.9861C7.58787 12.7176 7.58787 12.2824 7.31939 12.0139L2.30556 7L7.31939 1.98613C7.58787 1.71765 7.58787 1.28234 7.31939 1.01386Z" fill="currentColor" />
                  </svg>
                </span>
                <span className="next">
                  <svg width="8" height="14" viewBox="0 0 8 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M0.680488 1.01386C0.94897 0.745379 1.38424 0.745379 1.65273 1.01386L7.15273 6.51389C7.42122 6.78238 7.42122 7.21761 7.15273 7.48611L1.65273 12.9861C1.38424 13.2546 0.94897 13.2546 0.680488 12.9861C0.412005 12.7176 0.412005 12.2824 0.680488 12.0139L5.69431 7L0.680488 1.98613C0.412005 1.71765 0.412005 1.28234 0.680488 1.01386Z" fill="currentColor" />
                  </svg>
                </span>
              </div>
            </div>
          </div>
          <ThemeSwiper
            className="swiper-container product-12-slider"
            speed={700}
            spaceBetween={5}
            loop={newArrivals.length > 4}
            navigation={{ nextEl: '.next', prevEl: '.prev' }}
            autoplay={{ delay: 4000 }}
            breakpoints={{
              1400: { slidesPerView: 4 },
              1200: { slidesPerView: 4 },
              991: { slidesPerView: 3 },
              768: { slidesPerView: 2 },
              576: { slidesPerView: 2 },
              0: { slidesPerView: 1 },
            }}
          >
            {newArrivals.map((item) => (
              <SwiperSlide key={item.id}>
                <ProductSliderCard item={item} />
              </SwiperSlide>
            ))}
          </ThemeSwiper>
        </div>
      </section>
      )}
      {/* products-area-end */}

      {popularAccessories.length > 0 && (
      <section className="home-accessories" aria-labelledby="home-accessories-title">
      <div className="home-editorial-container">
        <div className="home-slider-head">
          <h2 id="home-accessories-title">Popular Accessories</h2>
          <div className="home-slider-arrows">
            <button className="home-accessories-prev" type="button" aria-label="Previous accessories">‹</button>
            <button className="home-accessories-next" type="button" aria-label="Next accessories">›</button>
          </div>
        </div>
        <ThemeSwiper
          className="swiper-container home-accessories-slider"
          slidesPerView={1.25}
          spaceBetween={12}
          speed={700}
          watchOverflow
          navigation={{ nextEl: '.home-accessories-next', prevEl: '.home-accessories-prev' }}
          breakpoints={{
            768: { slidesPerView: 2.4, spaceBetween: 16 },
            1200: { slidesPerView: 4, spaceBetween: 20 },
          }}
        >
            {popularAccessories.map((item) => (
              <SwiperSlide className="home-accessory-card" tag="article" key={item.id}>
                <Link className="home-accessory-card__image" to={item.url}>
                  <img src={item.image} alt={item.title} loading="lazy" />
                </Link>
                <button className="home-accessory-card__wish" type="button" data-wishlist-product={item.id} aria-label={`Add ${item.title} to wishlist`}>♡</button>
                <h3><Link to={item.url}>{item.title}</Link></h3>
                <p><PpPrice product={item} /></p>
                {variantLabel(item) && <span>{variantLabel(item)}</span>}
              </SwiperSlide>
            ))}
        </ThemeSwiper>
      </div>
    </section>
      )}

      <section className="home-fabric-library" aria-labelledby="home-fabric-title">
        <div className="home-editorial-container">
          <div className="home-slider-head">
            <h2 id="home-fabric-title">{homeFabricLibrary?.title || 'Fabric Library'}</h2>
            <div className="home-slider-arrows">
              <button className="home-fabric-prev" type="button" aria-label="Previous fabric">‹</button>
              <button className="home-fabric-next" type="button" aria-label="Next fabric">›</button>
            </div>
          </div>
          <ThemeSwiper
            className="swiper-container home-fabric-slider"
            slidesPerView={1.08}
            spaceBetween={12}
            speed={700}
            watchOverflow
            navigation={{ nextEl: '.home-fabric-next', prevEl: '.home-fabric-prev' }}
            breakpoints={{
              768: { slidesPerView: 1.4, spaceBetween: 20 },
              1200: { slidesPerView: 2, spaceBetween: 30 },
            }}
          >
            {/*
              Blade put `home-fabric-card` on the slide itself. Here the card is an <article>
              INSIDE the slide, and that is load-bearing: style.css gives the card a fixed
              height per breakpoint (528 / 460 / 390px) and Swiper's own stylesheet gives
              `.swiper-slide` `height: 100%`. In Laravel, Swiper 6's CSS sat inside style.css
              ahead of the card rule, so the card rule won; in this build Swiper's CSS is
              bundled after the theme, so on the slide the same two rules resolve the other
              way and the card collapses to the image's natural aspect. On a nested article
              there is no conflict — the slide's 100% resolves to the article's height.
            */}
            {fabricCards.map((fabric, index) => (
              <SwiperSlide key={fabric.id ?? index}>
                <article className="home-fabric-card" tabIndex="0">
                  <img src={fabric.image} alt={fabric.alt ?? fabric.title} />
                  <div className="home-fabric-card__overlay"></div>
                  <div className="home-fabric-card__content">
                    <h3>{fabric.title}</h3>
                    {fabric.subtitle && <p>{fabric.subtitle}</p>}
                  </div>
                </article>
              </SwiperSlide>
            ))}
          </ThemeSwiper>
        </div>
      </section>

      {(homeClosingContent?.images?.length ?? 0) > 0 && (
      <section className="home43-banner2 su-product-step pt90 pb90">
        <div className="container container-1630">
          <div className="row g-4">
            <div className="col-lg-6 align-self-center">
              <div className="content-box-home43 text-center">
                {homeClosingContent.subtitle && <div className="text-dark1 text-uppercase mb25">{homeClosingContent.subtitle}</div>}
                <h2 className="title mb25">{homeClosingContent.title}</h2>
                {homeClosingContent.description && <div className="max-text mx-auto mb-40">{homeClosingContent.description}</div>}
                {homeClosingContent.buttonText && (
                  <Link className="su-btn-4 su-btn-7-black su-left-right rounded-3" to={homeClosingContent.buttonLink || '/shop'}>
                    <span className="mr10 su-text d-inline-block">{homeClosingContent.buttonText}</span>
                  </Link>
                )}
              </div>
            </div>
            <div className="col-lg-6 align-self-center">
              <div className="img-box-home43">
                <img src={homeClosingContent.images[0].image} alt={homeClosingContent.title} />
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* blog-area-start */}
      {/* <section className="home-journal" aria-labelledby="home-journal-title">
      <div className="home-journal__container">
        <div className="home-journal__head">
          <h2 id="home-journal-title">From the Journal</h2>
          <Link className="home-journal__view-all" to="/blog">View All</Link>
          <div className="home-slider-arrows">
            <button className="home-journal-prev" type="button" aria-label="Previous journal posts">‹</button>
            <button className="home-journal-next" type="button" aria-label="Next journal posts">›</button>
          </div>
        </div>
        <div className="swiper-container home-journal-slider">
          <div className="swiper-wrapper">
            @include('frontend.partials.home-journal')
          </div>
        </div>
      </div>
    </section> */}
      {/* blog-area-end */}
    </div>
  )
}
