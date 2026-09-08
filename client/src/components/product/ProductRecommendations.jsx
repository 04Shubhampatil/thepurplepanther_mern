import { Link } from 'react-router-dom'
import PpPrice from './PpPrice.jsx'
import WishlistButton from './WishlistButton.jsx'
import QuickAdd from './QuickAdd.jsx'
import { defaultVariant } from '../../utils/variant-label.js'

/**
 * frontend/partials/product-recommendations.blade.php.
 *
 * Rendered twice on the product page with different `variant` modifiers — "related" and
 * "recent" — which is the only difference between the two blocks, so it stays a parameter
 * rather than two components.
 *
 * The meta line here counts BOTH colours and sizes and joins them ("2 Colors, 3 Sizes"),
 * unlike the card elsewhere which picks one. Capitalised, too. Small differences, but they
 * are what is on the page.
 */
export default function ProductRecommendations({ items, heading, titleId, variant = 'related' }) {
  if (!items || items.length === 0) return null

  return (
    <section className={`product-recommendations product-recommendations--${variant}`} aria-labelledby={titleId}>
      <div className="product-recommendations__container">
        <h2 id={titleId}>{heading}</h2>
        <div className="product-recommendations__grid">
          {items.map((item) => {
            const variantDefaults = defaultVariant(item)
            const colorCount = item.colors?.length ?? 0
            const sizeCount = item.sizes?.length ?? 0
            const metaParts = []
            if (colorCount > 0) metaParts.push(`${colorCount} ${colorCount === 1 ? 'Color' : 'Colors'}`)
            if (sizeCount > 0) metaParts.push(`${sizeCount} ${sizeCount === 1 ? 'Size' : 'Sizes'}`)

            return (
              <article
                className="product-recommendation-card"
                data-product-id={item.id}
                data-default-color={variantDefaults.color}
                data-default-size={variantDefaults.size}
                key={item.id}
              >
                <Link className="product-recommendation-card__image" to={item.url}>
                  <img src={item.image} alt={item.title} />
                </Link>
                <QuickAdd product={item} className="product-recommendation-card__quick product-btn" label="Quick add" />
                <WishlistButton product={item} className="product-recommendation-card__wish">♡</WishlistButton>
                <p className="product-recommendation-card__eyebrow">
                  {item.isNewArrival ? 'NEW ARRIVAL' : (item.category?.title ?? 'SHOP').toUpperCase()}
                </p>
                <h3><Link to={item.url}>{item.title}</Link></h3>
                <p className="product-recommendation-card__price"><PpPrice product={item} /></p>
                {metaParts.length > 0 && (
                  <p className="product-recommendation-card__meta">{metaParts.join(', ')}</p>
                )}
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
