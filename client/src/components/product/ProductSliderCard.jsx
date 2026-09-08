import { Link } from 'react-router-dom'
import PpPrice from './PpPrice.jsx'
import QuickAdd from './QuickAdd.jsx'
import { defaultVariant } from '../../utils/variant-label.js'

/**
 * frontend/partials/product-slider-card.blade.php.
 *
 * The sub-title above the name is a three-way choice Blade made per card and the order
 * matters: NEW ARRIVAL wins over a discount, a discount wins over the category name, and
 * a product with none of those still shows "SHOP" rather than an empty line — which the
 * layout depends on, since the heading holds the row's height.
 */
export default function ProductSliderCard({ item }) {
  const variant = defaultVariant(item)

  return (
    <div className="swiper-slide">
      <div
        className="su-product-4-card product-card-15 shop-product-item border-0 card-product"
        data-product-id={item.id}
        data-default-color={variant.color}
        data-default-size={variant.size}
      >
        <div className="card-product-wrapper position-relative">
          <Link to={item.url} className="product-img overflow-hidden">
            <img className="w-100 lazyload img-product" data-src={item.image} src={item.image} alt={item.title} />
            <img className="w-100 lazyload img-hover" data-src={item.hoverImage} src={item.hoverImage} alt={item.title} />
          </Link>
          <QuickAdd product={item} className="product-btn" />
        </div>
        <div className="card-product-info text-start p-0 mt20">
          {item.isNewArrival ? (
            <h6 className="sub-title mb15">NEW ARRIVAL</h6>
          ) : item.discountPercent > 0 ? (
            <h6 className="sub-title mb15">{item.discountPercent}% OFF</h6>
          ) : (
            <h6 className="sub-title mb15">{item.category?.title ?? 'SHOP'}</h6>
          )}
          <h4 className="product-title mt5"><Link to={item.url}>{item.title}</Link></h4>
          <span className="product-price mb-0 d-inline-block"><PpPrice product={item} /></span>
        </div>
      </div>
    </div>
  )
}
