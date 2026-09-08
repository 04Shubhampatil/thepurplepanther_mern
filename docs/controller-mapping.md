# Controller Mapping — Laravel → Express

Format: **Laravel controller → Express controller → Express service → React consumer.**

Architectural rule carried into Node: **routes thin, controllers thin, services own the business
logic, Prisma owns data access.** Laravel's controllers already lean this way for cart/checkout
(they delegate to services); the admin controllers do not, and their logic moves into services
during migration rather than being copied into Express controllers.

---

## 1. Customer-facing (11 controllers, 1 dead)

### `FrontendController` (703 lines — the largest, and the one that fans out most)

Fourteen methods rendering Blade. In Node it splits by domain rather than migrating as one unit:

| Method | Express controller | Service | API | React |
|---|---|---|---|---|
| `home` | `home.controller.js` | `catalog`, `cms` | `GET /api/v1/home` | `Home` |
| `collection` | `product.controller.js` | `catalog` | `GET /api/v1/products` | `Collection` |
| `search` | `product.controller.js` | `catalog`, `meta` | `GET /api/v1/search` | `Search` |
| `shopSingle` | `product.controller.js` | `catalog`, `meta` | `GET /api/v1/products/:slug` | `ProductDetail` |
| `storeProductReview` | `review.controller.js` | `review` | `POST /api/v1/products/:slug/reviews` | `ProductDetail` |
| `cart` | `cart.controller.js` | `cart` | `GET /api/v1/cart` | `Cart` |
| `checkout` | superseded by `CheckoutController@show` | — | — | — |
| `order` | `order.controller.js` | `order` | `GET /api/v1/orders/:orderNumber` | `OrderConfirmation` |
| `about`, `beyondOrdinary`, `support` | `page.controller.js` | `cms` | `GET /api/v1/pages/*` | `About`, `BeyondOrdinary`, `Support` |
| `account` | `account.controller.js` | `account` | `GET /api/v1/account/:page?` | `Account` |
| `blog`, `blogSingle` | `blog.controller.js` | `cms` | `GET /api/v1/blog[/:slug]` | `Blog`, `BlogPost` |

> `FrontendController::checkout` is **dead** — the `/checkout` route points at
> `CheckoutController@show`. Do not migrate it. (Same class of finding as R6.)

### The rest

| Laravel | Express | Service | React |
|---|---|---|---|
| `CartController` | `cart.controller.js` | `cart` | `Cart`, `ProductDetail` |
| `CouponController` | `coupon.controller.js` | `promotion` | `Cart`, `Checkout` |
| `CheckoutController` | `checkout.controller.js` | `checkout`, `payment`, `meta` | `Checkout` |
| `CustomerAuthController` | `auth.controller.js` | `auth`, `cart` (merge), `meta` | `Login`, `Signup` |
| `CustomerPasswordController` | `password.controller.js` | `auth`, `email` | `ForgotPassword`, `ResetPassword` |
| `AccountController` | `account.controller.js` | `account`, `meta` | `Account` |
| `NewsletterController` | `newsletter.controller.js` | `newsletter`, `meta` | footer component |
| `MetaCatalogFeedController` | `catalog-feed.controller.js` | `catalog` | none (machine feed) |
| `BannerController` (root) | — | — | **DEAD CODE — do not migrate** (audit R6) |

`Controller.php` is Laravel's abstract base; no equivalent needed.

---

## 2. Admin (20 controllers)

All mount under `/api/v1/admin/*` behind `requireAuth` + `requireAdmin`.

### Simple CRUD — one shared pattern

`BrandController`, `ColorController`, `SizeController`, `SubCategoryController`,
`NewsTypeController` are near-identical: `index`, `store`, `update`, `destroy`, `toggleStatus`,
with slug generation and an image upload on some.

They map onto a shared `crud.service.js` factory parameterised by
`{ model, uniqueFields, slugFrom, imageField, searchFields }`, with per-resource Zod schemas in
`validators/admin/`. This removes five near-duplicate implementations while keeping behaviour
identical per resource.

