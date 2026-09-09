# Admin Panel Migration — Status

Rebuild of the Laravel/Blade admin panel in React + Vite + Tailwind against the existing
Node/Express + Prisma + MySQL API. The Laravel admin is the visual and functional source of
truth; this is a re-implementation, not a redesign.

**Last updated:** 2026-09-09

---

## 1. Audit findings

### Routes

`routes/web.php` lines 126–225 define the whole admin surface: a `guest` group (login,
forgot/reset password) and an `auth`+`admin` group containing everything else. Full route
list is mapped in §5.

### Controllers

20 controllers under `app/Http/Controllers/Admin/`: Auth, Dashboard, Profile, Category,
SubCategory, Brand, Color, Size, Offer, Product, Banner, HomeSection, NewsType, BlogPost,
Coupon, Contact, PageSetting, ShippingSetting, User, Order.

### Views

64 Blade files, ~4,800 lines, under `resources/views/admin/`. The heaviest are
`products/_form.blade.php` (620), `users/show.blade.php` (270), `coupons/_form.blade.php`
(267), `users/index.blade.php` (231), `layouts/app.blade.php` (224).

### Design system — read from `public/css/admin.css` (2,264 lines)

These are measured values, not choices. They now live as Tailwind tokens in
`client/src/admin.css`.

| Token | Value | Used by |
|---|---|---|
| `--primary` | `#e91e63` | buttons, active nav, avatar |
| `--primary-dark` | `#c2185b` | hover |
| `--sidebar` | `#1f2430` | sidebar |
| `--sidebar-2` | `#262c3a` | nav hover |
| nav-sub | `#181c26` | open submenu ground |
| topbar | `#2a3140` | header |
| `--bg` | `#f4f5f7` | page |

| Element | Geometry |
|---|---|
| sidebar | 250px, drawer below 991px |
| topbar | min-height 58px, sticky |
| content | padding 22px |
| `.card` | radius 10px, padding 18px, `0 2px 10px rgba(0,0,0,.04)` |
| `.btn` | radius 6px, 10px/16px, 13px/600 |
| `.btn-sm` | 6px/10px, 12px |
| `.btn-danger` | **white ground, primary text, 1px `#f8bbd0`** — not a red fill |
| `.table th/td` | 12px/10px, 1px `#eee` rule, 14px; th `#777` on `#fafafa` |
| `.nav-link` | 12px/18px, `#d7d9de`, 14px |
| `.nav-sub a` | 9px 18px 9px 46px, `#b8bbc4`, 13px |
| `.stat-card` | radius 10px, min-height 110px, h3 28px, **gradient** |

Order status badges are a closed set with fixed colour pairs (placed `#eceff1/#546e7a`,
packed `#e3f2fd/#1565c0`, shipped `#fff3e0/#ef6c00`, delivered `#e8f5e9/#2e7d32`, cancelled
`#ffebee/#c62828`).

### Two things easy to get wrong

1. **Brands is hidden, not removed.** `layouts/app.blade.php` and `dashboard.blade.php` both
   gate it behind `@php($showBrands = false)` with a comment saying so. The route, the
   controller and the API all exist. Reproduced as a `SHOW_BRANDS` constant in
   `AdminSidebar.jsx` and `Dashboard.jsx`.
2. **Gradients are original.** The dashboard's stat cards and Products Master tiles are
   `linear-gradient(135deg, …)` in `admin.css`. The brief says not to *invent* gradients;
   these are copied.

---

## 2. Completed

| Module | Backend | React UI | Visual QA |
|---|---|---|---|
| Design tokens (`client/src/admin.css`) | n/a | ✅ | pending |
| Stylesheet isolation (`theme/adminChrome.js`) | n/a | ✅ | pending |
| `AdminLayout` / `AdminSidebar` / `AdminHeader` | n/a | ✅ | pending |
| Component library (`components/admin/AdminUI.jsx`) | n/a | ✅ | pending |
| Dashboard | ✅ `stats` added to `dashboardStats()` | ✅ | pending |

### Stylesheet isolation

`index.html` loads the storefront theme (bootstrap.min.css, style.css, custom.css,
site-drawers.css, journal.css) for the shopfront. The Laravel admin loaded **only**
`admin.css`. `useAdminStylesheets()` sets `disabled = true` on those `<link>` elements while
the admin is mounted and restores them on unmount — instant, reversible, and no flash of
unstyled content on the storefront (which loading them on demand would cause).

---

## 3. Remaining

Backend endpoints already exist for all of these (see §5); the work is the React UI plus
per-module visual QA against the Blade view.

