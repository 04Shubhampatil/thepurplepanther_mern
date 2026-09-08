# Migration Status

Single source of truth for progress. **Nothing is marked COMPLETE until every box in the
completion criteria is genuinely ticked** — compiling is not completing.

Last updated: 2026-09-08 · Current phase: **6+8 → 9**

`COMPLETE*` = code complete and tested, with one task blocked on an external input that is
named in that phase's section. It is not a substitute for COMPLETE and does not unblock a
dependent phase on its own.

Status values: `NOT STARTED` · `IN PROGRESS` · `BLOCKED` · `COMPLETE`

---

## Phase 0 — Audit

| Item | Status |
|---|---|
| Route audit (`web.php`, `api.php`, `console.php`, `channels.php`) | COMPLETE |
| Controller inventory (31 controllers, all methods) | COMPLETE |
| Service audit (5 services, business rules extracted) | COMPLETE |
| Model + relationship audit | COMPLETE |
| Database schema audit (35 tables, FKs, indexes, uniques) | COMPLETE |
| Env audit (66 vars classified, no values exposed) | COMPLETE |
| Integration audit (Razorpay, Meta ×2, mail, storage) | COMPLETE |
| View/asset inventory (114 Blade, 27 JS) | COMPLETE |
| Risk register (R1–R8) | COMPLETE |
| Target project structure created | COMPLETE |

**PHASE 0: COMPLETE.** Documents: `laravel-audit.md`, `route-mapping.md`,
`controller-mapping.md`, `database-mapping.md`, `env-mapping.md`, `integration-mapping.md`.

---

## Feature board

| # | Feature | Backend | Frontend | Tests | Laravel comparison |
|---|---|---|---|---|---|
| 1 | Backend foundation | COMPLETE* | n/a | PASS (22) | n/a |
| 2 | Auth (customer + admin) | COMPLETE* | NOT STARTED | PASS (57) | PASS (rules) |
| 3 | Catalog | COMPLETE* | NOT STARTED | PASS (71) | PASS (rules) |
| 4 | CMS / home | COMPLETE* | NOT STARTED | PASS (32) | PASS (rules) |
| 5 | Cart | COMPLETE* | NOT STARTED | PASS (79) | PASS (rules) |
| 6 | Wishlist | COMPLETE* | NOT STARTED | PASS (with account) | PASS (rules) |
| 7 | Promotions / coupons | COMPLETE* | NOT STARTED | PASS (with cart) | PASS (rules) |
| 8 | Account | COMPLETE* | NOT STARTED | PASS (54) | PASS (rules) |
| 9 | Checkout | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED |
| 10 | Razorpay | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED |
| 11 | Email | NOT STARTED | n/a | NOT STARTED | NOT STARTED |
| 12 | Meta CAPI + catalog | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED |
| 13 | Admin panel | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED |
| 14 | Final integration | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED |

---

## Phase 1 — Backend foundation

**Status: COMPLETE except the database restore, which is blocked on local MySQL credentials.**

| Task | Status |
|---|---|
| Clean up the pre-existing `server/` stub (see below) | COMPLETE |
| Pin Prisma CLI + client to the same stable release (7.10.0) | COMPLETE |
| Hand-write `schema.prisma` from the verified DDL — 35 models | COMPLETE |
| `prisma validate` passes | COMPLETE |
| `prisma generate` produces a client | COMPLETE |
| `prisma.config.ts` (Prisma 7 datasource) with dev-URL preference | COMPLETE |
| `src/config/env.js` — Zod-validated env, fail-fast at boot | COMPLETE |
| `src/config/logger.js` — pino with a secret redaction list | COMPLETE |
| `src/config/database.js` — MariaDB driver adapter + client singleton | COMPLETE |
| `src/utils/money.js` — `Money::format` + PHP-compatible rounding | COMPLETE |
| `src/utils/media.js` — `Media::url` five-branch resolution | COMPLETE |
| `src/utils/json.js` — BigInt serialisation + longtext JSON columns | COMPLETE |
| `src/utils/api-error.js` / `api-response.js` — response envelope | COMPLETE |
| `src/middleware/error.middleware.js` — central handler, Express 5 | COMPLETE |
| helmet, CORS (credentialed), cookie-parser, rate limiting | COMPLETE |
| `GET /api/v1/health` + `GET /api/v1/config` | COMPLETE |
| `server/.env.example` (names only, no values) | COMPLETE |
| `.gitignore` excluding `.env*` and `*.sql` | COMPLETE |
| `scripts/database/restore-dev.js` with four safety guards | COMPLETE |
| Foundation test suite — **22 passing** | COMPLETE |
| **Restore dump into local `purple_panther_dev`** | **BLOCKED** — needs local MySQL password |
| Verify hand-written schema by `prisma db pull` diff | BLOCKED (depends on the restore) |
| `git init` + `migration/audit-complete` checkpoint | COMPLETE |

