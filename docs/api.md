# API Reference

Base URL: `/api/v1`

All responses use one envelope:

```jsonc
// success
{ "success": true, "data": { }, "message": "Success" }

// error
{ "success": false, "message": "Something went wrong", "errors": { "field": ["..."] } }
```

**Authentication** is a JWT in an HTTP-only cookie (`pp_token`), set on login/register and
cleared on logout. It is not readable by JavaScript and is never returned in a response body.
Requests must be sent with credentials (`fetch(..., { credentials: 'include' })` /
`axios.defaults.withCredentials = true`).

Status codes: `200` ok · `201` created · `401` not signed in · `403` signed in but not
permitted · `404` not found · `422` validation or business-rule failure · `429` rate limited ·
`500` unexpected.

Documented as implemented. Sections appear as each phase lands.

---

## System

### `GET /health`
Public. `200` when the database responds within 2s, `503` otherwise.

```jsonc
{ "success": true, "message": "Healthy",
  "data": { "status": "ok", "environment": "production", "timezone": "Asia/Kolkata",
            "uptime": 1024,
            "checks": { "database": "up", "latencyMs": 4 },
            "integrations": { "razorpay": true, "mail": true, "metaCapi": true, "metaCatalog": true } } }
```
`integrations` reports only *whether* each is configured — never a value.

### `GET /config`
Public. The only server values React may read: `appName`, `mediaBaseUrl`, `currency`.
`RAZORPAY_KEY_ID` is deliberately **not** here — it ships with the checkout payload.

---

## Auth — customer

Rate limited to `AUTH_RATE_LIMIT_MAX` failed attempts per window; successful requests do not
count.

### `POST /auth/login`
Public.

| Field | Rules |
|---|---|
| `email` | required, email, ≤255, trimmed + lower-cased |
| `password` | required, min 6 |

`200` → `{ user, redirect: "/account/overview" }`, sets `pp_token`.

`422` → `"These credentials do not match our records."`

The same message is returned for an unknown email, a wrong password **and** a deactivated
account — deliberate, to prevent enumeration. An `admin` account cannot sign in here: the
lookup is scoped to `role = 'customer'`.

### `POST /auth/register`
Public.

| Field | Rules |
|---|---|
| `name` | required, ≤255 |
| `email` | required, email, unique across **all** users |
| `password` | required, min 6 |
| `password_confirmation` | optional; must match when present |

`200` → `{ user, redirect: "/account/overview" }`, signs the user in.
`422` → `"This email is already registered."` / `"Passwords do not match."` /
`"Password must be at least 6 characters."`

### `POST /auth/logout`
Public (clearing a cookie is harmless). `200` → `{ redirect: "/" }`.

### `GET /auth/me`
Public. Always `200`; `data.user` is `null` when signed out. The user is re-read from the
database on every request, so a deactivated account stops being recognised immediately rather
than at token expiry.

### `POST /auth/check-email`
Public. `{ email }` → `{ available: boolean }`. Excludes the signed-in user's own address so
profile editing does not report itself as taken.

---

## Auth — password reset

### `POST /auth/forgot-password`
Public. `{ email }`.

`200` → `{ remaining_attempts }` and an email is sent.
`422` → `"This email is not registered with us."` (parity — see audit **R10**).
`429` → `"You have reached the limit of 2 password reset emails in 24 hours. Please try again later."`

Rules preserved from `CustomerPasswordController`:
- Only `role='customer'` **and** `is_active` accounts get a link.
- Hard cap of **2 per address per 24 hours**, counted in `password_reset_attempts`.
- The token is a 60-character random string; only its **bcrypt hash** is stored in
  `password_reset_tokens`. The row is keyed by email, so a new request supersedes any
  outstanding link.
- Tokens expire after **60 minutes** (`config/auth.php: passwords.users.expire`).

Because the storage format matches Laravel's exactly, a link issued by either application is
redeemable by the other — which is what keeps the parallel run and rollback safe.

The emailed link points at the React app: `{FRONTEND_URL}/reset-password/{token}?email={email}`.

### `POST /auth/reset-password`

| Field | Rules |
|---|---|
| `token` | required |
| `email` | required, email |
| `password` | required, min 6 |
| `password_confirmation` | optional; must match when present |

`200` → `{ redirect: "/login" }`.
`422` → `"This reset link is invalid or has expired."`

One message covers a missing user, missing token, expired token and wrong token. On success
the token row is deleted (single use) and `remember_token` is rotated. **The user is not
signed in** — matching Laravel, so the new password is proven before a session is created.

---

## Auth — admin

### `POST /api/v1/admin/auth/login`
Public. Tighter rate limit than customer login.

| Field | Rules |
|---|---|
| `username` | required — accepts a **username or an email address** |
| `password` | required |

The field is resolved by whether the value parses as an email, reproducing
`Admin\AuthController::login`. Requires `role='admin'` **and** `is_active`.

`200` → `{ user, redirect: "/admin/dashboard" }`
`422` → `"Invalid username or password."` for every failure mode.

### `POST /api/v1/admin/auth/logout`
`200` → `{ redirect: "/admin/login" }`.

### `GET /api/v1/admin/auth/me`
Requires auth + admin. `401` when signed out, `403` for a signed-in customer.

