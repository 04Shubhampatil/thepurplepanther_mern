import { Link } from 'react-router-dom'
import ThemeSwiper, { SwiperSlide } from '../ui/ThemeSwiper.jsx'
import PpPrice from '../product/PpPrice.jsx'
import QuickAdd from '../product/QuickAdd.jsx'
import { variantLabel, defaultVariant } from '../../utils/variant-label.js'

/**
 * frontend/partials/home-new-arrivals.blade.php — the `.su-banner-16-zoom` slider.
 *
 * The slider itself lives here rather than in the page. Under Blade the partial supplied
 * only the `.swiper-wrapper` and home.blade.php supplied the container around it; with
 * swiper/react the container and its slides are one component, so keeping them split would
 * mean passing SwiperSlide children across a boundary Swiper cannot see through — it reads
 * its own children to build the slides.
 */
export default function HomeNewArrivals({ products }) {
  return (
    <ThemeSwiper
      className="swiper-container su-banner-16-zoom overflow-hidden"
      slidesPerView={1}
      speed={1500}
      spaceBetween={0}
      loop={products.length > 1}
      parallax
      autoplay={{ delay: 3500 }}
      navigation={{
        nextEl: '.su-banner-16-next, .swiper-button-next, .next',
        prevEl: '.su-banner-16-prev, .swiper-button-prev, .prev',
      }}
      pagination={{ el: '.swiper-pagination', clickable: true }}
    >
      {products.map((item) => {
        const variant = defaultVariant(item)
        const meta = variantLabel(item)

        return (
          <SwiperSlide key={item.id}>
            <div
              className="su-product-4-card ms-0 bg-white p-3 product-card-15 product-card-12 border-0 card-product"
              data-product-id={item.id}
              data-default-color={variant.color}
              data-default-size={variant.size}
            >
              <div className="card-product-wrapper position-relative">
                <Link to={item.url} className="product-img overflow-hidden">
                  <img className="w-100 img-product" loading="lazy" src={item.image} alt={item.title} />
                  <img className="w-100 img-hover" loading="lazy" src={item.hoverImage} alt={`${item.title} alternate view`} />
                </Link>
                <QuickAdd product={item} className="product-btn" />
              </div>
              <div className="card-product-info text-start p-0 pt10">
                <div className="info">
                  <h4 className="product-title mt10 mb-2">
                    <Link to={item.url}>{item.title.toUpperCase()}</Link>
                  </h4>
                  <span className="product-price mb10 d-inline-block"><PpPrice product={item} /></span>
                  {meta && <span className="home43-product-meta">{meta}</span>}
                </div>
              </div>
            </div>
          </SwiperSlide>
        )
      })}
    </ThemeSwiper>
  )
}
