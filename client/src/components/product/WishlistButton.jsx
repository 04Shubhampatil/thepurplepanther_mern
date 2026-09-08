import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/index.js'
import { toast } from '../../utils/toast.js'
import * as api from '../../services/endpoints.js'

/**
 * The heart on a product card — wishlist-toggle.js.
 *
 * Two behaviours from the original are worth keeping deliberately:
 *
 *   - a signed-out visitor is sent to /login with `?account=required`, and the wishlist
 *     they were reaching for is stashed so they land there after signing in. Silently
 *     doing nothing, or adding to a local list the server never sees, both lose the click.
 *   - the button only ever ADDS. It is not a toggle, despite looking like one; a second
 *     click re-adds and the server treats it as idempotent.
 *
 * `is-wishlisted` is the class the theme styles as the filled state.
 */
export default function WishlistButton({ product, className, children, label }) {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [wishlisted, setWishlisted] = useState(false)

  async function onClick(event) {
    event.preventDefault()
    event.stopPropagation()

    if (!user) {
      try {
        sessionStorage.setItem('pp_account_return', '/account/wishlist')
      } catch {
        // Blocked storage only costs the redirect back, not the sign-in.
      }
      navigate('/login?account=required')
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
