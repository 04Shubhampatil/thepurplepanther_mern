import { useState } from 'react'
import { useCartStore } from '../../store/index.js'
import { defaultVariant } from '../../utils/variant-label.js'

/**
 * The "QUICK ADD" button on product cards — cart.js's `[data-add-to-cart]` handler.
 *
 * cart.js read the default colour and size off the card's `data-default-*` attributes and
 * posted those with the product id; the attributes are still emitted (the theme's CSS and
 * any remaining selectors expect them) but the values now come straight from props.
 *
 * The "Added" flash and `is-added` class are cart.js's feedback, kept because the button
 * has no other way of confirming that a click landed — the bag drawer opening is the rest
 * of it, and that is what `openBag: true` did.
 */
export default function QuickAdd({ product, className = 'product-btn', label = 'QUICK ADD' }) {
  const add = useCartStore((s) => s.add)
  const openDrawer = useCartStore((s) => s.openDrawer)
  const [added, setAdded] = useState(false)

  const variant = defaultVariant(product)

  async function onClick(event) {
    event.preventDefault()
    event.stopPropagation()

    try {
      await add({
        product_id: product.id,
        quantity: 1,
        ...(variant.color ? { color: variant.color } : {}),
        ...(variant.size ? { size: variant.size } : {}),
      })
      openDrawer()
      setAdded(true)
      setTimeout(() => setAdded(false), 1500)
    } catch {
      // The store already holds the error; the bag simply does not open.
    }
  }

  return (
    <button
      type="button"
      className={`${className}${added ? ' is-added' : ''}`}
      data-add-to-cart
      data-product-id={product.id}
      data-default-color={variant.color}
      data-default-size={variant.size}
      onClick={onClick}
    >
      {added ? 'Added' : label}
    </button>
  )
}