Categories · Sub-Categories · Brands (hidden) · Colors · Sizes · Offers · Products (incl.
the 620-line form, reviews, bulk actions) · Banners · Home Sections · News Types · Blog
Posts · Coupons · Orders (incl. status log, print) · Users · Contacts/Subscribers/Messages ·
Web Settings (CMS pages) · Shipping Settings · Profile · Change password · Admin auth
(login, forgot, reset).

### Temporary scaffolding

`AdminUI.jsx` ends with a clearly-marked compatibility shim exporting the previous panel's
primitive names (`AdminButton`, `AdminPage`, `AdminSection`, `EmptyRow`, `Pill`, `CONTROL`).
It exists so the build stays green while pages are rebuilt one at a time rather than all at
once under a red build. **It must be deleted with the last un-rebuilt page** (`Resource.jsx`).

---

## 4. Known issues / blockers

- **Visual QA is blocked on an admin credential.** One admin exists
  (`admin@purplpanther.com`); its password is not known here, and guessing at it or
  rewriting it against restored production data is not something to do unasked. Everything
  below `/admin` is behind `RequireAdmin`, so no admin screen has been seen rendered yet —
  only proven to build. A password, or permission to add a separate dev-only admin, unblocks
  it.
- Pages not yet rebuilt (Products, Orders, Contacts, Settings, Resource) still carry the
  earlier generic-Tailwind styling and do **not** match the Blade design.

---

## 5. Route → API map

| Laravel route | React route | API |
|---|---|---|
| `admin.login` | `/admin/login` | `POST /admin/auth/login` |
| `admin.logout` | — | `POST /admin/auth/logout` |
| `admin.dashboard` | `/admin/dashboard` | `GET /admin/dashboard` |
| `admin.profile.edit/update` | `/admin/profile` | `GET|PATCH /admin/profile` |
| `admin.categories.*` | `/admin/categories` | `/admin/categories` (+ `/:id/toggle`) |
| `admin.sub-categories.*` | `/admin/sub-categories` | `/admin/sub-categories` |
| `admin.brands.*` | `/admin/brands` | `/admin/brands` |
| `admin.colors.*` | `/admin/colors` | `/admin/colors` |
| `admin.sizes.*` | `/admin/sizes` | `/admin/sizes` |
| `admin.offers.*` | `/admin/offers` | `/admin/offers` |
| `admin.products.*` | `/admin/products` | `/admin/products`, `/check-title`, `/form-data`, `/sub-categories`, `/bulk`, `/:id/reviews` |
| `admin.banners.*` | `/admin/banners` | `/admin/banners` (POST update — PUT is blocked by the host's ModSecurity) |
| `admin.home-sections.*` | `/admin/home-sections` | `GET|POST /admin/home-sections` |
| `admin.news-types.*` | `/admin/news-types` | `/admin/news-types` |
| `admin.blog-posts.*` | `/admin/blog-posts` | `/admin/blog-posts` (+ `/:id/featured`) |
| `admin.coupons.*` | `/admin/coupons` | `/admin/coupons` |
| `admin.contacts.*` | `/admin/contacts` | `/admin/contacts`, `/subscribers/*`, `/messages/*` |
| `admin.settings.pages` | `/admin/settings/pages` | `GET /admin/settings/pages`, `PUT /:slug` |
| `admin.settings.shipping.*` | `/admin/settings/shipping` | `GET|PUT /admin/settings/shipping` |
| `admin.users.*` | `/admin/users` | `/admin/users` (+ `/bulk`, `/:id/toggle`) |
| `admin.orders.*` | `/admin/orders` | `/admin/orders` (+ `/bulk`, `/:id/print`, `/status-data`, `/status`, `/delivery-date`, `/status-logs/:logId`) |

---

## 6. Database

No schema change. Prisma already models the existing Laravel MySQL database and the admin
API reads and writes it directly. The only server change in this work is additive: the
`stats` block on `dashboardStats()`, which adds counts (categories, sub-categories, brands,
colors, sizes, offers) so the dashboard's cards and tiles read the same figures Laravel's
`DashboardController` produced. No migration was created, generated or run.

---

## 7. Deployment notes

- The admin is part of the same SPA bundle; `client/dist` is served with an SPA fallback
  (`try_files $uri $uri/ /index.html`) per `docs/deployment.md`.
- `admin.css` is code-split and fetched only when an admin route mounts, so storefront
  visitors never download it.
- Authorisation is enforced server-side by `attachUser + requireAuth + requireAdmin`, applied
  once to the admin router so a new endpoint cannot ship unprotected by omission. The React
  guard is convenience only.
