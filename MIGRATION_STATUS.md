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
| Categories (index) | unchanged (existing `/admin/categories`) | ✅ image cards | pending |
| Categories (create / edit) | per-field clash message | ✅ 640px form grid + 3 switches | ✅ |
| Sub-Categories | unchanged (existing `/admin/sub-categories`) | ✅ inline form + table | pending |
| Colors | unchanged | ✅ inline form + table, picker autofill | pending |
| Sizes | unchanged | ✅ inline form + table | pending |
| Offers | unchanged | ✅ card grid (shares Categories') | pending |
| Products (index) | unchanged | ✅ panel + filters + bulk + card grid | ✅ |
| Products (create / edit) | colour galleries, highlight icons, upload.any() | ✅ 10 panels + 4 repeaters | ✅ |
| Products (reviews) | unchanged | ✅ inline form + table | ✅ |
| Offers (create / edit) | unchanged | ✅ 4 rows, suffix on the right | ✅ |
| Orders (detail) | `statusLabel` / `statusBadgeClass` on findOrder | ✅ summary + items + totals | ✅ |
| Page Settings | unchanged | ✅ tabbed CMS editor | ✅ |
| Shipping Settings | unchanged | ✅ two fields + note | ✅ |
| Brands | unchanged | ✅ inline form + table | ✅ |
| Orders (print) | unchanged | ✅ standalone document | ✅ |
| Banners (index) | `BANNER_SECTIONS` labels corrected | ✅ panel + section chips + card grid | ✅ |
| Banners (create / edit) | per-slide metadata + video uploads restored | ✅ two form cards + media repeater | ✅ |
| News Types | snake_case keys now reach Prisma | ✅ inline form + table, inline edit | ✅ |
| Journal Posts (index) | news-type filter added | ✅ filter card + thumbnail table | ✅ |
| Journal Posts (create / edit) | second image column, comments_count, naive dates | ✅ 640px form grid + editor | ✅ |
| Coupons (index) | `latest()` ordering + 5-column search + `paginate(9)` | ✅ dark card grid | ✅ |
| Coupons (detail) | unchanged | ✅ hero + definition grid | ✅ |
| Coupons (create / edit) | offer-type enum, derived discount_type, conditional nulling, form-data | ✅ 20 rows + 5 conditionals | ✅ |
| Users (index) | customer-only filter, sorting, platform + avatar | ✅ panel + bulk + sortable table | ✅ |
| Users (detail) | new `/users/:id/detail`, one tab per request | ✅ banner + 5 tabs | ✅ |
| Users (create / edit) | avatar upload, platform, role pinned to customer | ✅ 6 rows + preview | ✅ |
| Orders (index) | sorting, date filter, statusBadgeClass, pending label | ✅ filters + bulk + sortable table | ✅ |
| Orders (status modal) | unchanged | ✅ delivery date + timeline + form | ✅ |
| Contacts | per-tab search / sort / per-page | ✅ two tabs, two tables | ✅ |
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

### The coupon form — four server gaps

**`offer_type` was an enum of two.** The schema allowed only `coupon` and `bogo` — the values
the discount engine branches on — while the form's dropdown offers all thirteen of
`Coupon::OFFER_TYPES`. Picking "Seasonal / festival sale" was rejected at the door. The list
now lives in constants/coupons.js and fills both the validator and the form.

**`discount_type` was accepted from the client.** It is not a form field:
`CouponController::validated` derives it as `$percent !== null ? 'percent' : 'amount'`. Taking
it from the request let it disagree with the figure actually stored, which decides how the
storefront prices the coupon. It is derived in `couponScalars` now.

**The conditional nulling was missing, and it is the substance of that method.** A field the
form HID must be stored as null, not as whatever the browser last held, or a coupon keeps
applying a rule its own edit screen no longer shows: BOGO clears both discount figures and
the cap, the cap survives only alongside a percentage, the cart minimum only with its status
on, and each id list only for the `applies_to` that uses it.

**Four of the controller's guards had no equivalent** — both-figures-at-once, the cap required
with a percentage, the cart minimum required with its status, and at least one
category/product for a scoped coupon — plus the create-time image requirement, which is a
file and so cannot live in the schema.

`starts_at` / `ends_at` get the same wall-clock treatment as the journal's `published_at`:
`datetime-local` sends digits with no zone, and reading them as local would walk the stored
value back by the server's offset on every save.

The five conditional rows from public/js/coupon-form.js are reproduced by NOT RENDERING the
hidden rows rather than by `display:none`, so a hidden field cannot be submitted — which is
what made the nulling above necessary in the first place.

Two seeded-data notes, both faithful rather than broken: `storage/coupons/seed-placeholder.jpg`
is a 334-byte stub with no decodable image data, so the cards paint flat #333 and the form's
preview shows its alt text — Laravel does the same, since `Storage::exists` is true and the
browser simply cannot decode the file.

### Users, Orders and Contacts — one shared table kit, and a label that was lying

These three screens use `.admin-table`, NOT the `.table` the master-data screens use: 10px/12px
cells at 13px on a #f0f0f0 rule, with a #fafafa head in 700 weight #666. Both exist in the
source and they are not interchangeable, so components/admin/AdminTable.jsx carries the second
set — plus `SortTh`, the 32px `.action-sq` squares, the per-page select, Select All and the
bulk Action menu.

`SortTh` is worth reading before changing: clicking an INACTIVE column starts it ascending,
and only a second click on the already-active column flips it. That is `sort-link.blade.php`'s
`$nextDir`, and it is not a plain toggle.

**A pending order was being labelled "Placed".** `OrderStatuses::label` misses the map for
`pending` and falls through to `ucfirst`, so Laravel showed PENDING; the port normalised first
and showed PLACED — a different claim, that payment has gone through. Only TRANSITIONS fold
pending into placed (`nextOptions`, `canTransition`); the label and the badge class both key
off the RAW status, which is why a pending and a placed order share the grey pill while their
labels differ. `statusBadgeClass` is now ported too, so the pills are the source's five
colours rather than an approximation.

**Sorting and filtering are server-side everywhere here**, because every one of these tables
is paginated: ordering the ten rows on screen would order the wrong ten, and the order Date
filter has to run against the whole set to find that day's orders at all. The date arrives as
"DD-MM-YYYY" and is matched as a half-open range on the day — `ordered_at` is a timestamp and
no order lands exactly on midnight — read as a wall clock for the same reason the journal's
dates are.

**Users are customers only.** `UserController` opens with `where('role', 'customer')` and
every method calls `ensureCustomer`, which 404s anything else. The list now filters on the
server rather than accepting `?role=`, and the detail endpoint refuses a non-customer — without
it the admin's own account rendered as a customer page with an empty wishlist and cart.

The user detail fetches ONE tab per request, as UserController queried one: a customer with
hundreds of orders should not pay for their wishlist, cart and reviews to render a page that
shows none of them.

The status modal's hint is three fixed strings from order-admin.js, not a list built from the
options — a packed or shipped order shows no hint at all — and Save is disabled outright once
an order reaches a terminal status.

### The user form — a role hole and two dropped fields

**The create endpoint took `role` from the request.** `UserController::store` hard-codes
`role = customer`, `login_provider = email` and `is_active = true`; the port passed
`data.role ?? CUSTOMER` through, so a POST to `/admin/users` carrying `role: "admin"` would
have minted an administrator from the customer form. Now pinned, with a test.

**`platform` and `avatar` never reached the database.** Neither was in the schema and the
routes had no upload middleware, so the Platform select and the image picker were decoration.
`platform` defaults to 'Web' on write, as the controller defaulted it — the list column
already fell back to "Web" for a null, so the two now agree instead of only looking like they
do. The avatar is written before the old file is removed, never the other way round.

**`ensureCustomer` now guards update as well**, so the customer form cannot be pointed at an
administrator's row.

The password field is the only thing that differs between the two modes: required on create,
and on edit omitted from the payload entirely when left blank. It is never PREFILLED — the API
returns no hash, and a placeholder would be saved back as a literal password the moment the
admin submitted without touching it. Verified against the database: the stored bcrypt hash is
byte-identical after a save with the field left blank.

### The category form

No `_form` partial here — create.blade.php and edit.blade.php are written out separately and
differ in four small ways that would be easy to lose in a merge: the Title placeholder and the
second image note appear only on CREATE, the current image only on EDIT, and the submit reads
Save then Update. All four are reproduced rather than harmonised.

It uses `.form-grid` (14px gap, 640px cap), the journal post form's shape — NOT the 220px
label column the offer, coupon and user forms use. Four of the admin's forms use one and three
use the other; there is no house style to converge on.

The three switches are a group under their own heading because they decide what the PRODUCT
form offers for that category: turning Colour off hides the colour variants there, not just on
the storefront.

One server fix: the CRUD factory generated its own uniqueness message
("This category title is already in use.") where CategoryController flashes "This category name
already exists. Duplicate name not allowed." Since the admin's toast shows whatever the
response carries, the factory now takes per-field messages and categories supplies that one.

This form is also the first to exercise the `camelizeKeys` fix end to end — `sort_order`,
`has_color`, `has_size`, `show_on_home` and `short_description` are all snake_case, and before
that fix none of them reached Prisma at all.

### The product form — the largest one, and two uploads that were being dropped

Ten `.product-form-card` panels and four repeaters. Five behaviours are load-bearing rather
than cosmetic, and each is verified:

  - **Sub-Category follows Category**, and a sub-category belonging to a different one is
    CLEARED. Leaving it would show a value the option list no longer offers and save the
    stale id.
  - **The Accessory Package card is gated on the category's SLUG**, not its name, and its
    fields on a second switch inside it. Both gates matter — the packages replace the normal
    Selling Price on the storefront.
  - **A colour's gallery slot appears only once that colour is ticked.** Images filed under a
    colour swap in when the customer picks it; images with a NULL `color_id` are the shared
    gallery, and that null is the entire distinction.
  - **`products.title` is UNIQUE**, so it is probed against the server on a debounce and again
    before submitting, with `ignore_id` so a product keeps its own title.
  - **Colour and size quantities are per-variant STOCK.** They are sent for every ticked
    variant because `syncPivot` reads them, and that function's own comment explains why:
    a delete-all-and-recreate pass would zero live inventory on every save.

**Two uploads were silently dropped.** `color_gallery[<colorId>][]` and
`highlights[<i>][icon]` have names that only exist at runtime, and multer's `fields()` rejects
any name it was not told about. The product routes now use `any()` and the controller groups
`req.files` back into the map the services expect. A highlight row that gets no new file keeps
its `existing_icon`, which the client sends back inside the JSON row — without it, editing any
other field would strip every icon.

`icon` is stored as `null` rather than `''` for a row that has never had one: `||` not `??`,
because the client sends an empty string and storing that is drift for no reason.

Verified with a save round-trip on a real product: all five size quantities survived at 2, the
six gallery images, featured image, prices and all four display flags unchanged, and the four
highlight rows kept their titles and subtitles. The JSON columns come back as STRINGS from the
admin API, so the form parses both shapes — a product's highlights would otherwise reset to one
empty row the first time it was edited.

### The product form was unreachable, and three links went nowhere

**The Products index carried its own inline editor.** Add New, View and Edit all opened a
form built into index.jsx, so the full ProductForm page existed but nothing in the UI ever
navigated to it — which is exactly what "still doesn't show the updated UI" meant. The index
now links to create/edit as index.blade.php does, and the 260-line inline form is gone.

**Three routes were missing** while the sidebar and list pages linked to them:
`/admin/contacts` (the Contact List fell through to the generic resource page),
`/admin/settings/pages` and `/admin/settings/shipping`. Both settings paths land on the same
page, which is how layouts/app.blade.php linked them.

`.status-text` on the order detail is NOT the `.status-badge` pill the list uses. It shares
the `badge-*` class names but renders as bold coloured TEXT with no background, and `placed`
is #ef6c00 there where the pill is grey — same classes, different component.

The per-item Update control on the order detail updates the ORDER: `order_items.status`
follows the order and is not editable per line, which is why both controls open the same modal.

The offer form's discount box is the coupon form's mirror image — `.discount-suffix` puts the
% on the RIGHT over a left border, where `.discount-prefix` puts the symbol on the left.

### Settings, and what is deliberately NOT rebuilt

Page Settings and Shipping Settings are two separate screens in Laravel and the sidebar links
to each; the port had merged them into one page with no route of its own. They are split
again, and bare `/admin/settings` redirects to the pages one.

`.page-settings-tab.active` marks the active tab with a TOP border and a white ground — not
the bottom underline the Contact List and User Detail tabs use. Three tab strips in this
panel, three different treatments, all reproduced as they are.

The page URL field is read-only and greyed because it is where the page ALREADY lives; the
value is `getPublicUrlAttribute` (`url('/page/'.$slug)`), an accessor, so it is built on the
client. The two shipping numbers drive live pricing: the threshold is compared against the
product subtotal at checkout, so a stray 0 ships every order free.

**Brands IS rebuilt** — an earlier note here argued it was not worth doing because
`layouts/app.blade.php` hides it behind `$showBrands = false`. That was wrong: hidden from the
NAV is not the same as unused, and the screen is reached by URL and in use. Resource.jsx and
its four aliases in AdminUI.jsx stay on as the `/admin/:resource` fallback for anything that
has no page of its own.

Every admin route was walked afterwards: 18 list screens render with zero failed requests.

### Brands, and the print view

Brands is the `.inline-form` + table pair again, but two details separate it from the News
Types screen it otherwise mirrors: the table is `.table` (14px cells on #eee) rather than
`.admin-table` (13px on #f0f0f0), and the row actions are `.btn-edit` (blue) and `.btn-danger`
(white with a pink border) rather than two `.btn-light`s. The sidebar still hides the entry —
`SHOW_BRANDS = false` reproduces `$showBrands = false`, and the live panel hides it too.

The print view is a STANDALONE document in Laravel: its own `<html>`, its own `<style>`, no
admin chrome. So `orders/:id/print` is the one admin route inside the guard but OUTSIDE
AdminLayout. `useAdminStylesheets` still runs so the storefront theme cannot bleed in, and
every rule is applied inline from the Blade's own stylesheet rather than the panel's tokens.

`onload="window.print()"` is reproduced, but fires only once the order has arrived — Blade had
its data before the document existed, and printing an empty page would be faithful to the
letter and useless. A ref guards it so a re-render cannot reopen the dialog.

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