| Laravel | Express | Service | React |
|---|---|---|---|
| `BrandController` | `admin/brand.controller.js` | `crud(Brand)` | `Admin/Brands` |
| `ColorController` | `admin/color.controller.js` | `crud(Color)` | `Admin/Colors` |
| `SizeController` | `admin/size.controller.js` | `crud(Size)` | `Admin/Sizes` |
| `SubCategoryController` | `admin/sub-category.controller.js` | `crud(SubCategory)` | `Admin/SubCategories` |
| `NewsTypeController` | `admin/news-type.controller.js` | `crud(NewsType)` | `Admin/NewsTypes` |
| `CategoryController` | `admin/category.controller.js` | `crud(Category)` + `has_color/has_size/show_on_home` | `Admin/Categories` |
| `OfferController` | `admin/offer.controller.js` | `crud(Offer)` | `Admin/Offers` |

### Non-trivial modules

| Laravel | Express | Service | Notes |
|---|---|---|---|
| `AuthController` | `admin/auth.controller.js` | `auth` | username **or** email login; separate admin session |
| `DashboardController` | `admin/dashboard.controller.js` | `dashboard` | aggregate counts — use Prisma `groupBy`/`count`, never load tables |
| `ProfileController` | `admin/profile.controller.js` | `account` | |
| `ProductController` (629 lines) | `admin/product.controller.js` | `product-admin`, `upload` | 16 methods; see below |
| `BannerController` | `admin/banner.controller.js` | `banner` | nested `banner_images`; **update is POST** |
| `HomeSectionController` | `admin/home-section.controller.js` | `cms` | edit/update only; `(section, position)` is unique |
| `BlogPostController` | `admin/blog-post.controller.js` | `cms`, `upload` | toggle + featured |
| `CouponController` | `admin/coupon.controller.js` | `promotion-admin` | all promotion fields incl. BOGO, JSON id lists |
| `ContactController` | `admin/contact.controller.js` | `contact` | subscribers + messages, incl. bulk delete |
| `PageSettingController` | `admin/page-setting.controller.js` | `cms` | |
| `ShippingSettingController` | `admin/shipping.controller.js` | `shipping` | single-row settings table |
| `UserController` (357 lines) | `admin/user.controller.js` | `user-admin` | full resource + bulk + toggle |
| `OrderController` | `admin/order.controller.js` | `order-admin`, `email` | status machine + emails; see below |

#### `Admin\ProductController` — the heaviest migration

16 methods. Beyond CRUD it owns: multi-image upload with `sort_order`, per-colour image
association (`product_images.color_id`), colour/size pivot sync **with `quantity` payload**,
four JSON detail sections, size-guide fields, accessory packages, bulk actions, the
`check-title` uniqueness probe (needed because `products.title` is unique), a dependent
sub-category lookup, and nested review moderation.

Splits into:
- `admin/product.controller.js` — request/response only
- `services/product-admin.service.js` — create/update inside a transaction, pivot sync, JSON fields
- `services/upload.service.js` — multer + local disk, same directories as Laravel
- `admin/product-review.controller.js` — the four review routes

Pivot sync is the subtle part: Laravel's `sync()` with pivot data must become an explicit
delete-missing / upsert-present pass on `product_color` and `product_size`, **preserving
`quantity`**. A naive `deleteMany` + `createMany` would zero live stock counts.

#### `Admin\OrderController`

`index`, `show`, `print`, `destroy`, `bulkAction`, `updateStatus`, `updateDeliveryDate`,
`destroyStatusLog`, `statusPayload`.

Status transitions must go through the `OrderStatuses` state machine
(`constants/order-statuses.js`), not accept an arbitrary status. Each transition writes an
`order_status_logs` row and sends `OrderStatusUpdatedMail`; delivery-date changes send
`OrderDeliveryDateUpdatedMail`. `print` returns order data as JSON — React renders the printable
view, replacing the Blade print template.

