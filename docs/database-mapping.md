# Database Mapping — MySQL → Prisma

**The database does not change.** MySQL stays; table names, column names, types, and ids are
preserved exactly. Prisma is introduced as a client over the *existing* schema using `@@map`
and `@map`, so the Laravel app and the Node app can read and write the same rows during the
parallel-run period.

**Authoritative source:** `u375273201_purple_panthdb 1.sql` (production export, 35 tables).
`database/schema.sql` and `database/hostinger.sql` are stale — see audit §1.

---

## 1. Conventions

| MySQL | Prisma |
|---|---|
| `bigint(20) UNSIGNED` PK | `BigInt @id @default(autoincrement())` |
| `varchar(n)` | `String @db.VarChar(n)` |
| `text` / `longtext` | `String? @db.Text` / `@db.LongText` |
| `decimal(10,2)` / `decimal(12,2)` | `Decimal @db.Decimal(10,2)` / `(12,2)` |
| `tinyint(1)` | `Boolean` |
| `int(10) UNSIGNED` | `Int` |
| `timestamp NULL` | `DateTime? @db.Timestamp(0)` |
| `date` | `DateTime? @db.Date` |
| `enum(...)` | Prisma `enum` |
| `longtext ... CHECK (json_valid(...))` | `Json?` |
| snake_case table/column | `@@map` / `@map` to PascalCase model, camelCase field |

**BigInt caution.** Prisma maps MySQL `BIGINT` to JavaScript `BigInt`, which `JSON.stringify`
cannot serialise. The API layer must convert ids to `Number` or `String` before responding.
A global `BigInt.prototype.toJSON` shim is set in `server/src/utils/json.js`.

**Decimal caution.** Prisma returns `Decimal` objects, not numbers. All money maths in the
services must go through `server/src/utils/money.js` so rounding matches Laravel's
`round($x, 2)` and formatting matches `₹ 1,234.56` exactly.

---

## 2. Table → model map (35 tables)

### Application tables (31)

| MySQL table | Prisma model | Laravel model | Rows (AI at export) |
|---|---|---|---|
| `users` | `User` | `User` | 9 |
| `user_addresses` | `UserAddress` | `UserAddress` | 7 |
| `user_bank_accounts` | `UserBankAccount` | `UserBankAccount` | 0 |
| `categories` | `Category` | `Category` | 9 |
| `sub_categories` | `SubCategory` | `SubCategory` | 15 |
| `brands` | `Brand` | `Brand` | 3 |
| `colors` | `Color` | `Color` | 24 |
| `sizes` | `Size` | `Size` | 14 |
| `offers` | `Offer` | `Offer` | 4 |
| `products` | `Product` | `Product` | 66 |
| `product_color` | `ProductColor` | pivot (`belongsToMany`) | 99 |
| `product_size` | `ProductSize` | pivot (`belongsToMany`) | 175 |
| `product_images` | `ProductImage` | `ProductImage` | 289 |
| `product_reviews` | `ProductReview` | `ProductReview` | 4 |
| `banners` | `Banner` | `Banner` | 11 |
| `banner_images` | `BannerImage` | `BannerImage` | 28 |
| `home_section_products` | `HomeSectionProduct` | `HomeSectionProduct` | 9 |
| `cart_items` | `CartItem` | `CartItem` | 43 |
| `wishlists` | `Wishlist` | `Wishlist` | 7 |
| `orders` | `Order` | `Order` | 22 |
| `order_items` | `OrderItem` | `OrderItem` | 29 |
| `order_status_logs` | `OrderStatusLog` | `OrderStatusLog` | 35 |
| `coupons` | `Coupon` | `Coupon` | 5 |
| `coupon_redemptions` | `CouponRedemption` | `CouponRedemption` | 1 |
| `contact_messages` | `ContactMessage` | `ContactMessage` | 0 |
| `subscribers` | `Subscriber` | `Subscriber` | 5 |
| `pages` | `Page` | `Page` | 4 |
| `news_types` | `NewsType` | `NewsType` | 6 |
| `blog_posts` | `BlogPost` | `BlogPost` | — |
| `shipping_settings` | `ShippingSetting` | `ShippingSetting` | 1 |
| `password_reset_attempts` | `PasswordResetAttempt` | `PasswordResetAttempt` | 5 |

