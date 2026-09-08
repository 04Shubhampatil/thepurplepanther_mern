import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Trash2, ShoppingBag } from 'lucide-react'
import Drawer from '../ui/Drawer.jsx'
import Image from '../ui/Image.jsx'
import Button from '../ui/Button.jsx'
import { useCartStore } from '../../store/index.js'

/**
 * Cart panel.
 *
 * Every figure shown is the server's pre-formatted string. Nothing here adds anything up:
 * the server is the single source of truth for money, so what the customer sees cannot
 * disagree with what checkout charges.
 */
export default function CartDrawer() {
  const { cart, drawerOpen, closeDrawer, remove, loading } = useCartStore()

  const removeLine = (item) =>
    remove(item.productId, {
      color: item.color,
      size: item.size,
      package_key: item.packageKey,
    })

  const footer =
    cart.items.length > 0 ? (
      <div className="space-y-3">
        <dl className="space-y-2 text-[14px]">
          <div className="flex justify-between">
            <dt className="text-body">Subtotal</dt>
            <dd className="text-ink">{cart.subtotalFormatted}</dd>
          </div>

          {cart.discount.amount > 0 && (
            <div className="flex justify-between text-brand">
              <dt>Discount{cart.discount.code ? ` (${cart.discount.code})` : ''}</dt>
              <dd>− {cart.discount.amountFormatted}</dd>
            </div>
          )}

          <div className="flex justify-between">
            <dt className="text-body">Delivery</dt>
            <dd className="text-ink">{cart.shipping.amountFormatted}</dd>
          </div>

          <div className="flex justify-between border-t border-line pt-2 text-[16px] font-semibold">
            <dt className="text-ink">Total</dt>
            <dd className="text-ink">{cart.totalFormatted}</dd>
          </div>
        </dl>

        <div className="flex gap-3 pt-1">
          <Button to="/cart" variant="outline" size="sm" className="flex-1" onClick={closeDrawer}>
            View cart
          </Button>
          <Button to="/checkout" size="sm" className="flex-1" onClick={closeDrawer}>
            Checkout
          </Button>
        </div>
      </div>
    ) : null

  return (
    <Drawer
      open={drawerOpen}
      onClose={closeDrawer}
      title={`Your cart (${cart.count})`}
      footer={footer}
    >
      {cart.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <ShoppingBag size={32} strokeWidth={1.2} aria-hidden="true" className="text-body/50" />
          <p className="mt-4 text-body">Your cart is empty.</p>
          <Button to="/shop" variant="outline" size="sm" className="mt-6" onClick={closeDrawer}>
            Continue shopping
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-line px-6">
          <AnimatePresence initial={false}>
            {cart.items.map((item) => (
              <motion.li
                key={item.lineKey}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="flex gap-4 overflow-hidden py-4"
              >
                <Link to={item.url} onClick={closeDrawer} className="w-[72px] shrink-0">
                  <Image src={item.image} alt="" ratio="product" />
                </Link>

                <div className="min-w-0 flex-1">
                  <Link
                    to={item.url}
                    onClick={closeDrawer}
                    className="line-clamp-2 text-[14px] text-ink transition-colors hover:text-brand"
                  >
                    {item.title}
                  </Link>

                  {(item.color || item.size || item.packageLabel) && (
                    <p className="mt-1 text-[12px] text-body">
                      {[item.color, item.size, item.packageLabel].filter(Boolean).join(' / ')}
                    </p>
                  )}

                  <p className="mt-1 text-[13px] text-ink">
                    {item.quantity} × {item.unitPriceFormatted}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => removeLine(item)}
                  disabled={loading}
                  aria-label={`Remove ${item.title} from cart`}
                  className="h-fit p-1.5 text-body transition-colors hover:text-brand disabled:opacity-40"
                >
                  <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Drawer>
  )
}