### Pre-existing stub issues — all resolved

1. **Version mismatch** — was `prisma@8.0.0-rc.13` against `@prisma/client@7.10.0`.
   Both pinned to **7.10.0**. Note npm's `latest` tag on `prisma` currently points at an
   **8.0.0 release candidate**; 7.10.0 is the stable line (`prev` tag). Do not "upgrade"
   on the CLI's update nag.
2. **Stray dependencies** — a `postinstall` hook (`prisma skills sync`) had pulled in
   `alchemy`, `capnp-es` and **PGlite (PostgreSQL)**, contradicting the MySQL requirement.
   Hook removed, `node_modules` and lockfile deleted, clean reinstall:
   **68,516 files → 373 packages.**
3. **`main` pointed at a non-existent `index.js`** — now `src/index.js`.
4. **`src/app.js` could not start** — it called `express.static()` with no argument, which
   throws, and `src/index.js` imported a `./db/index.js` that did not exist. Both rewritten.
5. `prisma.config.ts` previously configured the "skills" toolchain rather than a datasource.
   Replaced.

### Prisma 7 note

Prisma 7 removed `url` from the `datasource` block. The schema declares only the provider;
CLI commands read the URL from `prisma.config.ts` (which prefers `DATABASE_URL_DEV`), and the
runtime client connects through the `@prisma/adapter-mariadb` driver adapter.

### Defect found by the phase-1 tests

`GET /api/v1/health` originally awaited the Prisma probe with no timeout, so with the database
down the request hung for the driver's full connect-retry cycle instead of reporting `down`.
An outage would have read as a hang to any load balancer. Fixed with a 2 s race; four tests
cover it.

### To unblock the restore

Add your local MySQL password to `server/.env` (replace `CHANGE_ME` in both `DATABASE_URL`
and `DATABASE_URL_DEV`), then:

```
cd server && npm run db:restore
```

The script refuses to run unless the host is local, the database name is not the production
name, and the name ends in `_dev` / `_test` / `_local`.

---

## Phase 2 — Auth (backend)

**Status: backend COMPLETE and tested. React pages deferred to the frontend pass.**

| Task | Status |
|---|---|
| D5 spike — Laravel `$2y$` hash compatibility | COMPLETE (defect found + fixed) |
| `utils/auth-token.js` — JWT, cookies, Laravel-compatible reset tokens | COMPLETE |
| `services/auth.service.js` — all rules from the 3 Laravel controllers | COMPLETE |
| `middleware/auth.middleware.js` — `auth` / `customer` / `admin` / `guest` | COMPLETE |
| `middleware/validate.middleware.js` — Zod, authoritative server-side | COMPLETE |
| `validators/auth.validator.js` — rules + verbatim messages | COMPLETE |
| Customer login / register / logout / me / check-email | COMPLETE |
| Forgot password + reset (2/day cap, 60-min expiry, hashed tokens) | COMPLETE |
| Admin login / logout / me (username **or** email) | COMPLETE |
| Auth rate limiting (Laravel had none on login) | COMPLETE |
| `integrations/email/` — mailer + reset template | COMPLETE |
| `docs/api.md` | COMPLETE |
| Tests — 57 auth + 22 foundation = **79 passing** | COMPLETE |
| Verify queries against real data | BLOCKED (dev DB restore) |
| React `Login` / `Signup` / `ForgotPassword` / `ResetPassword` pages | NOT STARTED |

