import { useParams, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Check, Truck } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import Loading from '../../components/common/Loading.jsx'
import Seo from '../../components/common/Seo.jsx'
import NotFound from '../NotFound.jsx'
import { formatDate } from '../../utils/format.js'
import Container from '../../components/ui/Container.jsx'
import Button from '../../components/ui/Button.jsx'
import Image from '../../components/ui/Image.jsx'

/**
 * Order confirmation.
 *
 * The server refuses this page for an order that has not been paid, so a customer who
 * abandons payment cannot land on a page implying their order went through.
 */
export default function OrderConfirmation() {
  const { orderNumber } = useParams()
  const { data, error, loading } = useApi(() => api.checkout.order(orderNumber), [orderNumber])

  if (error?.status === 404) return <NotFound />
  if (loading) return <Loading full />

  if (error) {
    // 422 = payment not completed; 403 = someone else's order.
    return (
      <Container className="py-20 text-center md:py-28">
        <Seo title="Order" noIndex />
        <h1 className="pp-heading">We could not show this order</h1>
        <p className="mx-auto mt-3 max-w-md text-body">{error.message}</p>
        <Button to="/cart" className="mt-7">
          Back to cart
        </Button>
      </Container>
    )
  }

  const order = data?.order
  if (!order) return <NotFound />

  return (
    <Container className="py-12 md:py-16">
      <Seo title={`Order ${order.number}`} noIndex />

      <div className="mx-auto max-w-[760px]">
        <header className="text-center">
          {/* A single restrained entrance — the confirmation is the one moment on the site
              where a small flourish is warranted. */}
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="mx-auto grid size-14 place-items-center rounded-full bg-brand-tint text-brand"
          >
            <Check size={26} strokeWidth={1.75} aria-hidden="true" />
          </motion.span>

          <h1 className="pp-heading mt-5">Thank you for your order</h1>
          <p className="mt-2 text-body">
            Order <strong className="font-semibold text-ink">{order.number}</strong> · {order.date}
          </p>
          <p className="text-body">A confirmation email is on its way to {order.shippingEmail}.</p>
        </header>

        <section className="mt-10 border border-line p-6">
          <h2 className="pp-eyebrow text-ink">Your items</h2>

          <ul className="mt-4">
            {order.items.map((item, index) => (
              <li key={index} className="flex gap-4 border-b border-line py-4">
                <Image src={item.image} alt="" className="w-[56px] shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] text-ink">{item.title}</p>
                  {(item.color || item.size || item.packageLabel) && (
                    <p className="mt-0.5 text-[13px] text-body">
                      {[item.color, item.size, item.packageLabel].filter(Boolean).join(' / ')}
                    </p>
                  )}
                  <p className="mt-0.5 text-[13px] text-body">Qty {item.qty}</p>
                </div>
                <span className="shrink-0 text-[14px] text-ink">{item.totalFormatted}</span>
              </li>
            ))}
          </ul>

          <dl className="mt-5 space-y-2.5 text-[14px]">
            <div className="flex justify-between gap-4">
              <dt className="text-body">Subtotal</dt>
              <dd className="text-ink">{order.subtotalFormatted}</dd>
            </div>

            {order.discount > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-body">
                  Discount{order.couponCode ? ` (${order.couponCode})` : ''}
                </dt>
                <dd className="text-brand">− {order.discountFormatted}</dd>
              </div>
            )}

            <div className="flex justify-between gap-4">
              <dt className="text-body">Delivery</dt>
              <dd className="text-ink">{order.shippingFormatted}</dd>
            </div>
          </dl>

          <div className="mt-5 flex justify-between gap-4 border-t border-line pt-5 text-[17px] font-semibold text-ink">
            <span>Total paid</span>
            <span>{order.totalFormatted}</span>
          </div>
        </section>

        <section className="mt-8 border border-line p-6">
          <h2 className="pp-eyebrow text-ink">Delivering to</h2>
          <address className="mt-3 not-italic text-body">
            <span className="text-ink">{order.shippingName}</span>
            <br />
            {order.shippingLines.join(', ')}
            <br />
            {order.shippingPhone}
          </address>

          {order.expectedDeliveryDate && (
            <p className="mt-4 flex items-center gap-2 text-[14px] text-ink">
              <Truck size={16} strokeWidth={1.5} aria-hidden="true" className="text-brand" />
              Expected delivery: {formatDate(order.expectedDeliveryDate)}
            </p>
          )}
        </section>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button to="/account/orders" size="sm">
            View your orders
          </Button>
          <Button to="/shop" variant="outline" size="sm">
            Continue shopping
          </Button>
        </div>
      </div>
    </Container>
  )
}
