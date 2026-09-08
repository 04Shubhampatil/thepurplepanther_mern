import { Link } from 'react-router-dom'
import CartContents from '../../components/cart/CartContents.jsx'
import ProductRecommendations from '../../components/product/ProductRecommendations.jsx'
import { useApi } from '../../hooks/useApi.js'
import { usePageTitle } from '../../theme/page.js'
import * as api from '../../services/endpoints.js'

/**
 * frontend/pages/cart.blade.php.
 *
 * The breadcrumb across the top is the theme's three-step checkout progress — cart,
 * checkout, order complete — with the last step disabled. It is duplicated for small
 * screens as a plain `<h4>`, which is why both are here.
 *
 * `$recommendedProducts` came from the controller: four active products, new arrivals
 * first, minus whatever is already in the bag. That query is now GET /cart/recommendations
 * so the ordering and the top-up-to-four fallback stay on the server where they were.
 */
export default function Cart() {
  usePageTitle('Shopping Cart - The Purple Panther')

  const { data } = useApi(() => api.cart.recommendations(), [])
  const recommended = data?.products ?? []

  return (
    <main className="body_content_wrapper position-relative">
      <section className="page-title pt120">
        <div className="container">
          <div className="row">
            <div className="col-xxl-8 mx-auto">
              <div className="breadcrumb-list text-center">
                <ul className="d-none d-lg-block">
                  <li className="breadcrumb-list list-inline-item active"><Link to="/cart">SHOPPING CART</Link></li>
                  <li className="breadcrumb-list list-inline-item"><a href="#"><i className="far fa-angle-right"></i></a></li>
                  <li className="breadcrumb-list list-inline-item"><Link to="/checkout">CHECKOUT</Link></li>
                  <li className="breadcrumb-list list-inline-item"><a href="#"><i className="far fa-angle-right"></i></a></li>
                  <li className="breadcrumb-list list-inline-item is-disabled"><span>ORDER COMPLETE</span></li>
                </ul>
                <h4 className="d-block d-lg-none">SHOPPING CART</h4>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CartContents />

      <ProductRecommendations
        items={recommended}
        heading="YOU MAY ALSO LIKE"
        titleId="cart-recommended-title"
        variant="related"
      />
    </main>
  )
}
