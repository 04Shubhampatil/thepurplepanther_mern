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
| Categories | unchanged (existing `/admin/categories`) | ✅ image cards | pending |
| Sub-Categories | unchanged (existing `/admin/sub-categories`) | ✅ inline form + table | pending |
| Colors | unchanged | ✅ inline form + table, picker autofill | pending |
| Sizes | unchanged | ✅ inline form + table | pending |
| Offers | unchanged | ✅ card grid (shares Categories') | pending |
| Products (index) | unchanged | ✅ panel + filters + bulk + card grid | pending |
| Banners (index) | `BANNER_SECTIONS` labels corrected | ✅ panel + section chips + card grid | ✅ |
| Banners (create / edit) | per-slide metadata + video uploads restored | ✅ two form cards + media repeater | ✅ |
| News Types | snake_case keys now reach Prisma | ✅ inline form + table, inline edit | ✅ |
| Journal Posts (index) | news-type filter added | ✅ filter card + thumbnail table | ✅ |
| Journal Posts (create / edit) | second image column, comments_count, naive dates | ✅ 640px form grid + editor | ✅ |
| Coupons (index) | `latest()` ordering + 5-column search + `paginate(9)` | ✅ dark card grid | ✅ |
| Coupons (detail) | unchanged | ✅ hero + definition grid | ✅ |
| Home Sections | unchanged | ✅ two-product picker | pending |

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

Brands (hidden) · Products create/edit form (the 620-line `_form.blade.php`) · Product
reviews · Banner create/edit · Home Sections · News Types · Blog
Posts · Coupons · Orders (incl. status log, print) · Users · Contacts/Subscribers/Messages ·
Web Settings (CMS pages) · Shipping Settings · Profile · Change password · Admin auth
(login, forgot, reset).

### Temporary scaffolding

`AdminUI.jsx` ends with a clearly-marked compatibility shim exporting the previous panel's
primitive names (`AdminButton`, `AdminPage`, `AdminSection`, `EmptyRow`, `Pill`, `CONTROL`).
It exists so the build stays green while pages are rebuilt one at a time rather than all at
once under a red build. **It must be deleted with the last un-rebuilt page** (`Resource.jsx`).

---

### The admin API returns RAW rows

Worth stating once because it has now caused three separate bugs. The storefront's endpoints
run through presenters that resolve media URLs and compute derived values; the admin CRUD
factory returns Prisma rows untouched. So an admin screen sees Laravel's column names and
**none of its accessors**:

| Looks available | Actually | Handled by |
|---|---|---|
| `product.image` | column is `featuredImage` | `storageUrl` |
| `product.discountPercent` | accessor — prefers the OFFER's percent | `discountPercent()` |
| `banner.coverImage` | accessor — first image's path | read `images[0].image` |
| `bannerImage.isVideo` | accessor — file extension | `isVideoPath()` |
| `banner.sectionLabel` / `sectionPage` | accessors over `BannerSections` | the `sections` payload |

All of these fail SILENTLY — a placeholder image, a missing badge — so check the Prisma model
before wiring a new admin screen rather than assuming the storefront's presented shape.

### Banner form — three gaps closed in the backend

The form was the first admin screen whose Laravel controller did MORE than the ported API,
so this was a parity fix rather than a redesign:

1. **Per-slide metadata.** `BannerController` read `existing_titles[id]` … `existing_sort[id]`
   for slides that already exist and the POSITIONAL `image_titles[i]` … for slides being
   uploaded; `syncBannerImages` wrote neither. Editing a slide's overlay text silently did
   nothing. Both shapes are now validated (`jsonObject` / `jsonArray`) and applied, keeping
   Laravel's `array_key_exists` guard so a partial submit still leaves untouched slides alone.

2. **Video uploads.** Banners are the only module Laravel let past `mimes:…,mp4,webm,ogg,mov`
   at `max:51200`. The route shared the image-only 4 MB `upload`, so every video the form's
   own hint promises was rejected. `bannerUploader` accepts them at 50 MB, and
   `assertVideosAllowed()` reproduces the controller's closure restricting video to
   Home — Main Hero — in the SERVICE, because multer's `fileFilter` cannot see `section`
   reliably (a multipart field only reaches `req.body` if it precedes the files).

3. **`remove_images` never removed anything.** The validator split the value on commas, but
   `toFormData` sends `JSON.stringify([1, 2])`, and `"[1"` / `"2]"` are both `NaN`. It now
   parses JSON first and keeps the comma form as a fallback.

Verified in the browser against `admin.css`: card 980px/10px/18px/`0 2px 10px rgba(0,0,0,.04)`,
`.offer-form-row` `220px 1fr` at 16px with 14px padding on a #f0f0f0 rule, `.offer-label`
14px/600 #555, controls 42px with 11px/12px on #ddd, hints #e53935/12px,
`.banner-existing-item` `140px 1fr` at 14px on #eee/#fafafa, `.offer-form-actions` 18px.
No horizontal overflow, no console errors, and the three client-side messages fire with
banner-form.js's exact wording.

### The journal — four backend gaps and one editor decision

**`sort_order` and every other snake_case field never reached the database.** Zod hands back
the request's own field names (Laravel's columns, snake_case); Prisma's client uses the
camelCase names from schema.prisma, and nothing bridged them. Every resource behind the
shared CRUD factory was affected — `short_description`, `has_color`, `is_active`,
`news_type_id` — but only fields the rebuilt screens actually submit would have shown it, and
until now those were all single-word (`name`, `code`, `title`). `camelizeKeys` in
crud.service.js converts the KEYS only, and only those containing an underscore.

