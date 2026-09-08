# Laravel Audit — The Purple Panther

**Audited source:** `C:\main Projects\thepurplepanther` (Laravel 10, PHP)
**Target:** React + Node.js + Express + Prisma + **MySQL** (same database)
**Audit date:** 2026-09-08
**Status:** PHASE 0 — AUDIT COMPLETE

---

## 1. Corrections to prior assumptions

The migration brief carried several figures that the source does not support. Evidence-based
counts are below; **the numbers on the right are the ones used for all planning.**

| Claim in brief | Actual (verified) | Evidence |
|---|---|---|
| ~1,980 view files | **114 Blade files** | `find resources/views -name "*.blade.php" \| wc -l` |
| ~36 migrations | **36 migrations** ✅ | `database/migrations/` |
| AWS/S3 storage possibly active | **NOT active.** `FILESYSTEM_DISK=public` → local disk rooted at `public/storage` | `.env`, `config/filesystems.php` |
| Meta Catalog env configured | **Not present in `.env`** — feed token empty | `.env` key dump |
| Sanctum in use | Configured, but only route is the unused `/api/user` stub | `routes/api.php` |
| Pusher / Redis / Memcached | Config present, **no application code uses them** | grep across `app/` |

**Authoritative database source** is `u375273201_purple_panthdb 1.sql` (35 tables, production
export). `database/schema.sql` (27 tables) and `database/hostinger.sql` (29 tables) are **stale**
and must not be used — they are missing `blog_posts`, `news_types`, `home_section_products`,
`coupon_redemptions`, `password_reset_attempts`, and `shipping_settings`.

---

## 2. Application inventory

| Area | Count | Notes |
|---|---|---|
| Customer controllers | 11 | one is dead code (see §5) |
| Admin controllers | 20 | all reachable under `/admin` |
| Business services | 5 | Cart, Checkout, Promotion, Shipping, MetaConversions |
| Support classes | 5 | Money, OrderStatuses, BannerSections, SitePages, Media |
| Eloquent models | 29 | |
| Mailables | 5 | order placed ×2, status, delivery date, password reset |
| Middleware | 11 | 2 are app-specific: `admin`, `customer` |
| Blade views | 114 | 16 frontend pages, 23 frontend partials, ~60 admin, 6 email |
| DB tables | 35 | incl. 4 Laravel framework tables |
| Frontend JS files | 27 | ~9 app-specific, rest are jQuery/Bootstrap vendor libs |

### Authentication model
Session-based (`SESSION_DRIVER=file`), single `users` table, `role` enum `admin|customer`.
There is **no separate admin guard** — admin and customer share the auth guard and are
separated by the `role` column plus the `admin` / `customer` middleware.

- Customer login: matches on `email` + `role='customer'` + `is_active`, `Hash::check`.
- Admin login: `Auth::attempt` on `username` **or** `email` (whichever parses as an email),
  plus `role='admin'` + `is_active=true`.
- Passwords are Laravel bcrypt (`$2y$` prefix, cost 10 by default).

### Money & rounding
All money is MySQL `decimal(10,2)` / `decimal(12,2)`. Display format is `₹ 1,234.56`
(`App\Support\Money::format` → `'₹ '.number_format($amount, 2)`).
Discounts are rounded with `round($discount, 2)` **once**, at the end of coupon calculation.

---

## 3. Business rules that must be preserved exactly

These were extracted from source, not inferred. They are the acceptance criteria for parity.

### 3.1 Cart line identity
A cart line is keyed by **`product_id | color | size | package_key`**, all lower-cased
(`CartService::lineKey`). Two entries of the same product with different colour/size/package
are separate lines. Variant normalisation nulls out `''`, `'?'`, and `'select'`
(case-insensitive) — this must be reproduced or lines will fail to match.

### 3.2 Maximum quantity
`min(` `max_unit_buy` (or 99 if falsy)`,` colour pivot `quantity` (if a colour is selected)`,`
size pivot `quantity` (if a size is selected) `)`.
Exceeding it returns **HTTP 422**; a maximum below 1 is "out of stock", also 422.

