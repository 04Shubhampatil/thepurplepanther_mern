import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import StoreLayout from '../layouts/StoreLayout.jsx'
import AuthLayout from '../layouts/AuthLayout.jsx'
import AdminLayout from '../layouts/AdminLayout.jsx'
import { RequireCustomer, RequireAdmin, RequireGuest } from './guards.jsx'
import Loading from '../components/common/Loading.jsx'
import NotFound from '../pages/NotFound.jsx'

/**
 * Route table.
 *
 * URLs are preserved EXACTLY as Laravel served them (docs/route-mapping.md). Existing
 * links, bookmarks and search rankings all depend on them, so this file is a contract
 * rather than a design choice.
 */

const Home = lazy(() => import('../pages/Home/Home.jsx'))
const Collection = lazy(() => import('../pages/Products/Collection.jsx'))
const ProductDetail = lazy(() => import('../pages/ProductDetails/ProductDetail.jsx'))
const Cart = lazy(() => import('../pages/Cart/Cart.jsx'))
const Checkout = lazy(() => import('../pages/Checkout/Checkout.jsx'))
const OrderConfirmation = lazy(() => import('../pages/Checkout/OrderConfirmation.jsx'))
const Search = lazy(() => import('../pages/Products/Search.jsx'))
const Blog = lazy(() => import('../pages/Blog/Blog.jsx'))
const BlogPost = lazy(() => import('../pages/Blog/BlogPost.jsx'))
const About = lazy(() => import('../pages/Support/About.jsx'))
const BeyondOrdinary = lazy(() => import('../pages/Support/BeyondOrdinary.jsx'))
const Support = lazy(() => import('../pages/Support/Support.jsx'))
const Login = lazy(() => import('../pages/Auth/Login.jsx'))
const Signup = lazy(() => import('../pages/Auth/Signup.jsx'))
const ForgotPassword = lazy(() => import('../pages/Auth/ForgotPassword.jsx'))
const ResetPassword = lazy(() => import('../pages/Auth/ResetPassword.jsx'))
const Account = lazy(() => import('../pages/Account/Account.jsx'))

const AdminLogin = lazy(() => import('../pages/Admin/AdminLogin.jsx'))
const Dashboard = lazy(() => import('../pages/Admin/Dashboard.jsx'))
const AdminProducts = lazy(() => import('../pages/Admin/Products.jsx'))
const AdminOrders = lazy(() => import('../pages/Admin/Orders.jsx'))
const AdminResource = lazy(() => import('../pages/Admin/Resource.jsx'))
const AdminSettings = lazy(() => import('../pages/Admin/Settings.jsx'))
const AdminCategories = lazy(() => import('../pages/Admin/Categories.jsx'))
const AdminSubCategories = lazy(() => import('../pages/Admin/SubCategories.jsx'))
const AdminColors = lazy(() => import('../pages/Admin/Colors.jsx'))
const AdminSizes = lazy(() => import('../pages/Admin/Sizes.jsx'))
const AdminOffers = lazy(() => import('../pages/Admin/Offers.jsx'))

/**
 * Reserved first-path segments — the negative lookahead from Laravel's clean-category
 * route, reproduced verbatim:
 *
 *   Route::get('/{categorySlug}', ...)->where('categorySlug', '^(?!shop|collection|...).*$')
 *
 * The catch-all is registered LAST, but React Router ranks static segments above dynamic
 * ones regardless of order, so the list is what actually guarantees `/cart` is the cart and
 * not a category lookup. Missing an entry here turns a working page into a 404.
 */
export const RESERVED_SEGMENTS = Object.freeze([
  'shop',
  'collection',
  'product',
  'cart',
  'checkout',
  'order',
  'search',
  'blog',
  'about',
  'support',
  'login',
  'signup',
  'admin',
  'account',
  'newsletter',
  'forgot-password',
  'reset-password',
  'check-email',
  'logout',
  'cart-api',
  'account-api',
  'storage',
  'frontend',
  'css',
  'js',
  'images',
  'vendor',
  'build',
  'api',
  'beyond-ordinary',
])

export const isReservedSegment = (slug) => RESERVED_SEGMENTS.includes(String(slug).toLowerCase())

/** The clean category URL: /accessories, /shirts, … */
function CategoryRoute() {
  const { categorySlug } = useParams()
  if (isReservedSegment(categorySlug)) return <NotFound />
  return <Collection categorySlug={categorySlug} />
}