---

## 3. Services

| Laravel service | Node service | Notes |
|---|---|---|
| `CartService` (520 lines) | `cart.service.js` | Highest-fidelity port. Line key, variant normalisation, max-quantity, package resolution, session→user merge. |
| `CheckoutService` (331) | `checkout.service.js` | Order creation in a transaction; delegates payment to `payment.service.js` |
| `PromotionService` (246) | `promotion.service.js` | Coupon validation order, BOGO per-line maths, redemption recording |
| `ShippingService` (25) | `shipping.service.js` | Threshold vs flat rate |
| `MetaConversionsService` (252) | `integrations/meta/capi.js` | Hashing, normalisation, fire-and-forget |
| — | `payment.service.js` | **New split.** Razorpay order creation + signature verification, extracted from `CheckoutService` so it is unit-testable without touching orders. |
| — | `email.service.js` | Replaces the 5 Mailables |
| — | `catalog.service.js` | Product queries + Meta feed rows |

`App\Support\*` become plain modules:

| Laravel | Node |
|---|---|
| `Money` | `utils/money.js` — `format()` reproducing `₹ 1,234.56` |
| `OrderStatuses` | `constants/order-statuses.js` — labels, `nextOptions`, default messages |
| `BannerSections` | `constants/banner-sections.js` |
| `SitePages` | `constants/site-pages.js` |
| `Media` | `utils/media.js` — the 5-branch URL resolution |

---

## 4. Middleware

| Laravel | Node | Notes |
|---|---|---|
| `Authenticate` (`auth`) | `middleware/auth.js` → `requireAuth` | 401 JSON instead of a redirect |
| `AdminMiddleware` (`admin`) | `middleware/auth.js` → `requireAdmin` | Laravel **logs the user out** on failure; Node returns 403 without destroying the session — a deliberate improvement, noted here so the difference is intentional and reviewable |
| `EnsureCustomer` (`customer`) | `middleware/auth.js` → `requireCustomer` | admin hitting a customer route → 403 (Laravel redirects to the admin dashboard) |
| `RedirectIfAuthenticated` (`guest`) | React route guard | client-side concern |
| `VerifyCsrfToken` | cookie `SameSite` + CSRF token where needed | |
| `EncryptCookies`, `TrimStrings`, `TrustProxies`, `ValidateSignature`, `PreventRequestsDuringMaintenance`, `TrustHosts` | framework-level | `trust proxy` set on Express; trimming handled by Zod transforms |

---

## 5. Mailables

| Laravel | Node template |
|---|---|
| `OrderPlacedCustomerMail` | `integrations/email/templates/order-placed-customer.js` — **carries the guest password** |
| `OrderPlacedAdminMail` | `order-placed-admin.js` |
| `OrderStatusUpdatedMail` | `order-status-updated.js` |
| `OrderDeliveryDateUpdatedMail` | `order-delivery-date-updated.js` |
| `CustomerPasswordResetMail` | `customer-password-reset.js` |

---

## 6. Migration sequence for controllers

Follows the phase order in `migration-status.md`:

1. **Phase 2** — `CustomerAuthController`, `CustomerPasswordController`, `Admin\AuthController`
2. **Phase 3** — `FrontendController` (catalog methods), `Admin\{Product,Category,SubCategory,Brand,Color,Size,Offer}Controller`
3. **Phase 4** — `FrontendController` (cms methods), `Admin\{Banner,HomeSection,BlogPost,NewsType,PageSetting}Controller`
4. **Phase 5–7** — `CartController`, `CouponController`, wishlist half of `AccountController`
5. **Phase 8** — `AccountController` (remainder)
6. **Phase 9–10** — `CheckoutController`
7. **Phase 11–12** — mailables, `MetaCatalogFeedController`
8. **Phase 13** — `Admin\{Order,User,Contact,Shipping,Profile,Dashboard}Controller`