### 3.3 Default variant selection
On add-to-cart with no colour/size supplied, the **first** related colour (upper-cased) and the
**first** related size are auto-selected.

### 3.4 Accessory packages
Package pricing applies **only when `product.category.slug === 'accessories'`**. The package
price is always re-resolved server-side from `products.accessory_packages` JSON — a browser-
supplied price is never trusted. Falls back to the first package when the key does not match.

### 3.5 Totals pipeline (order is significant)
```
subtotal   = Σ(unit_price × quantity)
discount   = PromotionService.quote(items, subtotal)
shipping   = ShippingService.quote(max(0, subtotal − discount))   ← discount applied BEFORE
             shipping threshold test
if discount.free_shipping → shipping.amount = 0
total      = max(0, subtotal − discount + shipping)
```
Applying the free-shipping threshold to the pre-discount subtotal would be a parity break.

### 3.6 Shipping
Single-row `shipping_settings` table. `amount = subtotal >= free_shipping_threshold ? 0 : flat_shipping_rate`.
Defaults in schema: threshold `899.00`, flat rate `60.00`.

### 3.7 Coupons — validation order
`PromotionService::quoteCoupon` rejects in this sequence, each with its own message:
1. `members_only` and no user → "Please log in to use this member offer."
2. `new_customers_only` and signed-in user has any `payment_status='paid'` order → rejected.
   *A guest is eligible* (account is created during checkout after an email-uniqueness check).
3. `max_use_per_user` and a `coupon_redemptions` row exists for (coupon, user) → rejected.
4. No eligible items → rejected.
5. `min_quantity` vs eligible **quantity** → rejected.
6. `min_cart_status` and eligible **subtotal** < `min_cart_amount` → rejected.

Earlier, `findActiveCoupon` enforces: exists + `is_active`, `starts_at`, `ends_at`,
and `used_count < usage_limit`.

Eligibility (`applies_to`): `'products'` → `product_ids` JSON contains the line's product;
`'categories'` → `category_ids` contains the line's category; anything else → all items.
**Note:** all min-amount and discount maths run against the *eligible* subset, not the whole cart.

### 3.8 Discount calculation
- **BOGO** (`offer_type === 'bogo'`): computed **per line**, not across the cart —
  `freeQty = floor(quantity / (buy + get)) × get`, `discount = Σ(freeQty × unit_price)`.
  The per-line rule exists deliberately so a cheap item cannot make an expensive one free.
- **percent**: `eligibleSubtotal × percent/100`, capped by `max_discount_amount` when
  `max_discount_status` is set.
- **amount**: `min(discount_amount, eligibleSubtotal)`.

A zero discount is an error **unless** the coupon grants `free_shipping`.

### 3.9 Coupon state
The applied code lives in the **session** (`applied_coupon_code`), not the database, and is
re-validated on every `summary()` call. An empty cart clears it. A now-invalid coupon is
cleared and its message surfaced rather than throwing.

### 3.10 Checkout
Guest checkout creates a real `customer` user with a random 10-char password, logs them in,
merges the session cart, and mails the password with the order confirmation. If the email is
already registered it **refuses** and asks the user to log in.
Order is created inside a `DB::transaction` with `status='pending'`, `payment_status='pending'`.
`order_items.mrp` is written as the **unit price** and `saving` as `0` — a known quirk that
must be reproduced for data consistency.
Country is force-set to `'India'`, overriding any client value.

### 3.11 Razorpay verification
```
expected = HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET)
hash_equals(expected, razorpay_signature)
```
Plus a guard that the returned `razorpay_order_id` matches the one stored on the order.
Verification is **idempotent**: an already-`paid` order returns early without re-recording
the redemption, re-clearing the cart, or re-sending email.
Amount is `round(payable_amount × 100)` paise; minimum 100 paise.

### 3.12 Order status machine
`placed → packed → shipped → delivered`, with `cancelled` reachable from any non-terminal
state. `delivered` and `cancelled` are terminal. Legacy `pending` is treated as `placed`.
(`App\Support\OrderStatuses::nextOptions`)

