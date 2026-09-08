import { Link } from 'react-router-dom'
import Money from '../common/Money.jsx'

/**
 * Product grid card.
 *
 * Every price shown comes pre-formatted from the API. The card never computes a discount
 * or a total — `discountPercent` already accounts for the offer-over-computed precedence
 * rule that lives in the server's presenter.
 */
export default function ProductCard({ product, onWishlist = null, inWishlist = false }) {
  if (!product) return null

  const outOfStock =
    (product.colors?.length || product.sizes?.length) &&
    [...(product.colors ?? []), ...(product.sizes ?? [])].every((v) => Number(v.quantity) === 0)

  return (
    <div className="pp-product-card">
      <div className="pp-product-card__media" style={{ position: 'relative' }}>
        <Link to={product.url} aria-label={product.title}>
          <img
            src={product.image}
            alt={product.title}
            loading="lazy"
            width="600"
            height="800"
            style={{ width: '100%', height: 'auto', display: 'block' }}
            onMouseOver={(e) => {
              if (product.hoverImage) e.currentTarget.src = product.hoverImage
            }}
            onMouseOut={(e) => {
              e.currentTarget.src = product.image
            }}
          />
        </Link>

        {product.discountPercent > 0 && (
          <span className="pp-badge pp-badge--sale">{product.discountPercent}% OFF</span>
        )}
        {product.isNewArrival && <span className="pp-badge pp-badge--new">New</span>}
        {outOfStock && <span className="pp-badge pp-badge--oos">Out of stock</span>}

        {onWishlist && (
          <button
            type="button"
            className="pp-product-card__wishlist"
            aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
            aria-pressed={inWishlist}
            onClick={() => onWishlist(product)}
          >
            <i className={inWishlist ? 'fa fa-heart' : 'fa fa-heart-o'} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="pp-product-card__body">
        <h3 className="pp-product-card__title">
          <Link to={product.url}>{product.title}</Link>
        </h3>

        <div className="pp-product-card__price">
          <Money formatted={product.priceFormatted} className="pp-price" />
          {product.discountPercent > 0 && (
            <del className="pp-price pp-price--mrp" style={{ marginLeft: 8, opacity: 0.6 }}>
              <Money formatted={product.mrpFormatted} />
            </del>
          )}
        </div>
      </div>
    </div>
  )
}
