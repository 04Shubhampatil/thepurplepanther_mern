import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import { useCartStore } from '../../store/index.js'
import { loadRazorpay } from '../../utils/razorpay.js'
import Loading from '../../components/common/Loading.jsx'
import Seo from '../../components/common/Seo.jsx'
import Container from '../../components/ui/Container.jsx'
import Button from '../../components/ui/Button.jsx'
import Image from '../../components/ui/Image.jsx'
import Alert from '../../components/ui/Alert.jsx'
import { Field, Input, Textarea } from '../../components/ui/Field.jsx'

/**
 * Checkout.
 *
 * The payment flow, and why each step is where it is:
 *
 *   1. POST /checkout/place    -> server creates a PENDING order and a Razorpay order
 *   2. Razorpay modal opens with the server's amount (never one computed here)
 *   3. POST /checkout/verify   -> server verifies the HMAC signature and completes
 *
 * The browser never asserts that payment succeeded. It hands back Razorpay's three
 * identifiers and the server decides, so a forged callback cannot mark an order paid.
 */
export default function Checkout() {
  const navigate = useNavigate()
  const refreshCart = useCartStore((s) => s.refresh)

  const { data, error, loading } = useApi(() => api.checkout.context(), [])
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm()

  // Pre-fill from the signed-in customer's saved details.
  useEffect(() => {
    if (!data) return
    reset({
      first_name: data.checkoutUser?.firstName ?? '',
      last_name: data.checkoutUser?.lastName ?? '',
      email: data.checkoutUser?.email ?? '',
      phone: data.checkoutUser?.phone ?? '',
      address_line1: data.checkoutAddress?.address_line1 ?? '',
      address_line2: data.checkoutAddress?.address_line2 ?? '',
      city: data.checkoutAddress?.city ?? '',
      state: data.checkoutAddress?.state ?? '',
      pincode: data.checkoutAddress?.pincode ?? '',
      notes: '',
    })
  }, [data, reset])

  // An empty cart has nothing to pay for.
  useEffect(() => {
    if (error?.status === 422) navigate('/cart', { replace: true })
  }, [error, navigate])

  if (loading) return <Loading full />
  if (!data) return null

  const { cart } = data

  const onSubmit = async (values) => {
    setSubmitting(true)
    setFailure(null)

    try {
      // Step 1 — create the pending order.
      const placed = await api.checkout.place(values)

      // Step 2 — open Razorpay with the SERVER's amount and order id.
      const Razorpay = await loadRazorpay()
      const rzp = placed.razorpay

      const checkoutInstance = new Razorpay({
        key: rzp.key,
        amount: rzp.amount,
        currency: rzp.currency,
        order_id: rzp.orderId,
        name: rzp.name,
        description: rzp.description,
        prefill: rzp.prefill,
        theme: { color: '#3a1651' },

        // Step 3 — hand the identifiers back for server-side verification.
        handler: async (response) => {
          try {
            const result = await api.checkout.verify({
              order_id: placed.orderId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            })
            await refreshCart()
            navigate(result.redirect ?? `/order/${result.orderNumber}`, { replace: true })
          } catch (verifyError) {
            // The payment may well have succeeded — never tell the customer it failed.
            setFailure(
              `${verifyError.message} If your payment was taken, please contact support with order ${placed.orderNumber}.`,
            )
            setSubmitting(false)
          }
        },

        modal: {
          ondismiss: () => {
            // The order stays pending and can be retried; nothing is lost.
            setFailure('Payment was cancelled. Your order is saved and you can try again.')
            setSubmitting(false)
          },
        },
      })

      checkoutInstance.on('payment.failed', (response) => {
        setFailure(response?.error?.description ?? 'Payment failed. Please try again.')
        setSubmitting(false)
      })

      checkoutInstance.open()
    } catch (err) {
      if (err.errors) {
        Object.entries(err.errors).forEach(([field, messages]) => {
          setError(field, { type: 'server', message: messages[0] })
        })
      }
      setFailure(err.message)
      setSubmitting(false)
    }
  }

  const field = (name, label, options = {}) => {
    const id = `co-${name}`
    return (
      <Field
        label={label}
        htmlFor={id}
        required={options.required}
        error={errors[name]?.message}
        className={options.className}
      >
        <Input
          id={id}
          type={options.type ?? 'text'}
          autoComplete={options.autoComplete}
          error={errors[name]}
          {...register(name, options.required ? { required: `${label} is required.` } : {})}
        />
      </Field>
    )
  }

  return (
    <Container className="py-10 md:py-14">
      <Seo title="Checkout" noIndex />

      <h1 className="pp-heading">Checkout</h1>

      {!data.isLoggedIn && (
        <p className="mt-1 text-body">
          Already have an account?{' '}
          <Link to="/login" className="text-brand underline underline-offset-2">
            Sign in
          </Link>{' '}
          — or continue below and we will create one for you.
        </p>
      )}

      {failure && (
        <Alert tone="error" className="mt-5">
          {failure}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_400px] lg:gap-14">
          <div>
            <h2 className="pp-eyebrow text-ink">Delivery details</h2>

            <div className="mt-5 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                {field('first_name', 'First name', {
                  required: true,
                  autoComplete: 'given-name',
                })}
                {field('last_name', 'Last name', { required: true, autoComplete: 'family-name' })}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                {field('email', 'Email', { required: true, type: 'email', autoComplete: 'email' })}
                {field('phone', 'Phone', { required: true, type: 'tel', autoComplete: 'tel' })}
              </div>

              {field('address_line1', 'Address', {
                required: true,
                autoComplete: 'address-line1',
              })}
              {field('address_line2', 'Apartment, suite (optional)', {
                autoComplete: 'address-line2',
              })}

              <div className="grid gap-5 sm:grid-cols-3">
                {field('city', 'City', { required: true, autoComplete: 'address-level2' })}
                {field('state', 'State', { required: true, autoComplete: 'address-level1' })}
                {field('pincode', 'Pincode', { required: true, autoComplete: 'postal-code' })}
              </div>

              {/* We ship only within India; the server overrides any submitted country. */}
              <p className="text-[13px] text-body">We currently deliver within India only.</p>

              <Field label="Order notes (optional)" htmlFor="co-notes">
                <Textarea id="co-notes" rows={3} {...register('notes')} />
              </Field>
            </div>
          </div>

          <aside className="h-fit border border-line p-6 lg:sticky lg:top-24">
            <h2 className="pp-eyebrow text-ink">Your order</h2>

            <ul className="mt-4">
              {cart.items.map((item) => (
                <li key={item.lineKey} className="flex gap-3 border-b border-line py-3.5">
                  <Image src={item.image} alt="" className="w-[52px] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-ink">{item.title}</p>
                    {(item.color || item.size || item.packageLabel) && (
                      <p className="mt-0.5 text-[12px] text-body">
                        {[item.color, item.size, item.packageLabel].filter(Boolean).join(' / ')}
                      </p>
                    )}
                    <p className="mt-0.5 text-[13px] text-body">Qty {item.quantity}</p>
                  </div>
                  <span className="shrink-0 text-[14px] text-ink">{item.lineTotalFormatted}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-5 space-y-2.5 text-[14px]">
              <div className="flex justify-between gap-4">
                <dt className="text-body">Subtotal</dt>
                <dd className="text-ink">{cart.subtotalFormatted}</dd>
              </div>

              {cart.discount.amount > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-body">
                    Discount{cart.discount.code ? ` (${cart.discount.code})` : ''}
                  </dt>
                  <dd className="text-brand">− {cart.discount.amountFormatted}</dd>
                </div>
              )}

              <div className="flex justify-between gap-4">
                <dt className="text-body">Delivery</dt>
                <dd className="text-ink">{cart.shipping.amountFormatted}</dd>
              </div>
            </dl>

            <div className="mt-5 flex justify-between gap-4 border-t border-line pt-5 text-[17px] font-semibold text-ink">
              <span>Total</span>
              <span>{cart.totalFormatted}</span>
            </div>

            <Button type="submit" size="sm" loading={submitting} className="mt-6 w-full">
              {submitting ? 'Processing…' : 'Pay securely'}
            </Button>

            <p className="mt-3 flex items-start gap-2 text-[12px] text-body">
              <Lock size={14} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0" />
              Payments are processed by Razorpay. Your card details never reach our servers.
            </p>
          </aside>
        </div>
      </form>
    </Container>
  )
}
