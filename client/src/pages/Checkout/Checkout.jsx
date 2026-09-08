import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, Link } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import { useCartStore } from '../../store/index.js'
import { loadRazorpay } from '../../utils/razorpay.js'
import Money from '../../components/common/Money.jsx'
import Loading from '../../components/common/Loading.jsx'
import Seo from '../../components/common/Seo.jsx'

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

  const field = (name, label, options = {}) => (
    <div className="form-group">
      <label htmlFor={`co-${name}`}>
        {label}
        {options.required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={`co-${name}`}
        type={options.type ?? 'text'}
        className="form-control"
        autoComplete={options.autoComplete}
        aria-invalid={Boolean(errors[name])}
        {...register(name, options.required ? { required: `${label} is required.` } : {})}
      />
      {errors[name] && (
        <p role="alert" style={{ color: '#b00', fontSize: 13 }}>
          {errors[name].message}
        </p>
      )}
    </div>
  )

  return (
    <div className="container pp-checkout" style={{ padding: '32px 0' }}>
      <Seo title="Checkout" noIndex />
      <h1>Checkout</h1>

      {!data.isLoggedIn && (
        <p style={{ opacity: 0.8 }}>
          Already have an account? <Link to="/login">Sign in</Link> — or continue below and we
          will create one for you.
        </p>
      )}

      {failure && (
        <div className="alert alert-danger" role="alert">
          {failure}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="row">
          <div className="col-lg-7">
            <h2 style={{ fontSize: 20 }}>Delivery details</h2>

            <div className="row">
              <div className="col-sm-6">
                {field('first_name', 'First name', { required: true, autoComplete: 'given-name' })}
              </div>
              <div className="col-sm-6">
                {field('last_name', 'Last name', { required: true, autoComplete: 'family-name' })}
              </div>
            </div>

            {field('email', 'Email', { required: true, type: 'email', autoComplete: 'email' })}
            {field('phone', 'Phone', { required: true, type: 'tel', autoComplete: 'tel' })}
            {field('address_line1', 'Address', { required: true, autoComplete: 'address-line1' })}
            {field('address_line2', 'Apartment, suite (optional)', { autoComplete: 'address-line2' })}

            <div className="row">
              <div className="col-sm-4">
                {field('city', 'City', { required: true, autoComplete: 'address-level2' })}
              </div>
              <div className="col-sm-4">
                {field('state', 'State', { required: true, autoComplete: 'address-level1' })}
              </div>
              <div className="col-sm-4">
                {field('pincode', 'Pincode', { required: true, autoComplete: 'postal-code' })}
              </div>
            </div>

            {/* We ship only within India; the server overrides any submitted country. */}
            <p style={{ fontSize: 13, opacity: 0.7 }}>We currently deliver within India only.</p>

            <div className="form-group">
              <label htmlFor="co-notes">Order notes (optional)</label>
              <textarea id="co-notes" rows="3" className="form-control" {...register('notes')} />
            </div>
          </div>

          <div className="col-lg-5">
            <aside style={{ border: '1px solid #eee', padding: 20 }}>
              <h2 style={{ fontSize: 18 }}>Your order</h2>

              <ul style={{ listStyle: 'none', padding: 0 }}>
                {cart.items.map((item) => (
                  <li
                    key={item.lineKey}
                    style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}
                  >
                    <img src={item.image} alt="" width="52" height="70" loading="lazy" />
                    <div style={{ flex: 1 }}>
                      <span>{item.title}</span>
                      {(item.color || item.size || item.packageLabel) && (
                        <p style={{ fontSize: 12, opacity: 0.7, margin: 0 }}>
                          {[item.color, item.size, item.packageLabel].filter(Boolean).join(' / ')}
                        </p>
                      )}
                      <span style={{ fontSize: 13 }}>Qty {item.quantity}</span>
                    </div>
                    <Money formatted={item.lineTotalFormatted} />
                  </li>
                ))}
              </ul>

              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
                <span>Subtotal</span>
                <Money formatted={cart.subtotalFormatted} />
              </div>

              {cart.discount.amount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
                  <span>Discount{cart.discount.code ? ` (${cart.discount.code})` : ''}</span>
                  <span>− <Money formatted={cart.discount.amountFormatted} /></span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0' }}>
                <span>Delivery</span>
                <Money formatted={cart.shipping.amountFormatted} />
              </div>

              <hr />

              <div
                style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 18 }}
              >
                <span>Total</span>
                <Money formatted={cart.totalFormatted} />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 20 }}
                disabled={submitting}
              >
                {submitting ? 'Processing…' : 'Pay securely'}
              </button>

              <p style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>
                Payments are processed by Razorpay. Your card details never reach our servers.
              </p>
            </aside>
          </div>
        </div>
      </form>
    </div>
  )
}
