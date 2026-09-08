# Route Mapping — Laravel → Express → React

Source of truth: `routes/web.php` (18 KB, read in full). `routes/api.php` contains only an
unused Sanctum `/api/user` stub. `routes/console.php` and `routes/channels.php` contain only
Laravel defaults — nothing to migrate.

**Convention.** Browser URLs are preserved exactly and served by React Router. All data moves
to `/api/v1/*`, which never collides with a browser route.

Legend — Auth: `—` public · `G` guest-only · `C` customer · `A` admin

---

## 1. Storefront pages

| M | Laravel URL | Controller@method | Auth | Express API | React page |
|---|---|---|---|---|---|
| GET | `/` | `FrontendController@home` | — | `GET /api/v1/home` | `Home` |
| GET | `/shop` | `FrontendController@collection` | — | `GET /api/v1/products` | `Collection` |
| GET | `/collection` | `FrontendController@collection` | — | `GET /api/v1/products` | `Collection` (same component) |
| GET | `/product/{slug}` | `FrontendController@shopSingle` | — | `GET /api/v1/products/:slug` | `ProductDetail` |
| POST | `/product/{slug}/review` | `FrontendController@storeProductReview` | — | `POST /api/v1/products/:slug/reviews` | `ProductDetail` (form) |
| GET | `/product` | inline redirect | — | — | redirect → first active product, else `/shop` |
| GET | `/search` | `FrontendController@search` | — | `GET /api/v1/search?q=` | `Search` |
| GET | `/cart` | `FrontendController@cart` | — | `GET /api/v1/cart` | `Cart` |
| GET | `/checkout` | `CheckoutController@show` | — | `GET /api/v1/checkout` | `Checkout` |
| GET | `/order/{order?}` | `FrontendController@order` | — | `GET /api/v1/orders/:orderNumber` | `OrderConfirmation` |
| GET | `/blog` | `FrontendController@blog` | — | `GET /api/v1/blog` | `Blog` |
| GET | `/blog/{slug}` | `FrontendController@blogSingle` | — | `GET /api/v1/blog/:slug` | `BlogPost` |
| GET | `/about` | `FrontendController@about` | — | `GET /api/v1/pages/about` | `About` |
| GET | `/beyond-ordinary` | `FrontendController@beyondOrdinary` | — | `GET /api/v1/pages/beyond-ordinary` | `BeyondOrdinary` |
| GET | `/support/{page?}` | `FrontendController@support` | — | `GET /api/v1/pages/support/:page?` | `Support` |
| GET | `/{categorySlug}` | `FrontendController@collection` | — | `GET /api/v1/products?category=` | `Collection` — **catch-all, register last** |

> `/{categorySlug}` carries a negative-lookahead exclusion list. See §7 — reproducing it exactly
> is mandatory.

## 2. Cart & coupon API (`/cart-api` → `/api/v1/cart`)

Works for **guests and customers alike**. Guests use a session cart; customers use `cart_items`.

| M | Laravel URL | Controller@method | Auth | Express API |
|---|---|---|---|---|
| GET | `/cart-api` | `CartController@index` | — | `GET /api/v1/cart` |
| POST | `/cart-api` | `CartController@store` | — | `POST /api/v1/cart/items` |
| PUT | `/cart-api/{productId}` | `CartController@update` | — | `PATCH /api/v1/cart/items/:productId` |
| DELETE | `/cart-api/{productId}` | `CartController@destroy` | — | `DELETE /api/v1/cart/items/:productId` |
| POST | `/cart-api/buy-now` | `CartController@buyNow` | — | `POST /api/v1/cart/buy-now` |
| POST | `/cart-api/coupon` | `CouponController@apply` | — | `POST /api/v1/cart/coupon` |
| DELETE | `/cart-api/coupon` | `CouponController@remove` | — | `DELETE /api/v1/cart/coupon` |

`{productId}` is `whereNumber`. Colour / size / package_key travel in the **body** on update and
delete (not the URL), because they form part of the line key.

## 3. Checkout & payment

| M | Laravel URL | Controller@method | Auth | Express API |
|---|---|---|---|---|
| POST | `/checkout/place` | `CheckoutController@place` | — | `POST /api/v1/checkout/place` |
| POST | `/checkout/verify` | `CheckoutController@verify` | — | `POST /api/v1/checkout/verify` |

Both are public: guest checkout creates the account. `verify` additionally rejects when a
signed-in user's id does not match `order.user_id` (403).

## 4. Auth

