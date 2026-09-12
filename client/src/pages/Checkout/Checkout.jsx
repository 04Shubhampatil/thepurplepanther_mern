import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, Link } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import { useAuthStore, useCartStore } from '../../store/index.js'
import { loadRazorpay } from '../../utils/razorpay.js'
import Loading from '../../components/common/Loading.jsx'
import { useBodyClass, usePageTitle } from '../../theme/page.js'

/**
 * frontend/pages/checkout.blade.php, with the flow from checkout.js.
 *
 * checkout.blade.php opens with a bare `<body>`; useBodyClass() with no classes matches it.
 * Without this the homepage's body class stays on and style.css hides the header's
 * announcement bar (see pages/Cart/Cart.jsx).
 *
 * The payment sequence is unchanged and the order of its steps is the security property:
 *
 *   1. POST /checkout/place    -> server creates a PENDING order and a Razorpay order
 *   2. Razorpay modal opens with the SERVER's amount and order id, never one from here
 *   3. POST /checkout/verify   -> server checks the HMAC signature and completes
 *
 * The browser never asserts that payment succeeded. It hands back Razorpay's three
 * identifiers and the server decides, so a forged callback cannot mark an order paid.
 *
 * A failed VERIFY is deliberately not reported as a failed payment: the money may well have
 * been taken, and telling someone their payment failed when it did not is the worse error.
 */
