import { Link } from 'react-router-dom'
import PpPrice from '../product/PpPrice.jsx'
import QuickAdd from '../product/QuickAdd.jsx'
import { variantLabel, defaultVariant } from '../../utils/variant-label.js'

/**
 * frontend/partials/home-new-arrivals.blade.php — the slides inside `.su-banner-16-zoom`.
 *
 * The `.swiper-wrapper` lives here rather than in the page, exactly as the partial had it,
 * because Swiper requires the wrapper to be the container's direct child; moving it up one
 * level silently produces a slider with a single, unscrollable slide.
 */
export default function HomeNewArrivals({ products }) {
  return (
    <div className="swiper-wrapper mb20">
      {products.map((item) => {
        const variant = defaultVariant(item)
        const meta = variantLabel(item)

        return (
          <div className="swiper-slide" key={item.id}>
            <div
              className="su-product-4-card ms-0 bg-white p-3 product-card-15 product-card-12 border-0 card-product"
              data-product-id={item.id}
              data-default-color={variant.color}
              data-default-size={variant.size}
            >
              <div className="card-product-wrapper position-relative">
                <Link to={item.url} className="product-img overflow-hidden">
                  <img className="w-100 lazyload img-product" data-src={item.image} src={item.image} alt={item.title} />
                  <img className="w-100 lazyload img-hover" data-src={item.hoverImage} src={item.hoverImage} alt={`${item.title} alternate view`} />
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
          </div>
        )
      })}
    </div>
  )
}
