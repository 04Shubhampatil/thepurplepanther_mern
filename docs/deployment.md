# Deployment & Cutover Runbook

The migration brief is explicit (§59): **do not switch production immediately.** Deploy to
staging against the same MySQL, verify, then cut over with Laravel kept warm as a rollback.

```
Laravel (live)  ──┐
                  ├──> the SAME MySQL database
React + Express ──┘   (staging first, then production)
```

Both applications read and write the same rows. That is deliberate and is what makes the
cutover reversible — nothing is migrated, copied or transformed.

---

## 0. Hosting note — where the database lives

The production `.env` has `DB_HOST=localhost`. That is the **hosting server's** localhost,
not a developer machine: Hostinger binds MySQL to the local interface, so the production
database is not reachable from anywhere else.

Two consequences:

1. **The Node API must run on the same host as the database**, or MySQL must be opened to
   the API's address (and firewalled to it). Plan this before cutover.
2. **Production credentials cannot restore a local dev database.** Local work needs a
   *local* MySQL user; the dump is restored into `purple_panther_dev` on your own machine.
   The two are unrelated, and conflating them is how a development run ends up writing to
   live orders.

`scripts/database/restore-dev.js` enforces the separation: it refuses any non-local host,
the production database name, and any name not ending in `_dev` / `_test` / `_local`.

## 0b. Prerequisites

| Requirement | Notes |
|---|---|
| Node.js ≥ 20 | `server/package.json` sets `engines` |
| MySQL 8.0 / MariaDB | The existing production database |
| The `public/storage` tree | Uploaded media. Both apps must see the same directory. |
| The `public/frontend` tree | Bundled theme (CSS, fonts, images), served at `/frontend` |

---

## 1. Local setup

```bash
# 1. Restore a copy of production into a LOCAL dev database
#    (server/.env must have DATABASE_URL_DEV pointing at a *_dev database)
cd server && npm run db:restore

# 2. Verify the schema matches what the code expects
node ../scripts/verification/verify-schema.js

# 3. Verify the data
node ../scripts/verification/verify-data.js

# 4. Generate the Prisma client and run the tests
npm run prisma:generate
npm test

# 5. Start both processes
npm run dev                 # API  → http://localhost:5000
cd ../client && npm run dev # Site → http://localhost:5173
```

The Vite dev server proxies `/api`, `/storage` and `/frontend` to the API, so the browser
sees a single origin and the auth and guest-cart cookies stay first-party.

`npm run db:restore` refuses to run against anything but a local host, and refuses the
production database name or any name not ending in `_dev` / `_test` / `_local`.

---

## 2. Environment

Copy `server/.env.example` to `server/.env` and fill it in. **Never commit it.**

Values that must be set before the app will boot:

| Variable | Note |
|---|---|
| `DATABASE_URL` | `mysql://user:pass@host:3306/database` |
| `JWT_SECRET` | ≥32 bytes — `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `SESSION_SECRET` | ≥32 bytes, different from `JWT_SECRET` |
| `META_CATALOG_FEED_TOKEN` | **Mandatory** — see §5 |

Production-specific:

```env
NODE_ENV=production
APP_URL=https://api.thepurplepanther.in
FRONTEND_URL=https://thepurplepanther.in
COOKIE_SECURE=true
COOKIE_DOMAIN=.thepurplepanther.in     # so the cookie is shared across subdomains
COOKIE_SAME_SITE=lax
MEDIA_BASE_URL=https://thepurplepanther.in/storage
STORAGE_ROOT=/absolute/path/to/public/storage
THEME_ROOT=/absolute/path/to/public/frontend
```

> **Cookies across subdomains.** With the API on `api.` and the site on the apex, set
> `COOKIE_DOMAIN=.thepurplepanther.in`. Without it the auth cookie is scoped to the API
> host, every request arrives anonymous, and carts silently empty. Serving both from one
> origin behind a reverse proxy avoids the problem entirely and is the simpler option.

`client/.env` needs one variable: `VITE_API_BASE_URL` (blank if same-origin).

---

## 3. Build

```bash
cd server && npm ci --omit=dev && npx prisma generate
cd ../client && npm ci && npm run build      # → client/dist
```

Serve `client/dist` as static files with an SPA fallback: **every unmatched path must
return `index.html`**, or a refresh on `/product/some-slug` 404s.

nginx:

```nginx
location / {
  root /var/www/purple-panther/client/dist;
  try_files $uri $uri/ /index.html;
}