"Rows" is the exported `AUTO_INCREMENT` minus 1 — an upper bound on row count, used as the
baseline for the verification scripts in `scripts/verification/`.

### Framework tables (4)

| Table | Decision |
|---|---|
| `migrations` | **Keep, do not touch.** Laravel's ledger; the rollback path needs it intact. |
| `password_reset_tokens` | **Keep and use.** Node reuses this table so reset links issued by either app work. PK is `email` (no `id` column). |
| `personal_access_tokens` | Keep (Sanctum). Unused by app code; do not read or write. |
| `failed_jobs` | Keep. Queue is `sync`; table is inert. |

---

## 3. Pivot tables — a deliberate modelling choice

`product_color` and `product_size` are Laravel `belongsToMany` pivots **with payload**
(`quantity`), and they carry a surrogate `id` plus a unique `(product_id, color_id)` /
`(product_id, size_id)`.

They are therefore modelled as **explicit Prisma models**, not implicit `@relation` many-to-many.
Prisma's implicit m-n requires a specific `_TableName` convention with no extra columns, which
this schema does not follow, and `quantity` is load-bearing — it is the per-variant stock used
by `CartService::maximumQuantity`. Getting this wrong silently breaks inventory limits.

---

## 4. Relationships

Mirrors the Eloquent graph:

```
User ──< UserAddress, UserBankAccount, Wishlist, CartItem, ProductReview, Order, CouponRedemption
Category ──< SubCategory, Product
SubCategory ──< Product
Brand ──< Product
Offer ──< Product
Product ──< ProductImage, ProductReview, CartItem, OrderItem, Wishlist,
            ProductColor, ProductSize, HomeSectionProduct
Color ──< ProductColor, ProductImage
Size ──< ProductSize
Order ──< OrderItem, OrderStatusLog, CouponRedemption
Coupon ──< CouponRedemption, Order
Banner ──< BannerImage
NewsType ──< BlogPost
```

### Referential actions (must match the live DB exactly)

| Child → parent | onDelete |
|---|---|
| `cart_items.product_id` → products | Cascade |
| `cart_items.user_id` → users | Cascade |
| `coupon_redemptions.coupon_id` → coupons | Cascade |
| `coupon_redemptions.order_id` → orders | SetNull |
| `coupon_redemptions.user_id` → users | SetNull |
| `orders.coupon_id` → coupons | SetNull |
| `orders.user_id` → users | Cascade |
| `order_items.order_id` → orders | Cascade |
| `order_items.product_id` → products | **SetNull** (order history survives product deletion) |
| `order_status_logs.order_id` → orders | Cascade |
| `products.category_id` → categories | Cascade |
| `products.sub_category_id` → sub_categories | SetNull |
| `products.brand_id` → brands | SetNull |
| `products.offer_id` → offers | SetNull |
| `product_color.*`, `product_size.*` | Cascade both sides |
| `product_images.product_id` → products | Cascade |
| `product_images.color_id` → colors | SetNull |
| `product_reviews.product_id` → products | Cascade |
| `product_reviews.user_id` → users | SetNull |
| `sub_categories.category_id` → categories | Cascade |
| `user_addresses.user_id`, `user_bank_accounts.user_id` | Cascade |
| `wishlists.product_id`, `wishlists.user_id` | Cascade |

### Relations with NO database-level foreign key ⚠️

These exist in Eloquent but have **no FK constraint** in MySQL:

| Relation | Also missing index? |
|---|---|
| `blog_posts.news_type_id` → `news_types.id` | yes — no index either |
| `banner_images.banner_id` → `banners.id` | **yes — no index either** |
| `home_section_products.product_id` → `products.id` | no (index exists) |

Consequences, and how the migration handles them:
1. Orphans are possible. `scripts/verification/check-orphans.js` must test all three.
2. Prisma relations are still declared (so `include` works), but the schema is introspection-
   faithful: adding the FKs would be a **schema change**, which is out of scope for phase 1.
   They are logged in `docs/migration-status.md` as a proposed post-cutover improvement.