---

## 4. Integrations

| Integration | Status | Server-only secret | Notes |
|---|---|---|---|
| **Razorpay** | ACTIVE | `RAZORPAY_KEY_SECRET` | Direct HTTP to `api.razorpay.com/v1/orders` with basic auth; not the SDK. `key_id` is public (sent to browser). |
| **SMTP (Gmail)** | ACTIVE | `MAIL_PASSWORD` | `smtp.gmail.com:587` TLS. Queue is `sync`, so mail sends **inline** during the request. |
| **Meta CAPI** | ACTIVE (`META_CAPI_ENABLED=true`) | `META_CAPI_ACCESS_TOKEN` | `graph.facebook.com/v26.0/{dataset}/events`. Fails soft — logged, never throws. |
| **Meta Catalog** | ACTIVE, **UNAUTHENTICATED** | — | See §5 risk. |
| **Local storage** | ACTIVE | — | `public/storage/{banners,blog-posts,brands,categories,coupons,offers,products,users}` |
| **AWS S3** | CONFIGURED, **UNUSED** | `AWS_SECRET_ACCESS_KEY` | Disk defined but `FILESYSTEM_DISK=public`. Do not migrate to it. |
| **Pusher / Redis / Memcached** | LEGACY, unused | — | No application code references them. |

### Meta CAPI events actually emitted
Verified by grepping call sites — the service *supports* 13 events but only these are sent:

| Event | Emitted from |
|---|---|
| `ViewContent` | product detail page |
| `Search` | search page |
| `AddToCart` | `CartController::store`, `CartController::buyNow` |
| `AddToWishlist` | account wishlist add |
| `InitiateCheckout` | `CheckoutController::show` |
| `AddPaymentInfo` | `CheckoutController::place` |
| `CompleteRegistration` | signup, **and** guest checkout account creation |
| `Purchase` | `CheckoutController::verify`, **only when not already paid**, `event_id = "purchase_{order_number}"` |
| `Subscribe` | newsletter subscribe |

The service declares 13 supported events; only the **9** above have call sites. In particular
`Contact`, `FindLocation`, `Schedule`, and `StartTrial` are declared but **never emitted** — do
not add them during migration.

PII is SHA-256 hashed after normalisation: lower-cased and trimmed; phone and date-of-birth
stripped to digits; country `'india' → 'in'`. Field map:
`em, ph, fn, ln, ge, db, ct, st, zp, country, external_id`.
`_fbc` is synthesised from a `fbclid` query param when the cookie is absent.

---

## 5. Risks and defects found

