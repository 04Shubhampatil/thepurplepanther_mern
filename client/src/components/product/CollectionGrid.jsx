import { useEffect, useState } from 'react'
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
 * QUICK ADD opens an in-card picker rather than adding the first colour and size silently.
 * Guessing meant a customer who wanted the silver button cover got the gold one and only
 * found out in the bag. A product with neither colours nor sizes has nothing to choose, so
 * it still goes straight in.
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

  // One picker open at a time: two half-finished choices in a grid read as a mistake.
  const [pickerId, setPickerId] = useState(null)
  const [choice, setChoice] = useState({ color: '', size: '' })
  const [busy, setBusy] = useState(false)

  // Escape closes it, as it does for the site's drawers.
  useEffect(() => {
    if (pickerId === null) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setPickerId(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [pickerId])

  if (!products || products.length === 0) {
    return <p className="collection-page__empty mb-0">No products found.</p>
  }

  async function addToBag(item, selection) {
    setBusy(true)
    try {
      await add({
        product_id: item.id,
        quantity: 1,
        ...(selection.color ? { color: selection.color } : {}),
        ...(selection.size ? { size: selection.size } : {}),
      })
      setPickerId(null)
      openDrawer()
    } catch {
      // The store holds the error; the bag simply does not open.
    } finally {
      setBusy(false)
    }
  }

  /** Opens the picker with the defaults preselected, so confirming is a single click. */
  function quickAdd(item) {
    const variant = defaultVariant(item)
    const hasChoice = (item.colors?.length ?? 0) > 0 || (item.sizes?.length ?? 0) > 0

    if (!hasChoice) return addToBag(item, variant)

    setChoice(variant)
    setPickerId(item.id)
    return undefined
  }

  return products.map((item, index) => {
    const variant = defaultVariant(item)
    const tall = (index + 1) % TALL_EVERY === 0
    const colors = item.colors ?? []
    const sizes = item.sizes ?? []
    const open = pickerId === item.id

    return (
      <article
        className={`collection-page__card${tall ? ' collection-page__card--tall' : ''}${
          open ? ' is-picking' : ''
        }`}
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
            aria-expanded={open}
          >
            Quick add
          </button>

          {/*
            Sits where the Quick add button sits, but OUTSIDE its hover rule: once opened it
            has to stay up while the pointer travels down to the options, so `.is-picking`
            hides the button and shows this instead.
          */}
          {open ? (
            <div
              className="collection-page__picker"
              role="group"
              aria-label={`Choose options for ${item.title}`}
            >
              <button
                type="button"
                className="collection-page__picker-close"
                onClick={() => setPickerId(null)}
                aria-label="Close options"
              >
                &times;
              </button>

              {colors.length > 0 ? (
                <div className="collection-page__picker-row">
                  <span className="collection-page__picker-label">Colour</span>
                  <div className="collection-page__picker-options">
                    {colors.map((color) => {
                      const name = String(color.name ?? '').toUpperCase()
                      const active = choice.color === name
                      return (
                        <button
                          type="button"
                          key={color.id ?? name}
                          title={color.name ?? ''}
                          aria-label={color.name ?? ''}
                          aria-pressed={active}
                          className={`collection-page__picker-swatch${active ? ' is-active' : ''}`}
                          style={{ '--swatch': color.code || '#3b3738' }}
                          onClick={() => setChoice((prev) => ({ ...prev, color: name }))}
                        />
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {sizes.length > 0 ? (
                <div className="collection-page__picker-row">
                  <span className="collection-page__picker-label">Size</span>
                  <div className="collection-page__picker-options">
                    {sizes.map((size) => {
                      const name = size.name ?? ''
                      const active = choice.size === name
                      return (
                        <button
                          type="button"
                          key={size.id ?? name}
                          aria-pressed={active}
                          className={`collection-page__picker-size${active ? ' is-active' : ''}`}
                          onClick={() => setChoice((prev) => ({ ...prev, size: name }))}
                        >
                          {name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                className="collection-page__picker-add"
                disabled={busy}
                onClick={() => addToBag(item, choice)}
              >
                {busy ? 'Adding…' : 'Add to bag'}
              </button>
            </div>
          ) : null}
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