### Laravel comparison

Verified rule-for-rule against `CustomerAuthController`, `Admin\AuthController` and
`CustomerPasswordController`:

- Customer login scoped to `role='customer'`; admin login to `role='admin'`; both require
  `is_active`. An admin cannot sign in through the storefront endpoint, and vice versa.
- Admin's single `username` field accepts a username **or** an email, resolved the same way.
- Every user-visible message reproduced verbatim.
- Reset: 2 emails per address per 24 h → 429; 60-minute expiry; bcrypt-hashed token stored
  under an email primary key; single use; `remember_token` rotated; user **not** signed in
  afterwards.
- Reset token format matches Laravel's exactly, so links issued by either app work in both —
  required for the parallel run and rollback.

### Deliberate differences

| # | Change | Why |
|---|---|---|
| 1 | Sessions → JWT in an HTTP-only cookie | Brief §14. Not readable by JS; works cross-origin. |
| 2 | Failed admin check returns 403 instead of logging the user out | Laravel's `AdminMiddleware` called `auth()->logout()`, silently ending a *customer's* storefront session and dropping their cart if they touched an admin URL. |
| 3 | Rate limiting on login/register | Laravel throttled password resets only; login had no brute-force protection at all. |
| 4 | Reset email is not awaited on the checkout path | Groundwork for audit R8. The forgot-password response still awaits, so the customer is told the truth. |

### Known gaps

- **Admin password reset is not implemented.** Laravel routed `/admin/forgot-password` through
  the generic broker, but the customer flow scopes `password_reset_tokens` to
  `role='customer'` and there is no admin-specific mailable in the source. Scoping this needs
  a product decision. Admin passwords are managed via admin user CRUD in phase 13.
- Tests mock Prisma, so they verify business rules rather than SQL. Query correctness is
  confirmed once the dev database is restored.

## Phase 3 — Catalog (backend)

**Status: backend COMPLETE and tested. React pages deferred to the frontend pass.**

| Task | Status |
|---|---|
| `utils/product-presenter.js` — Laravel model accessors | COMPLETE |
| `services/catalog.service.js` — listing, detail, search, home | COMPLETE |
| `services/review.service.js` | COMPLETE |
| Product listing with category scope, search, pagination | COMPLETE |
| Product detail + related + recently-viewed | COMPLETE |
| Type-ahead search | COMPLETE |
| Taxonomy endpoints (categories, sub-categories, brands, colors, sizes) | COMPLETE |
| `GET /home` with all fallback chains | COMPLETE |
| Public review submission | COMPLETE |
| `vitest.config.js` + `tests/setup.js` | COMPLETE |
| Tests — 31 presenter + 40 catalog = **71**; suite total **150** | COMPLETE |
| Verify queries against real data | BLOCKED (dev DB restore) |
| React catalog pages | NOT STARTED |

### Laravel comparison

Verified against `FrontendController::home / collection / search / shopSingle /
storeProductReview / applyProductSearch`:

- Ordering `sort_order ASC, id DESC` on every product list; `paginate(50)`.
- Search spans the same six fields including category and sub-category names.
- Unknown category slug → 404 (`abort(404)`).
- Type-ahead returns empty below 2 characters **without querying**.
- Gallery assembly including the first-colour override and the pad-to-4 rule.
- `discountPercent` gives an attached offer precedence over the computed difference.
- Related products: same category, topped up to ≥4 from elsewhere.
- Recently-viewed re-sorted into the order the ids were supplied.
- All three homepage fallback chains, including the `slug='accessories' OR title LIKE
  '%accessor%'` fallback.