export default function Checkout() {
  const navigate = useNavigate()
  const refreshCart = useCartStore((s) => s.refresh)
  const cart = useCartStore((s) => s.cart)
  const applyCoupon = useCartStore((s) => s.applyCoupon)
  const removeCoupon = useCartStore((s) => s.removeCoupon)
  const user = useAuthStore((s) => s.user)

  useBodyClass()
  usePageTitle('Checkout - The Purple Panther')

  const { data, error, loading } = useApi(() => api.checkout.context(), [])
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState(null)
  const [couponCode, setCouponCode] = useState('')
  const [couponMessage, setCouponMessage] = useState('')

  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm()

  // Blade pre-filled these from the signed-in customer with `old(...)` fallbacks.
  useEffect(() => {
    if (!data) return
    reset({
      first_name: data.checkoutUser?.firstName ?? '',
      last_name: data.checkoutUser?.lastName ?? '',
      company: '',
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

  useEffect(() => {
    setCouponCode(cart.discount?.code ?? '')
  }, [cart.discount?.code])

  // An empty cart has nothing to pay for.
  useEffect(() => {
    if (error?.status === 422) navigate('/cart', { replace: true })
  }, [error, navigate])

  if (loading) return <Loading full />
  if (!data) return null

  const isLoggedIn = Boolean(user)
  const items = cart.items ?? []
  const discount = cart.discount ?? {}
  const shipping = cart.shipping ?? {}
  const hasDiscount = Boolean(discount.code) && (Number(discount.amount ?? 0) > 0 || discount.freeShipping)

  async function onApplyCoupon() {
    setCouponMessage('')
    try {
      const result = await applyCoupon(couponCode.trim())
      setCouponMessage(result?.message ?? '')
    } catch (couponError) {
      setCouponMessage(couponError.message || 'That code could not be applied.')
    }
  }

  async function onRemoveCoupon() {
    setCouponMessage('')
    await removeCoupon()
    setCouponCode('')
  }

  const onSubmit = async (values) => {
    setSubmitting(true)
    setFailure(null)

    try {
      const placed = await api.checkout.place(values)

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

  return (
    <main className="body_content_wrapper position-relative">
      <section className="page-title pt120">
        <div className="container">
          <div className="row">
            <div className="col-xxl-8 mx-auto">
              <div className="breadcrumb-list text-center">
                <ul>
                  <li className="breadcrumb-list list-inline-item"><Link to="/cart">SHOPPING CART</Link></li>
                  <li className="breadcrumb-list list-inline-item"><a href="#"><i className="far fa-angle-right"></i></a></li>
                  <li className="breadcrumb-list list-inline-item active"><Link to="/checkout">CHECKOUT</Link></li>
                  <li className="breadcrumb-list list-inline-item"><a href="#"><i className="far fa-angle-right"></i></a></li>
                  <li className="breadcrumb-list list-inline-item is-disabled"><span>ORDER COMPLETE</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="shop-checkout pt30 pb40">
        <div className="container">
          <div className="row mt15" id="pp-checkout-app">
            <div className="col-lg-7">
              <div className="checkout_form">
                <h4 className="title text-uppercase mb5">Billing details</h4>
                {isLoggedIn ? (
                  <p className="text-muted mb-3">Signed in — your details are filled in below.</p>
                ) : (
                  <p className="text-muted mb-3">
                    Guest checkout — we’ll create your account if this email is new. If it’s already
                    registered, please <Link to="/login">log in</Link>.
                  </p>
                )}

                <form className="form" id="pp-checkout-form" noValidate onSubmit={handleSubmit(onSubmit)}>
                  <div className="row">
                    <div className="col-sm-6">
                      <div className="form-floating mb30">
                        <input {...register('first_name', { required: 'First name is required' })} id="pp_first_name" className="form-control" type="text" required placeholder="First name" />
                        <label htmlFor="pp_first_name" className="form-label">First Name *</label>
                        <div className="invalid-feedback d-block" data-error-for="first_name">{errors.first_name?.message}</div>
                      </div>
                    </div>
                    <div className="col-sm-6">
                      <div className="form-floating mb30">
                        <input {...register('last_name', { required: 'Last name is required' })} id="pp_last_name" className="form-control" type="text" required placeholder="Last name" />
                        <label htmlFor="pp_last_name" className="form-label">Last Name *</label>
                        <div className="invalid-feedback d-block" data-error-for="last_name">{errors.last_name?.message}</div>
                      </div>
                    </div>
                    <div className="col-sm-12">
                      <div className="form-floating mb30">
                        <input {...register('company')} id="pp_company" className="form-control" type="text" placeholder="Company name" />
                        <label htmlFor="pp_company" className="form-label">Company name (optional)</label>
                      </div>
                    </div>
                    <div className="col-lg-12">
                      <div className="mb30">
                        <label className="form-label d-block mb-2" htmlFor="pp_country">Country / Region *</label>
                        <input type="hidden" name="country" value="India" readOnly />
                        <input id="pp_country" className="form-control" type="text" value="India" readOnly tabIndex="-1" aria-readonly="true" />
                        <div className="invalid-feedback" data-error-for="country"></div>
                      </div>
                    </div>
                    <div className="col-sm-12">
                      <div className="form-floating mb30">
                        <input {...register('address_line1', { required: 'Address is required' })} id="pp_address1" className="form-control" type="text" required placeholder="Street address" />
                        <label htmlFor="pp_address1" className="form-label">House number and street name *</label>
                        <div className="invalid-feedback d-block" data-error-for="address_line1">{errors.address_line1?.message}</div>
                      </div>
                    </div>
                    <div className="col-sm-12">
                      <div className="form-floating mb30">
                        <input {...register('address_line2')} id="pp_address2" className="form-control" type="text" placeholder="Apartment" />
                        <label htmlFor="pp_address2" className="form-label">Apartment, suite, unit, etc. (optional)</label>
                      </div>
                    </div>
                    <div className="col-sm-12">
                      <div className="form-floating mb30">
                        <input {...register('city', { required: 'City is required' })} id="pp_city" className="form-control" type="text" required placeholder="City" />
                        <label htmlFor="pp_city" className="form-label">Town / City *</label>
                        <div className="invalid-feedback d-block" data-error-for="city">{errors.city?.message}</div>
                      </div>
                    </div>
                    <div className="col-sm-12">
                      <div className="form-floating mb30">
                        <input {...register('state', { required: 'State is required' })} id="pp_state" className="form-control" type="text" required placeholder="State" />
                        <label htmlFor="pp_state" className="form-label">State *</label>
                        <div className="invalid-feedback d-block" data-error-for="state">{errors.state?.message}</div>
                      </div>
                    </div>
                    <div className="col-sm-12">
                      <div className="form-floating mb30">
                        <input {...register('pincode', { required: 'PIN code is required' })} id="pp_pincode" className="form-control" type="text" required placeholder="Zip / PIN" />
                        <label htmlFor="pp_pincode" className="form-label">Zip / PIN code *</label>
                        <div className="invalid-feedback d-block" data-error-for="pincode">{errors.pincode?.message}</div>
                      </div>
                    </div>
                    <div className="col-sm-12">
                      <div className="form-floating mb30">
                        <input {...register('phone', { required: 'Phone is required' })} id="pp_phone" className="form-control" type="tel" required placeholder="Phone" />
                        <label htmlFor="pp_phone" className="form-label">Phone *</label>
                        <div className="invalid-feedback d-block" data-error-for="phone">{errors.phone?.message}</div>
                      </div>
                    </div>
                    <div className="col-sm-12">
                      <div className="form-floating mb30">
                        <input
                          {...register('email', { required: 'Email is required' })}
                          id="pp_email"
                          className="form-control"
                          type="email"
                          required
                          placeholder="Email"
                          readOnly={isLoggedIn}
                        />
                        <label htmlFor="pp_email" className="form-label">Email Address *</label>
                        <div className="invalid-feedback d-block" data-error-for="email">{errors.email?.message}</div>
                        <div className="form-text" id="pp-email-status"></div>
                      </div>
                    </div>
                    <div className="col-sm-12">
                      <div className="mb20 mt30">
                        <h4 className="title text-uppercase">Additional information</h4>
                      </div>
                      <div className="form-floating mb40">
                        <textarea {...register('notes')} id="pp_notes" className="form-control" rows="6" placeholder="Order notes" />
                        <label htmlFor="pp_notes" className="form-label">Order Notes (optional)</label>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="checkout_sidebar">
                <div className="order-widget">
                  <h4 className="title text-uppercase mb20">Your Order</h4>
                  <Link to="/cart" className="edit-order">EDIT ORDER</Link>

                  {items.length === 0 ? (
                    <p className="text-muted mt-3">Your cart is empty.</p>
                  ) : (
                    items.map((item) => (
                      <div className="prd-item d-flex mb-2 mt30 mb20" key={item.lineKey}>
                        <div className="img flex-shrink-0">
                          <img className="float-start mr15" src={item.image} alt={item.title} width="70" height="100" style={{ objectFit: 'cover' }} />
                        </div>
                        <div className="cart_dtls flex-grow-1">
                          <span className="prd-title d-block mb5">
                            {item.title} <small className="float-end">{item.lineTotalFormatted}</small>
                          </span>
                          <span className="prd-qntt d-block">Quantity: {item.quantity}</span>
                          {item.size && <span className="prd-size d-block">Size: {item.size}</span>}
                          {item.color && <span className="prd-color d-block">Color: {item.color}</span>}
                          {item.packageLabel && <span className="prd-pack d-block">Pack: {item.packageLabel}</span>}
                        </div>
                      </div>
                    ))
                  )}

                  <div className="checkout-price-table cart-total-widget p-0 border-0">
                    <div className="cart_coupon position-relative mb-3" data-coupon-box>
                      <div className="input-group">
                        <input
                          className="form-control coupon_input"
                          type="text"
                          name="coupon_code"
                          data-coupon-input
                          placeholder="Coupon code"
                          value={couponCode}
                          readOnly={Boolean(discount.code)}
                          aria-label="Coupon code"
                          onChange={(event) => setCouponCode(event.target.value)}
                        />
                        <button className="btn btn-dark" type="button" data-coupon-apply hidden={Boolean(discount.code)} onClick={onApplyCoupon}>Apply</button>
                        <button className="btn btn-outline-dark" type="button" data-coupon-remove hidden={!discount.code} onClick={onRemoveCoupon}>Remove</button>
                      </div>
                      <div className="small mt-2" data-coupon-message hidden={!couponMessage}>{couponMessage}</div>
                    </div>

                    <ul>
                      <li className="bb1 d-flex align-items-center justify-content-between">
                        <span className="text">Subtotal</span>
                        <span className="value" data-cart-subtotal>{cart.subtotalFormatted}</span>
                      </li>
                      <li className="bb1 d-flex align-items-center justify-content-between" data-cart-discount-row hidden={!hasDiscount}>
                        <span className="text" data-cart-discount-label>Discount{discount.code ? ` (${discount.code})` : ''}</span>
                        <span className="value" data-cart-discount>-{discount.amountFormatted ?? '₹ 0.00'}</span>
                      </li>
                      <li className="bb1 d-flex align-items-center justify-content-between">
                        <span className="text">Shipping</span>
                        <span className="value" data-cart-shipping>{shipping.amountFormatted ?? 'Free'}</span>
                      </li>
                      <li className="bb1 d-flex align-items-center justify-content-between text-end">
                        <span className="text2">Total</span>
                        <span className="text2" data-cart-total>{cart.totalFormatted}</span>
                      </li>
                    </ul>

                    <p className="small text-muted mt-2 mb-0" data-cart-shipping-message>
                      {shipping.isFree === false
                        ? `Free shipping on orders of ₹ ${Math.round(Number(shipping.freeShippingThreshold ?? 0))} or more.`
                        : 'Free shipping applied.'}
                    </p>
                  </div>
                </div>

                <div className="payment-widget mt30">
                  <div className="radiobox bb1">
                    <div className="radio mb15">
                      <input id="pp_pay_razorpay" name="payment_method" type="radio" value="razorpay" defaultChecked />
                      <label className="bnk-title" htmlFor="pp_pay_razorpay"><span className="radio-label"></span> Razorpay</label>
                    </div>
                    <div className="pm_details">
                      <p className="text mb-0">Pay securely by card, UPI, netbanking, or wallet via Razorpay.</p>
                    </div>
                  </div>

                  <div id="pp-checkout-alert" className="alert alert-danger mt-3" hidden={!failure}>{failure}</div>

                  <div className="su-frame-7-btn mt20">
                    <button
                      type="button"
                      id="pp-place-order"
                      className="pp-place-order-btn w-100 text-center border-0"
                      disabled={submitting || items.length === 0}
                      onClick={handleSubmit(onSubmit)}
                    >
                      {submitting ? 'PLEASE WAIT…' : 'PLACE ORDER'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
