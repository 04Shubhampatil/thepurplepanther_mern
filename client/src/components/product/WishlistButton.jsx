import { useState } from 'react'
import { useAuthStore } from '../../store/index.js'
import { useUiStore } from '../../store/ui.js'
import { toast } from '../../utils/toast.js'
import * as api from '../../services/endpoints.js'

/**
 * The heart on a product card — wishlist-toggle.js.
 *
 * Two behaviours from the original are worth keeping deliberately:
 *
 *   - a signed-out visitor gets the account drawer, with the wishlist stashed as where to
 *     land afterwards — site-drawers.js's behaviour. Saving something should not cost you
 *     the product you were looking at, which navigating away to /login does.
 *   - the button only ever ADDS. It is not a toggle, despite looking like one; a second
 *     click re-adds and the server treats it as idempotent.
 *
 * `is-wishlisted` is the class the theme styles as the filled state.
 */
export default function WishlistButton({ product, className, children, label }) {
  const user = useAuthStore((s) => s.user)
  const openAccount = useUiStore((s) => s.openAccount)
  const [busy, setBusy] = useState(false)
  const [wishlisted, setWishlisted] = useState(false)

  async function onClick(event) {
    event.preventDefault()
    event.stopPropagation()

    if (!user) {
      openAccount('/account/wishlist')
      return
    }

    setBusy(true)
    try {
      const response = await api.account.addToWishlist(product.id)
      toast(response?.message ?? 'Added to wishlist.')
      setWishlisted(true)
    } catch (error) {
      toast(error.message || 'Could not add to wishlist.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={`${className}${wishlisted ? ' is-wishlisted' : ''}`}
      data-wishlist-product={product.id}
      aria-label={label ?? `Add ${product.title} to wishlist`}
      disabled={busy}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