- Reviews created active; guest reviews linked to a customer account by email.

### N+1 prevention

Laravel's `with([...])` becomes an explicit Prisma `include`. Because Prisma has no lazy
loading, a missing include fails loudly in tests rather than degrading into a per-row query
in production. Tests assert the include sets directly. Listing runs its count and page in one
`$transaction`; the homepage issues its independent queries concurrently.

### Deliberate differences

| # | Change | Why |
|---|---|---|
| 1 | Recently-viewed moves from the PHP session to the client | Per-device UI state with no business meaning — it never affects pricing, stock or any server decision. Passed back as `?ids=`. |
| 2 | `per_page` capped at 100 | Laravel's `paginate(50)` was not client-controllable; exposing the parameter without a cap would let anyone request the whole table. |

### Deferred improvements (recorded, not done)

| # | Item |
|---|---|
| I6 | Reviews are published immediately with no moderation queue |
| I7 | Reviews require no purchase, and a guest review is auto-linked to a customer account by email alone — someone can attach a review to an account they did not authenticate as |

## Phase 4 — CMS (backend)

**Status: backend COMPLETE and tested. React pages deferred to the frontend pass.**

| Task | Status |
|---|---|
| `constants/cms.js` — banner sections, site pages, support pages, account pages | COMPLETE |
| `services/cms.service.js` — blog, banners, pages | COMPLETE |
| `GET /blog` with news-type filter, featured post, pagination (9) | COMPLETE |
| `GET /blog/:slug` with related, prev and next | COMPLETE |
| `GET /news-types`, `GET /banners` | COMPLETE |
| `GET /pages`, `GET /pages/:slug`, `GET /pages/support[/:page]` | COMPLETE |
| Tests — **32**; suite total **182** | COMPLETE |
| Verify queries against real data | BLOCKED (dev DB restore) |
| React blog / support / about pages | NOT STARTED |

### Laravel comparison

Verified against `FrontendController::blog / blogSingle / support` and the two Support classes:

- `scopePublished` = active AND (`published_at` IS NULL **OR** `<= now`). A post with no
  publish date is **published**, not a draft — reading that branch the other way would
  silently hide posts.
- Featured post: featured-within-type → most recent-within-type, then **excluded** from the
  paginated list so it does not render twice.