location /api/    { proxy_pass http://127.0.0.1:5000; }
location /storage/ { alias /var/www/public/storage/; expires 30d; }
location /frontend/ { alias /var/www/public/frontend/; expires 30d; }

# The Meta catalog feed keeps its original path.
location = /catalog/meta/products.csv { proxy_pass http://127.0.0.1:5000; }
```

Proxy headers must be forwarded (`X-Forwarded-For`, `X-Forwarded-Proto`) — the app sets
`trust proxy`, and without them rate limiting sees one IP and Meta CAPI reports the
proxy's address.

---

## 4. Legacy redirects — do these at the proxy

React ships client-side fallbacks, but crawlers need real 301s. Put these in the web server
so they resolve before the SPA loads:

```nginx
location = /faqs.html              { return 301 /support/faqs; }
location = /privacy-cookies.html   { return 301 /support/privacy; }
location = /returns-exchanges.html { return 301 /support/returns; }
location = /shipping.html          { return 301 /support/shipping; }
location = /size-guide.html        { return 301 /support/size-guide; }
location = /start-return.html      { return 301 /support/start-return; }
location = /terms-conditions.html  { return 301 /support/terms; }

location = /account-overview.html    { return 301 /account/overview; }
location = /account-orders.html      { return 301 /account/orders; }
location = /account-information.html { return 301 /account/information; }
location = /account-addresses.html   { return 301 /account/addresses; }
location = /account-favorites.html   { return 301 /account/wishlist; }
location = /account-wishlists.html   { return 301 /account/wishlist; }
location ~ ^/product/account-(.+)\.html$ { return 301 /account/$1; }
```

Full list in [`route-mapping.md`](./route-mapping.md) §7. **SEO regressions are
unacceptable** (brief §37) — check these before, not after.

---

## 5. Required before go-live

- [ ] **Generate `META_CATALOG_FEED_TOKEN`** and update the feed URL in Meta Commerce
      Manager to `…/catalog/meta/products.csv?token=<token>`.
      *The feed is currently unauthenticated in production (audit R1). The new app refuses
      to boot without a token, so this is not optional.*
- [ ] **Rotate every credential** in the archived `.env` — it shipped inside the source
      archive. Checklist in [`env-mapping.md`](./env-mapping.md) §11.
- [ ] Confirm `STORAGE_ROOT` and `THEME_ROOT` point at the live directories.
- [ ] Confirm SMTP works — place a test order on staging and check both emails arrive.
- [ ] Confirm Razorpay in **test mode** end to end, then switch keys.
- [ ] `GET /api/v1/health` returns `200` with every integration `true`.

---

## 6. Staging verification

Run the full journey from the brief (§47) against staging, on the production database:

**Customer:** register → sign in → browse → search → filter → open product → select
variant → add to cart → change quantity → apply coupon → checkout → pay → verify → order
appears → emails arrive → visible under Account → Orders.

**Admin:** sign in → dashboard → create/edit a product with images and variant stock →
categories → coupons → orders → change status → set delivery date → users → CMS → banners →
blog.

Also verify explicitly:

- [ ] A guest cart survives sign-in (it is merged, not dropped)
- [ ] A coupon that pushes the cart below ₹899 makes delivery chargeable again
- [ ] An existing customer can sign in **with their old password** (the `$2y$` fix)
- [ ] An old password-reset link still works
- [ ] `/accessories` and the other clean category URLs resolve
- [ ] `/cart`, `/admin`, `/checkout` are **not** treated as categories
- [ ] Product images render (media paths resolve)

---

## 7. Cutover

1. Announce a short maintenance window.
2. Deploy the API and the built client; keep Laravel running and reachable.
3. Point DNS / the proxy at the new stack.
4. Smoke test: home, a product, add to cart, one **real** low-value order end to end.
5. Watch logs and `/api/v1/health` for the first hour.

**Do not delete the Laravel application** (brief §52). Keep it and its `.env` intact for
the whole rollback window.

---

## 8. Rollback

Because both applications share one database and nothing was transformed, rollback is a
proxy change:

1. Point the proxy back at Laravel.
2. Verify the storefront loads and an order can be placed.
3. Capture what failed before retrying.

Orders taken by the new app are already in the same tables and remain visible in the
Laravel admin. Passwords changed in the new app use the `$2b$` prefix, which PHP's
`password_verify()` also accepts — so customers are not locked out by a rollback either.

**The one thing that does not roll back automatically** is the Meta catalog feed URL: if
you added a token, Laravel ignores it and still serves the feed, so nothing breaks.

---

## 9. After cutover

Deferred improvements, recorded and deliberately not done during the migration —
see [`migration-status.md`](./migration-status.md):

| # | Item |
|---|---|
| I1 | Razorpay webhook, to close the abandoned-tab payment gap |
| I2 | Add the missing FKs and index (audit R4) |
| I3 | Unique constraint on the `cart_items` logical line key |
| I4 | Record real `mrp` / `saving` on order items |
| I5 | Move transactional email to a real queue |
| I6 | Review-moderation queue |
| I7 | Stop auto-linking guest reviews to accounts by email alone |
| I8 | SSR or prerendering for product and category metadata |