| M | Laravel URL | Controller@method | Auth | Express API | React page |
|---|---|---|---|---|---|
| GET | `/login` | `CustomerAuthController@showLogin` | G | — | `Login` |
| POST | `/login` | `CustomerAuthController@login` | G | `POST /api/v1/auth/login` | — |
| GET | `/signup` | `CustomerAuthController@showRegister` | G | — | `Signup` |
| POST | `/signup` | `CustomerAuthController@register` | G | `POST /api/v1/auth/register` | — |
| POST | `/check-email` | `CustomerAuthController@checkEmail` | — | `POST /api/v1/auth/check-email` | — |
| POST | `/logout` | `CustomerAuthController@logout` | C | `POST /api/v1/auth/logout` | — |
| GET | `/forgot-password` | `CustomerPasswordController@showForgotForm` | G | — | `ForgotPassword` |
| POST | `/forgot-password` | `CustomerPasswordController@sendResetLink` | G | `POST /api/v1/auth/forgot-password` | — |
| GET | `/reset-password/{token}` | `CustomerPasswordController@showResetForm` | G | — | `ResetPassword` |
| POST | `/reset-password` | `CustomerPasswordController@reset` | G | `POST /api/v1/auth/reset-password` | — |
| GET | `/csrf-token` | closure | — | **drop** | — |

`/csrf-token` exists only to refresh Laravel's CSRF token for jQuery. With a JWT/HTTP-only-cookie
API using `SameSite` cookies it has no equivalent — **do not migrate it**. Add CSRF protection
appropriate to the cookie strategy instead.

## 5. Account (`auth` + `customer`)

| M | Laravel URL | Controller@method | Express API | React page |
|---|---|---|---|---|
| GET | `/account/{page?}` | `FrontendController@account` | `GET /api/v1/account/:page?` | `Account` (tabbed) |
| PUT | `/account-api/profile` | `AccountController@updateProfile` | `PATCH /api/v1/account/profile` | |
| POST | `/account-api/addresses` | `AccountController@storeAddress` | `POST /api/v1/account/addresses` | |
| PUT | `/account-api/addresses/{address}` | `AccountController@updateAddress` | `PATCH /api/v1/account/addresses/:id` | |
| DELETE | `/account-api/addresses/{address}` | `AccountController@destroyAddress` | `DELETE /api/v1/account/addresses/:id` | |
| POST | `/account-api/addresses/{address}/default` | `AccountController@setDefaultAddress` | `POST /api/v1/account/addresses/:id/default` | |
| POST | `/account-api/wishlist` | `AccountController@storeWishlist` | `POST /api/v1/account/wishlist` | |
| DELETE | `/account-api/wishlist/{wishlist}` | `AccountController@destroyWishlistItem` | `DELETE /api/v1/account/wishlist/:id` | |
| DELETE | `/account-api/reviews/{review}` | `AccountController@destroyReview` | `DELETE /api/v1/account/reviews/:id` | |

`{page}` values in use: `overview`, `orders`, `information`, `addresses`, `wishlist`.

## 6. Newsletter, contact, feed

| M | Laravel URL | Controller@method | Auth | Express API |
|---|---|---|---|---|
| POST | `/newsletter/subscribe` | `NewsletterController@store` | — | `POST /api/v1/newsletter/subscribe` |
| POST | `/newsletter/check` | `NewsletterController@check` | — | `POST /api/v1/newsletter/check` |
| GET | `/catalog/meta/products.csv` | `MetaCatalogFeedController` | token | `GET /api/v1/catalog/meta/products.csv` |

The feed keeps its **original URL** (`/catalog/meta/products.csv`) as well, since Meta's
configured feed URL points at it. Serve both paths. **Make the token mandatory** — see audit R1.

## 7. Legacy redirects — all must be preserved (SEO)

301 redirects declared with `Route::redirect`:

| From | To |
|---|---|
| `/faqs.html` | `/support/faqs` |
| `/privacy-cookies.html` | `/support/privacy` |
| `/returns-exchanges.html` | `/support/returns` |
| `/shipping.html` | `/support/shipping` |
| `/size-guide.html` | `/support/size-guide` |
| `/start-return.html` | `/support/start-return` |
| `/terms-conditions.html` | `/support/terms` |

Implicit redirects (Laravel closures, effectively 302):

| From | To |
|---|---|
| `/account-overview.html`, `/product/account-overview.html` | `/account/overview` |
| `/account-orders.html`, `/product/account-orders.html` | `/account/orders` |
| `/account-information.html`, `/product/account-information.html` | `/account/information` |
| `/account-addresses.html`, `/product/account-addresses.html` | `/account/addresses` |
| `/account-favorites.html`, `/product/account-favorites.html` | `/account/wishlist` |
| `/account-wishlists.html`, `/product/account-wishlists.html` | `/account/wishlist` |
| `/account/favorites` | `/account/wishlist` |
| `/account/wishlists` | `/account/wishlist` |