/**
 * Legacy `.html` redirects. Laravel returned real 301s; these are client-side, so the
 * canonical fix is a reverse-proxy rule — kept here as a safety net for links that reach
 * the SPA directly. See docs/route-mapping.md §7.
 */
const LEGACY_REDIRECTS = [
  ['/faqs.html', '/support/faqs'],
  ['/privacy-cookies.html', '/support/privacy'],
  ['/returns-exchanges.html', '/support/returns'],
  ['/shipping.html', '/support/shipping'],
  ['/size-guide.html', '/support/size-guide'],
  ['/start-return.html', '/support/start-return'],
  ['/terms-conditions.html', '/support/terms'],
  ['/account-overview.html', '/account/overview'],
  ['/account-orders.html', '/account/orders'],
  ['/account-information.html', '/account/information'],
  ['/account-addresses.html', '/account/addresses'],
  ['/account-favorites.html', '/account/wishlist'],
  ['/account-wishlists.html', '/account/wishlist'],
  ['/product/account-overview.html', '/account/overview'],
  ['/product/account-orders.html', '/account/orders'],
  ['/product/account-information.html', '/account/information'],
  ['/product/account-addresses.html', '/account/addresses'],
  ['/product/account-favorites.html', '/account/wishlist'],
  ['/product/account-wishlists.html', '/account/wishlist'],
  ['/account/favorites', '/account/wishlist'],
  ['/account/wishlists', '/account/wishlist'],
]

export default function AppRoutes() {
  return (
    <Suspense fallback={<Loading full />}>
      <Routes>
        {/* Legacy redirects first — /product/account-*.html must beat /product/:slug,
            exactly as they were declared before it in Laravel. */}
        {LEGACY_REDIRECTS.map(([from, to]) => (
          <Route key={from} path={from} element={<Navigate to={to} replace />} />
        ))}

        <Route element={<StoreLayout />}>
          <Route index element={<Home />} />

          <Route path="shop" element={<Collection />} />
          <Route path="collection" element={<Collection categorySlug="collection" />} />
          <Route path="search" element={<Search />} />

          <Route path="product" element={<Navigate to="/shop" replace />} />
          <Route path="product/:slug" element={<ProductDetail />} />

          <Route path="cart" element={<Cart />} />
          <Route path="checkout" element={<Checkout />} />
          {/* Laravel's /order with no number redirected to the cart. */}
          <Route path="order" element={<Navigate to="/cart" replace />} />
          <Route path="order/:orderNumber" element={<OrderConfirmation />} />

          <Route path="blog" element={<Blog />} />
          <Route path="blog/:slug" element={<BlogPost />} />

          <Route path="about" element={<About />} />
          <Route path="beyond-ordinary" element={<BeyondOrdinary />} />
          <Route path="support" element={<Support />} />
          <Route path="support/:page" element={<Support />} />

          <Route element={<RequireGuest />}>
            <Route path="login" element={<Login />} />
            <Route path="signup" element={<Signup />} />
          </Route>

          <Route element={<RequireCustomer />}>
            <Route path="account" element={<Navigate to="/account/overview" replace />} />
            <Route path="account/:page" element={<Account />} />
          </Route>

          {/* Clean category URLs. Declared LAST; the reserved list is the real guard. */}
          <Route path=":categorySlug" element={<CategoryRoute />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* The password pages have no site header in Blade — they get the stripped shell. */}
        <Route element={<AuthLayout />}>
          <Route element={<RequireGuest />}>
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="reset-password/:token" element={<ResetPassword />} />
          </Route>
        </Route>

        {/* Admin. The login page is outside the guard so an admin can reach it. */}
        <Route path="admin/login" element={<AdminLogin />} />
        <Route path="admin" element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            {/* Rebuilt against the Blade views; declared before the generic :resource
                route so they win over it. */}
            <Route path="categories" element={<AdminCategories />} />
            <Route path="sub-categories" element={<AdminSubCategories />} />
            <Route path="colors" element={<AdminColors />} />
            <Route path="sizes" element={<AdminSizes />} />
            <Route path="offers" element={<AdminOffers />} />

            <Route path="products" element={<AdminProducts />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path=":resource" element={<AdminResource />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
