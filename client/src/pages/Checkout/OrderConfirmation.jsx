import { Link, useParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import Loading from '../../components/common/Loading.jsx'
import NotFound from '../NotFound.jsx'
import { useBodyClass, usePageTitle } from '../../theme/page.js'
import * as api from '../../services/endpoints.js'

/**
 * frontend/pages/order.blade.php — the order-complete step.
 *
 * order.blade.php opens with a bare `<body>`; useBodyClass() with no classes matches it and
 * keeps the header's announcement bar visible (see pages/Cart/Cart.jsx).
 *
 * The breadcrumb's third step is the active one here and carries no link, which is what
 * marks the flow as finished; cart and checkout above it stay clickable exactly as Blade
 * left them.
 *
 * Ownership is enforced by the API, not by this page: GET /orders/:orderNumber 403s an
 * order that belongs to someone else, so a guessed order number shows nothing.
 */
export default function OrderConfirmation() {
  const { orderNumber } = useParams()
  useBodyClass()

  const { data, error, loading } = useApi(() => api.checkout.order(orderNumber), [orderNumber])
  const order = data?.order ?? data ?? null
  const items = order?.items ?? []

  // Blade fell back to today's date when an order had none recorded.
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  usePageTitle(order ? `Order ${order.number} - The Purple Panther` : 'Order - The Purple Panther')

  if (error?.status === 404 || error?.status === 403) return <NotFound />
  if (loading) return <Loading full />

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
                <li className="breadcrumb-list list-inline-item"><Link to="/checkout">CHECKOUT</Link></li>
                <li className="breadcrumb-list list-inline-item"><a href="#"><i className="far fa-angle-right"></i></a></li>
                <li className="breadcrumb-list list-inline-item active">
                  <span>ORDER COMPLETE</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* Order start*/}
    <section className="shop-checkout pt100 pb90">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-6">
            <div className="section-title text-center mb20">
              <div className="icon mb25">
                <svg width="70" height="70" viewBox="0 0 70 70" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M58.2422 44.0234C60.5076 44.0234 62.3438 45.8596 62.3438 48.125C62.3438 50.3891 60.5062 52.2266 58.2422 52.2266H56.4648L56.4389 52.3346C58.2559 52.7543 59.6094 54.3826 59.6094 56.3281C59.6094 58.5922 57.7719 60.4297 55.5078 60.4297H52.7734C55.0389 60.4297 56.875 62.2658 56.875 64.5312C56.875 66.7967 55.0389 68.6328 52.7734 68.6328C51.1433 68.6328 39.6252 68.6328 38.0707 68.6328C30.5826 68.6328 28.592 67.7141 21.3281 65.8984V38.5547C21.4728 38.4413 43.2031 34.4698 43.2031 21.3281V19.9609C43.2031 17.6955 45.0393 15.8594 47.3047 15.8594C49.5674 15.8594 51.4021 17.6914 51.4062 19.9541C51.4336 19.9541 52.2895 28.5852 48.6719 35.8203H60.9766C63.242 35.8203 65.0781 37.6564 65.0781 39.9219C65.0781 42.1859 63.2406 44.0234 60.9766 44.0234H58.2422Z" fill="#FEF7F3" />
                  <path d="M21.3281 38.5547V65.8984C21.3281 67.4092 20.1045 68.6328 18.5938 68.6328H4.92188V35.8203H18.5938C20.1045 35.8203 21.3281 37.0439 21.3281 38.5547Z" fill="#E6E6E6" />
                  <path d="M48.6719 7.65625V1.36719C48.6719 0.612227 48.0596 0 47.3047 0C46.5497 0 45.9375 0.612227 45.9375 1.36719V7.65625C45.9375 8.41121 46.5497 9.02344 47.3047 9.02344C48.0596 9.02344 48.6719 8.41121 48.6719 7.65625Z" fill="#1D1D1D" />
                  <path d="M15.8594 42.6562C15.1047 42.6562 14.4922 43.2688 14.4922 44.0234C14.4922 44.7781 15.1047 45.3906 15.8594 45.3906C16.6141 45.3906 17.2266 44.7781 17.2266 44.0234C17.2266 43.2688 16.6141 42.6562 15.8594 42.6562Z" fill="#1D1D1D" />
                  <path d="M60.9766 34.4531H50.7702C52.3503 30.4058 52.9899 25.642 52.8665 21.4014C52.843 20.5922 52.812 20.1242 52.77 19.8296C52.6993 16.8755 50.2737 14.4922 47.3047 14.4922C44.2892 14.4922 41.8359 16.9455 41.8359 19.9609V21.3281C41.8359 29.975 30.7325 34.8333 22.353 36.9167C21.7194 35.4683 20.2732 34.4531 18.5938 34.4531H4.92188C4.16691 34.4531 3.55469 35.0654 3.55469 35.8203V68.6328C3.55469 69.3878 4.16691 70 4.92188 70H18.5938C20.262 70 21.6999 68.9983 22.34 67.5652C23.0338 67.7432 23.6779 67.9114 24.2725 68.0667C29.046 69.3134 31.6755 70 38.0707 70H52.7734C55.7889 70 58.2422 67.5467 58.2422 64.5312C58.2422 63.4069 57.9008 62.361 57.3166 61.4909C59.4286 60.7522 60.9766 58.7342 60.9766 56.3281C60.9766 55.2079 60.6435 54.1585 60.0611 53.2845C62.1638 52.5446 63.7109 50.5312 63.7109 48.125C63.7109 47.0006 63.3696 45.9547 62.7854 45.0846C64.8974 44.346 66.4453 42.328 66.4453 39.9219C66.4453 36.9064 63.992 34.4531 60.9766 34.4531ZM19.9609 65.8984C19.9609 66.6523 19.3476 67.2656 18.5938 67.2656H6.28906V37.1875H18.5938C19.3476 37.1875 19.9609 37.8008 19.9609 38.5547V65.8984ZM60.9766 42.6562C58.0441 42.6562 57.345 42.6562 54.1406 42.6562C53.3857 42.6562 52.7734 43.2685 52.7734 44.0234C52.7734 44.7784 53.3857 45.3906 54.1406 45.3906H58.2422C59.7499 45.3906 60.9766 46.6173 60.9766 48.125C60.9766 49.6352 59.7524 50.8594 58.2422 50.8594H51.4062C50.6513 50.8594 50.0391 51.4716 50.0391 52.2266C50.0391 52.9815 50.6513 53.5938 51.4062 53.5938H55.5078C56.9976 53.5938 58.2422 54.7839 58.2422 56.3281C58.2422 57.8383 57.018 59.0625 55.5078 59.0625C52.5753 59.0625 51.8763 59.0625 48.6719 59.0625C47.9169 59.0625 47.3047 59.6747 47.3047 60.4297C47.3047 61.1846 47.9169 61.7969 48.6719 61.7969H52.7734C54.2812 61.7969 55.5078 63.0235 55.5078 64.5312C55.5078 66.039 54.2812 67.2656 52.7734 67.2656H38.0707C32.0268 67.2656 29.6662 66.6492 24.9635 65.421C24.2745 65.2411 23.5189 65.0438 22.6953 64.8338V39.6519C32.5894 37.2951 44.5703 31.5425 44.5703 21.3281V19.9609C44.5703 18.4532 45.797 17.2266 47.3047 17.2266C48.8097 17.2266 50.0362 18.4513 50.0391 19.9567V19.9609C50.0391 20.5551 50.7806 27.8473 47.807 34.4531H43.2031C42.4482 34.4531 41.8359 35.0654 41.8359 35.8203C41.8359 36.5753 42.4482 37.1875 43.2031 37.1875C44.1578 37.1875 59.4182 37.1875 60.9766 37.1875C62.4843 37.1875 63.7109 38.4141 63.7109 39.9219C63.7109 41.4321 62.4868 42.6562 60.9766 42.6562Z" fill="#1D1D1D" />
                  <path d="M15.8594 48.125C15.1044 48.125 14.4922 48.7372 14.4922 49.4922V60.4297C14.4922 61.1846 15.1044 61.7969 15.8594 61.7969C16.6143 61.7969 17.2266 61.1846 17.2266 60.4297V49.4922C17.2266 48.7372 16.6143 48.125 15.8594 48.125Z" fill="#1D1D1D" />
                  <path d="M29.5312 18.5938C29.5312 19.3487 30.1435 19.9609 30.8984 19.9609H36.3672C37.1221 19.9609 37.7344 19.3487 37.7344 18.5938C37.7344 17.8388 37.1221 17.2266 36.3672 17.2266H30.8984C30.1435 17.2266 29.5312 17.8388 29.5312 18.5938Z" fill="#1D1D1D" />
                  <path d="M56.875 18.5938C56.875 19.3487 57.4872 19.9609 58.2422 19.9609H63.7109C64.4659 19.9609 65.0781 19.3487 65.0781 18.5938C65.0781 17.8388 64.4659 17.2266 63.7109 17.2266H58.2422C57.4872 17.2266 56.875 17.8388 56.875 18.5938Z" fill="#1D1D1D" />
                  <path d="M57.9386 6.02641L54.0723 9.89268C53.5384 10.4266 53.5384 11.2923 54.0723 11.8263C54.6065 12.3602 55.4717 12.36 56.0059 11.8263L59.8722 7.96002C60.4061 7.42614 60.4061 6.56043 59.8722 6.02641C59.3381 5.49266 58.4727 5.49266 57.9386 6.02641Z" fill="#1D1D1D" />
                  <path d="M40.5372 11.8263C41.0711 11.2924 41.0711 10.4267 40.5372 9.89268L36.6709 6.02641C36.1369 5.49266 35.2715 5.49266 34.7373 6.02641C34.2034 6.5603 34.2034 7.426 34.7373 7.96002L38.6036 11.8263C39.1379 12.3602 40.0032 12.36 40.5372 11.8263Z" fill="#1D1D1D" />
                </svg>
              </div>
              <h2 className="title mb15">ORDER RECEIVED</h2>
              <div className="text">Thank you. Your order has been received.</div>
            </div>
          </div>
        </div>
        <div className="row mt15">
          <div className="col-lg-8 mx-auto">
            <div className="order_lists text-center">
              <ul className="d-sm-flex align-items-center justify-content-between mx-sm-auto">
                <li className="mb-3 mb-sm-0">
                  <p className="text">Order number:</p>
                  <h5 className="sub-title">{order?.number ?? '—'}</h5>
                </li>
                <li className="mb-3 mb-sm-0">
                  <p className="text">Date</p>
                  <h5 className="sub-title">{order?.date ?? today}</h5>
                </li>
                <li className="mb-3 mb-sm-0">
                  <p className="text">Total</p>
                  <h5 className="sub-title">{order?.totalFormatted ?? '₹ 0.00'}</h5>
                </li>
                <li>
                  <p className="text">Payment Method</p>
                  <h5 className="sub-title">{order?.paymentMode ?? 'Razorpay'}</h5>
                </li>
              </ul>
            </div>
            <div className="checkout_sidebar pb20">
              <div className="order-widget">
                <h4 className="title text-uppercase mb20">ORDER DETAILS</h4>
                <h6 className="bb1">PRODUCT <span className="float-end">TOTAL</span></h6>
                {items.length > 0 ? items.map((item, index) => (
                  <div className="prd-item d-flex mb-2 mt30 mb20" key={index}>
                    <div className="img flex-shrink-0">
                      <img className="float-start mr15" src={item.image} alt={item.title} width="70" height="100" style={{ objectFit: 'cover' }} />
                    </div>
                    <div className="cart_dtls flex-grow-1">
                      <span className="prd-title d-block mb5">{item.title} <small className="float-end">{item.totalFormatted}</small></span>
                      {(item.color || item.size) && (
                        <span className="prd-size d-block">
                          {item.color ? `Colour: ${item.color}` : ''}
                          {item.color && item.size ? ' · ' : ''}
                          {item.size ? `Size: ${item.size}` : ''}
                        </span>
                      )}
                      {item.packageLabel && <div>Pack: {item.packageLabel}</div>}
                      <span className="prd-qntt d-block">Quantity: {item.qty}</span>
                    </div>
                  </div>
                )) : (
                  <p className="text-muted mt-3">No items on this order.</p>
                )}
                <div className="checkout-price-table cart-total-widget p-0 border-0">
                  <ul>
                    <li className="bb1 d-flex align-items-center justify-content-between"><span className="text">Subtotal</span> <span className="value">{order?.subtotalFormatted ?? '₹ 0.00'}</span></li>
                    {order && order.discount > 0 && (
                      <li className="bb1 d-flex align-items-center justify-content-between"><span className="text">Discount{order.couponCode ? ` (${order.couponCode})` : ''}</span> <span className="value">-{order.discountFormatted}</span></li>
                    )}
                    <li className="bb1 d-flex align-items-center justify-content-between"><span className="text">Shipping</span> <span className="value">{order?.shippingFormatted ?? '₹ 0.00'}</span></li>
                    <li className="d-flex align-items-center justify-content-between text-end"><span className="text2">Total</span><span className="text2">{order?.totalFormatted ?? '₹ 0.00'}</span></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    {/* Order End*/}
    </main>
  )
}