**Ordering hazard.** The six `/product/account-*.html` redirects are declared *before*
`/product/{slug}`, and `/product/{slug}` additionally carries `->where('slug', '^(?!account-).+')`.
Both guards exist; keep both.

**Recommendation:** implement these at the reverse proxy (nginx/Vercel) rather than in React, so
they return real 301s to crawlers instead of a client-side redirect after a JS bundle loads.

### The category catch-all exclusion list

```
shop, collection, product, cart, checkout, order, search, blog, about, support,
login, signup, admin, account, newsletter, forgot-password, reset-password,
check-email, logout, cart-api, account-api, storage, frontend, css, js, images,
vendor, build
```

In React Router this becomes: declare every concrete route above, then `/:categorySlug` **last**,
and inside that component 404 if the slug matches the exclusion list or no active category is
found. In Express, `/api/v1/*` is a separate namespace so no exclusion is needed server-side.

## 8. Admin (`/admin`, all `auth` + `admin` unless noted)

Guest-only auth routes:

| M | URL | Method | Express API |
|---|---|---|---|
| GET/POST | `/admin/login` | `Admin\AuthController@showLoginForm` / `login` | `POST /api/v1/admin/auth/login` |
| GET/POST | `/admin/forgot-password` | `@showForgotForm` / `@sendResetLink` | `POST /api/v1/admin/auth/forgot-password` |
| GET/POST | `/admin/reset-password/{token}` | `@showResetForm` / `@resetPassword` | `POST /api/v1/admin/auth/reset-password` |
| POST | `/admin/logout` | `@logout` (auth+admin) | `POST /api/v1/admin/auth/logout` |

Admin login accepts **`username` or `email`** in one field — reproduce this.

### Resource modules

Each maps to `/api/v1/admin/{resource}` with the standard verbs. `toggle` endpoints become
`PATCH /api/v1/admin/{resource}/:id/toggle`.

| Module | Laravel routes | Controller | Notes |
|---|---|---|---|
| Dashboard | `GET /admin/dashboard` | `DashboardController` | stats only |
| Profile | `GET,PUT /admin/profile` | `ProfileController` | |
| Categories | `resource` (no `show`) + `toggle` | `CategoryController` | |
| Sub-categories | index/store/update/destroy/toggle | `SubCategoryController` | not a full resource |
| Brands | index/store/update/destroy/toggle | `BrandController` | |
| Colors | index/store/update/destroy/toggle | `ColorController` | |
| Sizes | index/store/update/destroy/toggle | `SizeController` | |
| Offers | `resource` (no `show`) + `toggle` | `OfferController` | |
| Products | full `resource` + 9 extra | `ProductController` | see below |
| Banners | `resource` (no `update`) + `POST /banners/{banner}` + `toggle` | `BannerController` | **update is POST, not PUT** |
| Home sections | `GET,POST /admin/home-sections` | `HomeSectionController` | edit/update only |
| News types | index/store/update/destroy/toggle | `NewsTypeController` | |
| Blog posts | `resource` (no `show`) + `toggle` + `featured` | `BlogPostController` | |
| Coupons | full `resource` + `toggle` | `CouponController` | |
| Contacts | index + 4 bulk/destroy | `ContactController` | subscribers + messages |
| Page settings | `GET /admin/settings/pages`, `PUT .../{page}` | `PageSettingController` | |
| Shipping | `GET,PUT /admin/settings/shipping` | `ShippingSettingController` | |
| Users | `resource` + `bulk` + `toggle` | `UserController` | |
| Orders | `resource` (index/show/destroy) + 6 extra | `OrderController` | see below |

Product extras: `GET products/check-title`, `GET products/sub-categories`, `POST products/bulk`,
`PATCH products/{p}/toggle`, `PATCH products/{p}/featured`, `GET products/{p}/reviews`,
`POST products/{p}/reviews`, `PATCH products/{p}/reviews/{r}/toggle`,
`DELETE products/{p}/reviews/{r}`.

Order extras: `POST orders/bulk`, `GET orders/{o}/print`, `GET orders/{o}/status-data`,
`PATCH orders/{o}/status`, `PATCH orders/{o}/delivery-date`,
`DELETE orders/{o}/status-logs/{log}`.

> **Route-order hazard (carried over):** `products/check-title`, `products/sub-categories` and
> `products/bulk` are registered **before** `Route::resource('products')` so they are not
> captured by `products/{product}`. Express matches in declaration order too — keep the same
> order or these become "product not found".

---

## 9. Counts

| Group | Routes |
|---|---|
| Storefront pages | 16 |
| Cart / coupon API | 7 |
| Checkout | 2 |
| Auth | 11 |
| Account | 9 |
| Newsletter / feed | 3 |
| Legacy redirects | 21 |
| Admin | ~93 |
| **Total** | **~162** |