- An unknown `?type=` falls through to all posts rather than 404ing (Laravel's `when()`).
- `paginate(9)`; ordering `sort_order ASC, published_at DESC`.
- prev/next navigate by **id**, not publish date — preserved as-is.
- Support slugs validated against the 9-entry allow-list; 404 otherwise.
- Banner sections: all 13 keys from `BannerSections`, first banner per section, active
  images only, ordered by `sort_order`.

### Design notes

- List payloads omit `content`, so a 9-post page does not ship nine full article bodies.
- Support page **content** stays in the view layer (Blade → React components), exactly as it
  was. The API only validates the slug and resolves its title.

### New finding — audit R11

The `pages` table is **write-only** in the source application: admins can edit four pages but
no storefront view reads them. `GET /pages/:slug` is exposed so the content is reachable;
actually rendering it is a product decision, not a migration one.

## Phase 5 + 7 — Cart, shipping and promotions (backend)

**Status: backend COMPLETE and tested. React pages deferred to the frontend pass.**

**Phases 5 and 7 were merged.** `CartService::summary()` depends on both
`PromotionService` and `ShippingService` — the same dependency Laravel's constructor
declared. Totals cannot be verified without coupons, so splitting them would have meant
shipping an unverifiable phase. The audit's reordering clause covers this.

| Task | Status |
|---|---|
| `services/shipping.service.js` | COMPLETE |
| `services/promotion.service.js` — full coupon gauntlet, BOGO, redemptions | COMPLETE |
| `services/cart.service.js` — port of the 520-line CartService | COMPLETE |
| `middleware/guest-cart.middleware.js` — signed cookie transport | COMPLETE |
| Cart CRUD, buy-now, coupon apply/remove, public coupons | COMPLETE |
| Guest cart merge on login and registration | COMPLETE |
| Tests — **79**; suite total **261** | COMPLETE |
| Verify against real data | BLOCKED (dev DB restore) |
| React cart page | NOT STARTED |

### The rules that decide what customers are charged

All test-pinned, all traced to source:

- **Line identity** = `product|colour|size|package`, lower-cased. Variant normalisation
  nulls `''`, `'?'` and `'select'` — the placeholders unset `<select>` elements submit.
  Treating those as real variant names creates lines a customer can never update or remove.
- **Max quantity** = `min(max_unit_buy or 99, colour stock, size stock)`, matched
  case-insensitively, and validated against the **accumulated** total on add — not just the
  increment, or repeated adds walk past the stock limit.
- **Default variants**: first colour **upper-cased**, first size. The upper-casing matters —
  colour gallery keys are upper-cased, so a lower-cased default fails to match its gallery.
- **Packages** apply only to the `accessories` category, priced from the product row.
  An unknown key falls back to the first package. A stored line keeps its **stored** price,
  so repricing in admin does not silently change a cart in progress.
- **Totals pipeline**: subtotal → discount → **shipping quoted on (subtotal − discount)** →
  free-shipping override → total. Quoting shipping on the raw subtotal is a silent parity
  break worth ₹60 on every affected order; two tests cover the boundary.
- **Coupon gauntlet** in Laravel's order, each with its own message: window/usage-limit,
  members-only, new-customers-only (a **guest is eligible**), once-per-user, scope,
  min quantity, min cart amount — the last three against the **eligible subset**, not the
  whole cart.
- **BOGO is per line**, so a cheap item cannot make an expensive one free. This is the rule
  that protects margin; a cart-wide grouping would discount a ₹5,000 item against a ₹100 one.
- A zero discount is an error **unless** the coupon grants free shipping.
- The applied code is session state, re-validated on every cart read; an invalid one is
  dropped with its reason surfaced rather than throwing.
- `recordRedemption` writes the row **and** increments `used_count` together — splitting
  them lets the counter drift and breaks `usage_limit`.

### Guest cart transport (decision D1, resolved)

Laravel kept the guest cart in the PHP session. `cart_items.user_id` is `NOT NULL` with an
FK to `users`, so guest rows cannot live there without placeholder users or a schema change
— both out of scope. The guest cart is therefore a **signed, HTTP-only cookie**.

It is safe because it carries only product ids, quantities and variant keys — no prices, no
totals. Every price is re-resolved from the database, coupons are re-validated on every
read, and quantities are re-checked against live stock on mutation and again before an order
is created. A test confirms an unsigned forged cookie is ignored, and another confirms a
client-submitted `unit_price` has no effect.

## Phase 6 + 8 — Wishlist and account (backend)

**Status: backend COMPLETE and tested.** Merged because the wishlist has no surface of its
own — it is a tab of the account area and lives in `AccountController`.

| Task | Status |
|---|---|
| `constants/order-statuses.js` — the status machine | COMPLETE |
| `services/account.service.js` — bootstrap, profile, addresses, wishlist, reviews, orders | COMPLETE |
| Profile update with current-password gate | COMPLETE |
| Address CRUD + default handling | COMPLETE |
| Wishlist add (idempotent) / remove by row or product | COMPLETE |
| Review list and delete | COMPLETE |
| Order history + single order lookup | COMPLETE |
| Tests — **54**; suite total **315** | COMPLETE |
| Verify against real data | BLOCKED (dev DB restore) |
| React account pages | NOT STARTED |

### Authorisation

Every account mutation takes a row id from the URL, so each one re-reads the row and
compares `user_id` before writing. Six tests attempt each mutation against another
customer's row and assert 403 **and** that no write was issued — a missing ownership check
is the classic IDOR and would be invisible in normal use. A missing row returns 404, not 403,
so the API does not confirm which ids exist.

The whole router sits behind `requireAuth + requireCustomer`, applied once at the router
rather than per route, so a newly added endpoint cannot ship unauthenticated by omission.

### Rules preserved

- Profile: name is `first + last`; email unique excluding self; a password change requires
  the **current** password, so a hijacked session cannot lock the owner out.
- The **first** address a customer creates becomes default automatically — otherwise
  checkout has nothing to pre-fill. Promoting one un-defaults every other.
- Wishlist add is idempotent, matching `firstOrCreate` against the
  `(user_id, product_id)` unique key. `created` is reported so phase 12 can gate the Meta
  event the way `wasRecentlyCreated` did.
- Reviews are matched by `user_id` **OR** `reviewer_email`, so a review left as a guest
  before the account existed still appears.
- Order history shows only `payment_status='paid'` **or** a status past payment. A `pending`
  order is one where checkout started and Razorpay never confirmed; showing those would
  present customers with orders they never completed.
- Legacy `pending` displays as `Placed`; the stored value is untouched.
- `/account/favorites` and `/account/wishlists` alias to `wishlist`.

### Quirk carried over

Review ownership is checked on `user_id` alone, but the list also matches on email. A review
with a NULL `user_id` therefore appears in "My Reviews" and cannot be deleted. Preserved, and
surfaced to the UI as `canDelete` so the frontend hides the control rather than offering an
action that 403s.

## Open decisions

| # | Decision | Recommendation | Status |
|---|---|---|---|
| D1 | Guest cart transport | Signed HTTP-only cookie + server-side cart rows | proposed |
| D2 | Auth token transport | HTTP-only cookie holding a JWT (brief's preference) | proposed |
| D3 | Legacy 301s in proxy or React | Reverse proxy — real 301s for crawlers | proposed |
| D4 | `products.accessory_packages` JSON mapping | `Json? @db.LongText`, fallback to string + manual parse | verify in phase 1 |
| D5 | Password hash compatibility | Normalise `$2y$` → `$2b$` before comparing | **RESOLVED — fix implemented** |

### D5 — resolved in phase 1, and it was a real defect

Tested rather than assumed, and the assumption would have been wrong. The `bcrypt` npm
package **does not accept Laravel's `$2y$` prefix**. Given the same algorithm, cost, salt and
digest:

```
$2a$ -> true      $2b$ -> true      $2y$ -> false
```

It returns `false` — it does not throw. A naive port would have failed every pre-existing
customer's login with "these credentials do not match our records", indistinguishable from a
wrong password, with nothing in the logs. Total silent lockout at cutover.

**Fix:** `server/src/utils/password.js` rewrites the 4-character version prefix before
comparison. Cost, salt and digest are untouched, so nothing is weakened — `$2a$`, `$2b$` and
`$2y$` are the same algorithm; the prefix is a historical marker from the 2011 PHP
crypt_blowfish fix. New hashes are written as `$2b$`, which PHP's `password_verify()` also
accepts, so a password changed in the new app still works in Laravel during the parallel run
and after a rollback.

**No customer needs a password reset.** 15 tests in `tests/password-hash.test.js` cover it,
including one that pins the upstream `bcrypt` behaviour so the regression cannot be
reintroduced by "simplifying" the utility.

---

## Deferred improvements (post-cutover, not parity work)

Recorded so they are not lost, and explicitly **not** done during migration:

| # | Item | From |
|---|---|---|
| I1 | Razorpay webhook to close the abandoned-tab payment gap | integration §1 |
| I2 | Add FKs + index on `banner_images.banner_id`, `blog_posts.news_type_id` | audit R4 |
| I3 | Unique constraint on the `cart_items` logical line key | audit R7 |
| I4 | Record real `mrp`/`saving` on order items | audit R5 |
| I5 | Move transactional email to a real queue | audit R8 |

Exception: **audit R1 (unauthenticated catalog feed) is fixed during migration**, not deferred,
because it is an active data-exposure issue. It is the only intentional behaviour change.