> **Behaviour difference, intentional.** Laravel's `AdminMiddleware` called
> `auth()->logout()` before redirecting, so a signed-in *customer* who touched an admin URL
> was silently logged out of the storefront and lost their cart session. Here a non-admin
> gets `403` and keeps their session. Covered by a test.

**Admin password reset is not implemented.** Laravel exposed `/admin/forgot-password` through
the generic broker, but the customer reset flow scopes `password_reset_tokens` to
`role='customer'` and there is no admin-specific mailable in the source. Admin passwords are
managed through the admin user CRUD (phase 13). Tracked in `migration-status.md`.

---

## Catalog

All public. Prices are returned twice — a raw number for logic and a pre-formatted
`"₹ 1,234.56"` string for display. **The formatted value is authoritative**; React must never
re-implement currency formatting.

### `GET /products`
Powers `/shop`, `/collection` and `/{categorySlug}`.

| Query | Default | Notes |
|---|---|---|
| `q` or `search` | — | Both accepted; Laravel read either |
| `category` | — | Category **slug**. `404` if unknown or inactive |
| `page` | `1` | |
| `per_page` | `50` | Capped at 100 |

Search matches, case-insensitively, across: product `title`, `slug`, `short_description`,
`features`, plus the **category** and **sub-category** title/slug. Ordering is always
`sort_order ASC, id DESC`.

```jsonc
{ "success": true, "message": "Products",
  "data": { "products": [ /* cards */ ],
            "activeCategory": { "id": 2, "title": "Kurtis", "slug": "kurtis" } | null,
            "search": "cotton",
            "pagination": { "page": 1, "perPage": 50, "total": 66, "lastPage": 2, "hasMore": true } } }
```

Card shape: `id, title, slug, url, image, hoverImage, price, priceFormatted, mrp,
mrpFormatted, hasSellingPrice, discountPercent, isNewArrival, isFeatured, isTodaysDeal,
category, colors[], sizes[]`. Colours and sizes carry `quantity` — the per-variant stock the
cart uses.

### `GET /products/:slug`
Returns the product plus its related and recently-viewed products in one round trip.

| Query | Notes |
|---|---|
| `ids` | Comma-separated recently-viewed product ids, max 12. The current product is excluded and the rest are returned **in the order given**. |

`404` → `"Product not found."` for unknown or inactive products.

Detail adds: `shortDescription, features, saving, savingFormatted, maxUnitBuy, deliveryCharge,
gallery[], colourGalleries{}, subCategory, brand, offer, showSizeGuide, sizeGuideContent,
sizeGuideImage, highlights{}, informationItems[], specifications[], accessoryPackages[], seo{},
reviews{}`.

**Gallery rules** (from `FrontendController::shopSingle`, all preserved):
1. featured image, then the hover image when `featured_image_2` is set
2. then every product image with **no** colour attached
3. padded to at least 4 (the theme's slider breaks below 4), capped at 8
4. **if the first colour has its own images, they replace the whole gallery**

`colourGalleries` is keyed by **UPPERCASED** colour name.

`reviews` contains only active reviews: `{ count, average (1dp), breakdown{5..1}, items[] }`.
Reviewer email addresses are never returned.

`discountPercent` takes an attached **offer's** percent when one exists, even if the computed
mrp/selling-price difference is larger — matching `Product::getDiscountPercentAttribute`.

### `GET /search`
Type-ahead. Returns `{ query, products, count, seeAllUrl }`.
Fewer than **2 characters** returns empty **without touching the database**, and
`message: "Type at least 2 characters"`. `limit` defaults to 8, max 20.

### `GET /categories` · `GET /sub-categories` · `GET /brands` · `GET /colors` · `GET /sizes`
Active rows only, ordered `sort_order` then name/title.
`/sub-categories` accepts `?category_id=`.

### `GET /home`
The whole homepage in one request, with Laravel's fallback chains preserved so no section
ever renders empty:

| Section | Chain |
|---|---|
| `shopTheLook` | curated `home_section_products` (by `position`) → `is_featured` → any (2 items) |
| `newArrivals` | `is_new_arrival` → any (6) |
| `popularAccessories` | `is_popular_accessory` → category slug `accessories` **or** title containing `accessor` (6) |
| `journalPosts` | published posts (4) |
| `banners` | active banners grouped by `section`, first of each, with active images by `sort_order` |

### `POST /products/:slug/reviews`
Public — guests may review.

| Field | Rules |
|---|---|
| `rating` | required, integer 1–5 |
| `comment` | required, 10–2000 chars |
| `reviewer_name` | required, ≤255 |
| `reviewer_email` | required, email, ≤255 |

`201` → `"Thank you! Your review has been submitted."`

Two preserved behaviours worth knowing: reviews are created **active** (no moderation queue —
admins can only deactivate afterwards), and a guest review is linked to a customer account
when the supplied email matches one. Purchase is not required. Both are flagged as deferred
improvements in `migration-status.md`.

---

## Not yet implemented

Cart, wishlist, coupons, account, checkout, orders, blog/CMS, catalog feed and the admin
modules land in phases 4–13. See `route-mapping.md` for the planned surface and
`migration-status.md` for status.