3. `banner_images.banner_id` lacking an index means the homepage banner query does a full scan.
   Small table (28 rows) so it is not urgent, but it is the one index worth adding later.

---

## 5. Uniques and indexes to preserve

| Table | Unique |
|---|---|
| `users` | `email`, `username` |
| `categories` | `slug`, `title` |
| `sub_categories` | `slug`, `title` |
| `brands` | `slug`, `name` |
| `colors` | `name` |
| `sizes` | `name` |
| `offers` | `slug`, `title` |
| `products` | `slug`, **`title`** |
| `product_color` | `(product_id, color_id)` |
| `product_size` | `(product_id, size_id)` |
| `wishlists` | `(user_id, product_id)` |
| `coupons` | `code` |
| `orders` | `order_number` |
| `pages` | `slug` |
| `news_types` | `slug` |
| `subscribers` | `email` |
| `home_section_products` | `(section, position)` |

> `products.title` being unique is unusual and easy to miss — the admin product form has a
> `check-title` endpoint precisely because of it. Preserve both the constraint and the endpoint.

Non-unique indexes worth keeping in the Prisma schema (they document query shape):
`orders(user_id, ordered_at)`, `orders(status)`, `cart_items(user_id)`,
`password_reset_attempts(email)`, `personal_access_tokens(tokenable_type, tokenable_id)`.

---

## 6. Enums

| Column | Values | Prisma |
|---|---|---|
| `users.role` | `admin`, `customer` | `enum UserRole` |
| `coupons.discount_type` | `percent`, `amount` | `enum DiscountType` |

**String columns that behave like enums** (kept as `String` to avoid a schema change, with
constants in `server/src/constants/`):

| Column | Observed values |
|---|---|
| `orders.status` | `pending`, `placed`, `packed`, `shipped`, `delivered`, `cancelled` |
| `order_items.status` | same set |
| `order_status_logs.status` | same set |
| `orders.payment_status` | `pending`, `paid` |
| `orders.payment_mode` | `razorpay` |
| `coupons.offer_type` | `coupon`, `bogo` |
| `coupons.applies_to` | `all`, `products`, `categories` |
| `users.login_provider` | `email`, `google` |
| `home_section_products.section` | `shop_the_look`, … |
| `banners.section` | see `App\Support\BannerSections` |

Note `orders.status` carries **both** `pending` (pre-payment) and `placed`. `OrderStatuses`
treats legacy `pending` as `placed` when computing next options. Do not collapse them in data.

---

## 7. JSON columns

Stored as `longtext` with a `json_valid()` CHECK, cast to array by Eloquent → Prisma `Json?`.

| Table.column | Shape |
|---|---|
| `products.highlights_items` | `[{ icon, title, text }]` |
| `products.information_items` | `[{ title, content }]` |
| `products.specifications` | `[{ label, value }]` |
| `products.accessory_packages` | `[{ key, label, mrp, price }]` — **price-bearing, server-authoritative** |
| `coupons.category_ids` | `[int]` |
| `coupons.product_ids` | `[int]` |

MariaDB stores these as text. Prisma `Json` on MySQL expects a native `JSON` column type; because
these are `longtext`, the schema declares them as `Json? @db.LongText` — verify round-tripping in
the phase-1 smoke test before relying on it. If Prisma rejects the mapping, fall back to
`String? @db.LongText` with explicit `JSON.parse`/`stringify` in the service layer.

---

## 8. Safety rules

1. **Never** run `prisma migrate dev`, `prisma migrate reset`, or `prisma db push` against
   production. `prisma.config.ts` and `package.json` must not contain a script that can.
2. Phase 1 uses `prisma db pull` (introspection) against a **restored copy** of the dump in a
   local `purple_panther_dev` database, then hand-corrections for the relations in §4.
3. The generated schema is diffed against §2–§7 of this document before use.
4. Any future schema change ships as an explicit, reviewed SQL script under
   `scripts/database/`, applied to staging first.
5. Ids are never renumbered. `AUTO_INCREMENT` values carry over from the dump.
