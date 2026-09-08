import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Heart } from 'lucide-react'
import { useAuthStore } from '../../store/index.js'
import * as api from '../../services/endpoints.js'

/**
 * Wishlist toggle.
 *
 * The wishlist requires an account, so a signed-out visitor is sent to sign in with a
 * return path rather than being shown a control that silently fails.
 *
 * The add is idempotent server-side (unique on user + product), so a double click cannot
 * create a duplicate.
 */
export default function WishlistButton({ productId, productTitle = 'this product', className = '' }) {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [added, setAdded] = useState(false)
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    if (!user) {
      navigate('/login', { state: { from: window.location.pathname } })
      return
    }

    setBusy(true)
    try {
      if (added) {
        await api.account.removeWishlistProduct(productId)
        setAdded(false)
      } else {
        await api.account.addToWishlist(productId)
        setAdded(true)
      }
    } catch {
      // A wishlist failure must never interrupt browsing; the state simply does not flip.
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.button
      type="button"
      onClick={toggle}
      disabled={busy}
      whileTap={{ scale: 0.88 }}
      aria-pressed={added}
      aria-label={added ? `Remove ${productTitle} from wishlist` : `Add ${productTitle} to wishlist`}
      className={`pointer-events-auto grid size-9 place-items-center bg-white/95 text-ink shadow-sm transition-colors hover:text-brand disabled:opacity-50 ${className}`}
    >
      <Heart
        size={17}
        strokeWidth={1.5}
        aria-hidden="true"
        className={added ? 'fill-brand text-brand' : ''}
      />
    </motion.button>
  )
}
