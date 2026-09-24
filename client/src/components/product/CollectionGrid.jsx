import { Link } from 'react-router-dom'
import PpPrice from './PpPrice.jsx'
import WishlistButton from './WishlistButton.jsx'
import { defaultVariant } from '../../utils/variant-label.js'
import { useCartStore } from '../../store/index.js'

/**
 * frontend/partials/collection-grid.blade.php.
 *
 * Every third card gets `--tall`. That is a layout rule, not a data one — the grid is a
 * masonry of two heights and the rhythm is what keeps the rows from squaring off — so the
 * index arithmetic is reproduced exactly, including it being 1-based.
 *
 * The variants line falls back to "Shop now" here rather than to nothing, which is where
 * it differs from the card on the homepage.
 *
 */
const TALL_EVERY = 3

function variantsLine(item) {
  const sizes = item.sizes?.length ?? 0
  if (sizes > 0) return `${sizes} ${sizes === 1 ? 'size' : 'sizes'}`

  const colors = item.colors?.length ?? 0
  if (colors > 0) return `${colors} ${colors === 1 ? 'variant' : 'variants'}`

  return 'Shop now'
}

export default function CollectionGrid({ products }) {
  const add = useCartStore((s) => s.add)
  const openDrawer = useCartStore((s) => s.openDrawer)

  if (!products || products.length === 0) {
    return <p className="collection-page__empty mb-0">No products found.</p>
  }

  async function quickAdd(item) {
    const variant = defaultVariant(item)
    try {
      await add({
        product_id: item.id,
        quantity: 1,
        ...(variant.color ? { color: variant.color } : {}),
        ...(variant.size ? { size: variant.size } : {}),
      })
      openDrawer()
    } catch {
      // The store holds the error; the bag simply does not open.
    }
  }

  return products.map((item, index) => {
    const variant = defaultVariant(item)
    const tall = (index + 1) % TALL_EVERY === 0
    const colors = item.colors ?? []

    return (
      <article
        className={`collection-page__card${tall ? ' collection-page__card--tall' : ''}`}
        data-product={item.slug}
        data-product-id={item.id}
        data-default-color={variant.color}
        data-default-size={variant.size}
        key={item.id}
      >
        <div className="collection-page__media">
          <Link to={item.url}>
            <img src={item.image} alt={item.title} loading="lazy" />
          </Link>
          <button
            type="button"
            className="collection-page__quick"
            data-add-to-cart
            data-product-id={item.id}
            data-default-color={variant.color}
            data-default-size={variant.size}
            onClick={() => quickAdd(item)}
          >
            Quick add
          </button>
        </div>
        <WishlistButton product={item} className="collection-page__save">
          <i className="far fa-heart"></i>
        </WishlistButton>
        <div className="collection-page__info">
          <h2><Link to={item.url}>{item.title}</Link></h2>
          {/* Price and colours share one baseline-aligned row; the swatches sit to the
              right of the price rather than on a line of their own. */}
          <div className="collection-page__pricerow">
            <div className="collection-page__price"><PpPrice product={item} /></div>
            {colors.length > 0 ? (
              <div className="collection-page__swatches" aria-label="Available colours">
                {colors.map((color) => (
                  <span
                    key={color.id ?? color.name}
                    className="collection-page__swatch"
                    style={{ '--swatch': color.code || '#3b3738' }}
                    title={color.name ?? ''}
                  />
                ))}
              </div>
            ) : null}
          </div>
          <p className="collection-page__variants">{variantsLine(item)}</p>
        </div>
      </article>
    )
  })
}