**Journal posts have two images.** `image` is the 448x448 card thumbnail and `banner_image`
the wide detail banner, stored in separate directories with separate size limits (4 MB and
5 MB). The factory understood one, and `persist()` stripped the slash out of
`blog-posts/banners`. Both now handle a nested directory and a map of column -> file, and
blog-posts is registered outside the resource loop because it also filters by news type.

**`comments_count` was not in the schema**, so the field on the form was silently discarded.

**Every journal date was a day late.** MySQL `timestamp` columns carry no zone; Laravel read
them in the app timezone and printed them straight back. Prisma reads the same column as UTC
and serialises it with a `Z`, so `new Date(...)` in an Asia/Kolkata browser added the offset a
second time — `2026-08-09 20:27` displayed as 10 Aug. utils/admin-date.js reads the wall-clock
parts out of the string without constructing a Date, and the validator appends the `Z` on the
way IN so a save writes back the digits the admin typed rather than walking them back 5h30m.

**The content editor is local, not CKEditor.** blog-posts/edit.blade.php pulls 4.22.1 off
cdn.ckeditor.com, and that build prints its own "This CKEditor 4.22.1 version is not secure"
banner into the editing area — visible in the reference screenshot. Re-adding an unpatched
third-party script to an app that has just had its whole vendor stack removed, running against
an authenticated admin session, is not a trade worth making for a toolbar. RichTextEditor.jsx
reproduces the toolbar and edits the same HTML in both directions, so existing post bodies
load and save unchanged. The clipboard group (Cut / Copy / Paste / Paste as text / Paste from
Word) is left out: browsers refuse those commands from a script, so in the Laravel panel they
only ever opened a "your browser doesn't allow" dialog — the keyboard shortcuts are unchanged.

**Two shared fixes fell out of this work.** `Button`'s base class carried `border-0`, which
is the same specificity as the `border` in the `light` and `danger` variants and is emitted
later, so every bordered button in the panel had been rendering flat. And `storageUrl()` now
recognises a `frontend/` path as bundled theme art rather than prefixing it with `/storage/`,
which is how `resolveMediaUrl` ordered its checks — the journal's seeded rows all point at
`frontend/images/blogs/blog-N.jpg`, so every thumbnail was broken.

### Toasts

public/js/toast.js and `.toast-container` in admin.css, driven the way layouts/app.blade.php
drove them: every write redirected and the layout turned the flash bag into a toast —
`Toast.success(session('success'))`, `Toast.error(session('error'))`,
`Toast.error($errors->first())`. The Laravel panel had no inline alert banners on these
screens at all, so the rebuilt pages no longer render one either.

The message shown is the SERVER's, never one the page invents. `unwrap()` in services/api.js
carries the envelope's `message` through on a non-enumerable `$message`, so a page writes
`toast.success(res.$message)` and the wording stays in one place. That mattered enough to
align the API's strings with the controllers' own: they are not uniform in the source —
Color, Size, Sub-category and Brand flash a bare "Status updated." on a toggle while the
others name the resource, journal posts say "Post status updated." and "Featured status
updated.", and every create/update/delete ends "successfully.".

Geometry is admin.css's: fixed 18px from the top and right at z-index 2000, cards
`min(380px, 100vw - 24px)` wide, 10px apart, white at 8px radius under
`0 10px 30px rgba(0,0,0,.15)` with a 4px left border carrying the tone (#43a047 success,
#e53935 error, #1e88e5 info). The enter animation needs the element to be in the DOM at
`opacity:0` for one frame before the transition can run, which is what toast.js's
`requestAnimationFrame` was for and why the component tracks a mount flag rather than
rendering the final state immediately. Auto-dismiss is 4s, with the 250ms removal timer
outlasting the 200ms fade so the card is gone before it leaves the DOM.

### Coupons

`.coupon-card` is NOT the `.category-card` the other grids share, and the differences are
deliberate: 280px minimum instead of 220, an 18px gutter instead of 16, a 150px floor, and a
gradient running LEFT to RIGHT (`90deg, rgba(0,0,0,.55), rgba(0,0,0,.2)`) rather than top to
bottom — so the text stays legible against the left edge while the art shows on the right.
Four controls per card too: this is the only grid with a View.

Three accessors move to utils/coupon.js, since the admin API returns raw rows.
`discountLabel` is the card's entire headline and its branch order IS the behaviour — BOGO
wins outright, free shipping only counts when there is no discount figure to show, and the
amount/percent split is on `discount_type` rather than on whichever column is filled. Amounts
print through Laravel's `rtrim(rtrim(number_format(...), '0'), '.')`, so 10.00 reads "10".

Three server fixes: the list ordered by `id` where CouponController wrote a bare `latest()`,
which reversed the coupons sharing a timestamp; it searched only `code` where the controller
searches five columns, so "10" could not find FLAT10; and it paginated 20 where the
controller paginates 9, the number that fills three rows of three.

## 4. Known issues / blockers

- **Visual QA is blocked on an admin credential.** One admin exists
  (`admin@purplpanther.com`); its password is not known here, and guessing at it or
  rewriting it against restored production data is not something to do unasked. Everything
  below `/admin` is behind `RequireAdmin`, so no admin screen has been seen rendered yet —
  only proven to build. A password, or permission to add a separate dev-only admin, unblocks
  it.
- Pages not yet rebuilt (Products, Orders, Contacts, Settings, and everything still served
  by `Resource.jsx`) carry the earlier generic-Tailwind styling and do **not** match the
  Blade design.
- Categories has no create/edit screen yet — the cards link to `/admin/categories/create`
  and `/:id/edit`, which currently fall through to the generic resource route.

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