| # | Severity | Finding |
|---|---|---|
| R1 | **HIGH** | **Meta catalog feed is unauthenticated.** `MetaCatalogFeedController` only enforces the token when `config('services.meta_catalog.feed_token')` is non-empty, and `META_CATALOG_FEED_TOKEN` is absent from `.env`. `/catalog/meta/products.csv` currently exposes the full active-product catalogue to anyone. Fix during migration: require the token unconditionally. |
| R2 | **HIGH** | **`.env` is inside the audited archive** and contains live production credentials (DB password, Razorpay secret, Gmail app password, Meta access token, AWS keys). It must never be copied into the new repo or committed. Treat all of these as compromised-by-exposure and rotate before cutover. |
| R3 | MEDIUM | `APP_URL=http://127.0.0.1:8000` while `APP_ENV=production`. Because `Media::url()` and every image accessor build URLs via `asset()`, a production deploy with this value emits broken absolute image URLs. The new app must resolve media against an explicit, correct base URL. |
| R4 | MEDIUM | **No FK constraints** on `blog_posts.news_type_id`, `banner_images.banner_id`, or `home_section_products.product_id`, despite the Eloquent relationships. `banner_images.banner_id` also has **no index**. Orphans are possible — the verification scripts must check for them, and Prisma relations should be declared without assuming DB-level enforcement. |
| R5 | MEDIUM | `CheckoutService` writes `order_items.mrp = unit_price` and `saving = 0`, so per-item savings are not recorded even when the product has an MRP above the selling price. Reproduce as-is for parity; flag separately as a product decision. |
| R6 | LOW | `app/Http/Controllers/BannerController.php` (non-admin) is **dead code** — routes import `Admin\BannerController`; nothing references the root one. Do not migrate it. |
| R7 | LOW | `cart_items` has no unique constraint on its logical key `(user_id, product_id, color, size, package_key)`; de-duplication is enforced only in application code. Concurrent add-to-cart can create duplicate lines. |
| R8 | LOW | `QUEUE_CONNECTION=sync` means all 5 transactional emails send **inline**. Gmail SMTP latency is therefore on the checkout critical path. Node should move these off the request path. |
| R10 | LOW | **User enumeration in forgot-password.** `CustomerPasswordController::sendResetLink` returns "This email is not registered with us." for an unknown address, so the form confirms which emails have accounts. Standard practice is a uniform "if that address exists, we've sent a link". **Replicated as-is** for parity — the storefront form displays this message and depends on it. Changing it is a product decision, not a migration one, so it is logged rather than silently altered. (Note the login endpoint does *not* have this flaw — it correctly uses one message for every failure.) |
| R11 | LOW | **The `pages` CMS table is write-only.** `Admin\PageSettingController` lets an admin edit four pages (About Us, Terms Of Use, Privacy, Refund Return Policy), but `Page::` appears in no storefront controller or view — the support pages render static Blade content instead. Admins are editing content nothing displays. The migration keeps the admin CRUD and adds a public `GET /pages/:slug` so the data is reachable, but wiring it into the storefront is a product decision, not a migration one. |
| R9 | **HIGH — migration hazard, already fixed** | The `bcrypt` npm package **silently rejects Laravel's `$2y$` hashes**, returning `false` rather than throwing (`$2a$`→true, `$2b$`→true, `$2y$`→false). A direct port would have locked out every existing customer at cutover, with the failure presenting as a wrong password. Fixed in phase 1 by `server/src/utils/password.js`, which normalises the version prefix before comparison. See `migration-status.md` D5. |

---

## 6. Route surface

35 public/customer routes, 8 legacy redirects, ~90 admin routes. Full table in
[`route-mapping.md`](./route-mapping.md).

**Routing hazard.** The last route in `web.php` is a clean category catch-all:
```php
Route::get('/{categorySlug}', ...)->where('categorySlug',
  '^(?!shop|collection|product|cart|checkout|order|search|blog|about|support|login|signup
    |admin|account|newsletter|forgot-password|reset-password|check-email|logout|cart-api
    |account-api|storage|frontend|css|js|images|vendor|build).*$')
```
React Router must reproduce this **exclusion list exactly** and register the catch-all last, or
`/shop`, `/cart`, `/admin`, etc. will be swallowed by the category page.

---

## 7. Migration order (unchanged from brief, confirmed by audit)

Phase 1 backend foundation → 2 auth → 3 catalog → 4 CMS/home → 5 cart → 6 wishlist →
7 promotions → 8 account → 9 checkout → 10 Razorpay → 11 email → 12 Meta → 13 admin →
14 final integration.

The audit confirms no dependency forces a different order. Cart (5) must precede promotions (7)
because `PromotionService.quote` consumes formatted cart lines; promotions must precede
checkout (9).

---

## 8. Companion documents

| Document | Contents |
|---|---|
| [`route-mapping.md`](./route-mapping.md) | Every Laravel route → Express route → React page |
| [`controller-mapping.md`](./controller-mapping.md) | Laravel controller → Express controller/service |
| [`database-mapping.md`](./database-mapping.md) | 35 tables → Prisma models, with FK/index notes |
| [`env-mapping.md`](./env-mapping.md) | Every env var classified; names only, no values |
| [`integration-mapping.md`](./integration-mapping.md) | Razorpay, Meta, mail, storage contracts |
| [`migration-status.md`](./migration-status.md) | Live per-feature status board |
