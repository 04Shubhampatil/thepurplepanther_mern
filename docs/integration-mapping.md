# Integration Mapping

Every external contract the Laravel app depends on, with the exact behaviour Node must
reproduce. All details below were read from source, not inferred.

---

## 1. Razorpay

**Laravel:** `CheckoutService::createRazorpayOrder` / `verifyAndComplete`, `config/razorpay.php`.
Uses raw HTTP via `Http::withBasicAuth`, **not** the Razorpay SDK.

### Order creation

```
POST https://api.razorpay.com/v1/orders
Auth:  Basic (RAZORPAY_KEY_ID : RAZORPAY_KEY_SECRET)
Timeout: 30s
Body:
  amount          = round(payable_amount * 100)      # paise, integer
  currency        = RAZORPAY_CURRENCY (INR)
  receipt         = substr(order_number, 0, 40)
  payment_capture = 1
  notes           = { order_number, order_id }
```

Guards, in order:
1. Missing key **or** secret → `"Razorpay is not configured."`
2. `amountPaise < 100` → `"Order amount is too low for payment."`
3. HTTP 401 → a specific message naming `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
4. Any other failure → Razorpay's own `error.description`, suffixed `" Please try again."`

The returned `id` is stored on `orders.razorpay_order_id` **after** the DB transaction commits.

### Signature verification — reproduce exactly

```
expected = HMAC_SHA256( razorpay_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET )
valid    = timingSafeEqual(expected, razorpay_signature)
```

Node: `crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')`
compared with `crypto.timingSafeEqual` (matching PHP's `hash_equals`). Never `===`.

Additional rules:
- If `order.razorpay_order_id` is set and differs from the submitted one → `"Razorpay order mismatch."`
- **Idempotent:** if `payment_status === 'paid'`, return the order immediately — no re-recording
  of the coupon redemption, no cart clear, no duplicate email, no duplicate `Purchase` event.
- A signed-in user whose id ≠ `order.user_id` → **403**.

On success, in this order: set `payment_id`, `payment_status='paid'`, `status='placed'`,
`ordered_at ||= now` → write an `OrderStatusLog` ("Payment received", includes the payment id)
→ `recordRedemption` → clear coupon → clear cart → send emails.

> `recordRedemption` inserts a `coupon_redemptions` row **and** increments `coupons.used_count`.
> Both must stay inside the same transaction in Node to avoid a drifting counter.

### Node implementation notes
- `razorpay` npm package is in `package.json`; either it or plain `fetch` is fine, but signature
  verification stays hand-rolled so it is provably identical to the PHP.
- The secret never leaves the server. React receives only `key_id`, from `GET /api/v1/checkout`.
- **Webhooks are not used** by the Laravel app. Adding one is a genuine robustness improvement
  (it closes the "customer closes the tab after paying" gap) but it is **out of scope for
  parity** — logged in `migration-status.md` as a post-cutover proposal.

---

## 2. Meta Conversions API

**Laravel:** `MetaConversionsService`. Endpoint:
`https://graph.facebook.com/{api_version}/{dataset_id}/events`, bearer token, timeout 4s.

### Contract
```
{ "data": [ {
    "event_name":       <string>,
    "event_time":       <unix seconds>,
    "event_id":         <uuid, or "purchase_{order_number}" for Purchase>,
    "event_source_url": <referer if same-host, else full request URL>,
    "action_source":    "website",
    "user_data":        { ...hashed... },
    "custom_data":      { ...non-null, non-empty only... }
} ],
  "test_event_code": <only when configured> }
```

### The 9 events actually emitted

| Event | Trigger |
|---|---|
| `ViewContent` | product detail |
| `Search` | search page (`search_string`) |
| `AddToCart` | add to cart, buy now |
| `AddToWishlist` | wishlist add |
| `InitiateCheckout` | checkout page load |
| `AddPaymentInfo` | checkout place |
| `CompleteRegistration` | signup, and guest-checkout account creation |
| `Purchase` | payment verified, **only when not already paid** |
| `Subscribe` | newsletter subscribe |

`SUPPORTED_EVENTS` lists 13; `Contact`, `FindLocation`, `Schedule`, `StartTrial` have **no call
sites**. Do not add them.

### PII hashing — normalise, then SHA-256, then wrap in an array

| Field | Meta key | Normalisation |
|---|---|---|
| email | `em` | trim, lowercase |
| phone | `ph` | lowercase, strip all non-digits |
| first_name / last_name | `fn` / `ln` | trim, lowercase |
| gender | `ge` | trim, lowercase |
| date_of_birth | `db` | strip non-digits (`Ymd`) |
| city / state / zip | `ct` / `st` / `zp` | trim, lowercase |
| country | `country` | lowercase; `"india"` → `"in"` |
| external_id | `external_id` | user id, lowercased string |

Each becomes `[sha256(normalised)]` — **an array**, not a bare string. Empty values are omitted
entirely. Unhashed: `client_ip_address`, `client_user_agent`, `fbc`, `fbp`.

`_fbc` fallback: when the cookie is absent but `?fbclid=` is present, synthesise
`fb.1.{milliseconds}.{fbclid}`.

For a signed-in user the service auto-fills email, phone, names, DOB, and the default (else
latest) address's city/state/zip/country. Explicitly passed values take precedence
(PHP `+=` keeps existing keys).

### Failure policy — load-bearing
`track()` **never throws**. Non-2xx responses and exceptions are logged at `warn` and swallowed.
It also short-circuits when the event is unsupported or the integration is disabled, and still
returns an `event_id`. In Node this must be genuinely fire-and-forget: **never `await` it on the
checkout path**, and attach a `.catch()` so an unhandled rejection cannot crash the process.

Enabled only when `META_CAPI_ENABLED` **and** `dataset_id` **and** `access_token` are all set.

---

## 3. Meta Product Catalog Feed

**Laravel:** `MetaCatalogFeedController` (single `__invoke`), route
`GET /catalog/meta/products.csv`.

- Streams CSV (`text/csv; charset=UTF-8`, `inline; filename="meta-products.csv"`, `no-store`,
  `X-Content-Type-Options: nosniff`).
- **31 columns**, in a fixed order beginning `id,title,description,availability,condition,link,
  image_link,brand,price,…` — the header row must be byte-identical or Meta rejects the feed.
- Active products only, `orderBy('id')`, `chunkById(250)` — Node uses a keyset-paginated cursor
  loop with the same page size so memory stays flat.
- `price` is always the **MRP** when the product is on sale, with `sale_price` carrying the
  selling price; otherwise `price` is the current price and `sale_price` is empty. Format:
  `"1234.00 INR"`.
- `availability` = `in stock` / `out of stock` from `inventoryQuantity()`:
  - colours **and** sizes present → `min(Σ colour qty, Σ size qty)`
  - only one present → that sum
  - neither → `max(1, max_unit_buy || 99)`
- `shipping` = `"IN::Standard:{delivery_charge} INR"`.
- `description` = `short_description || features || title`, HTML-stripped, whitespace-collapsed,
  truncated to 9,999 chars.
- Columns 10–11 (`google_product_category`, `fb_product_category`) are intentionally empty;
  `product_tags[0]`/`[1]` carry category and sub-category titles.

### ⚠️ Security change (audit R1)
The token check is `if (configuredToken !== '' && !hash_equals(...)) abort(403)` — so an **unset**
token disables auth entirely, which is the current production state.
**In Node the token is mandatory:** boot fails without `META_CATALOG_FEED_TOKEN`, and a missing
or wrong `?token=` is always 403. Comparison uses `timingSafeEqual`.
This is the one deliberate behaviour change in the migration; it must be coordinated with
updating the feed URL in Meta Commerce Manager.

---

## 4. Email

**Laravel:** 5 mailables, `QUEUE_CONNECTION=sync` → all sent **inline**, wrapped in try/catch so
a mail failure never fails the order. Blade templates in `resources/views/emails/`.

| Mailable | To | Trigger |
|---|---|---|
| `OrderPlacedCustomerMail` | `shipping_email ?: user_email ?: user.email` | payment verified |
| `OrderPlacedAdminMail` | `MAIL_ADMIN_ADDRESS ?: MAIL_FROM_ADDRESS` | payment verified |
| `OrderStatusUpdatedMail` | customer | admin changes order status |
| `OrderDeliveryDateUpdatedMail` | customer | admin sets delivery date |
| `CustomerPasswordResetMail` | customer | forgot-password request |

`OrderPlacedCustomerMail` takes a second argument, `$guestPassword` — for guest checkout the
generated password is included in the confirmation email. **This is the only way a guest
customer learns their password**, so it cannot be dropped.

Node: Nodemailer over `smtp.gmail.com:587` STARTTLS. Templates are rebuilt from the Blade
sources preserving subject lines and dynamic content. Sending moves **off** the request path
(fire-and-forget with logging), which fixes the audit R8 latency issue without changing
recipients or content.

---

## 5. File storage

**Active disk is `public` → local**, root `public/storage`, URL `{APP_URL}/storage`.
S3 is configured but unreachable (audit §4). Existing directories:

```
public/storage/{banners, blog-posts, brands, categories, coupons, offers, products, users}
```

### URL resolution (`App\Support\Media::url`, duplicated in `Product::resolveMediaUrl`)
```
null / empty          → asset(fallback)
starts with http(s):// → return unchanged
starts with "frontend/" → asset(path)          # bundled theme assets
starts with "/"        → url(path)
otherwise              → asset("storage/" + path)
```

Node reproduces this in `server/src/utils/media.js` against `MEDIA_BASE_URL`. **Stored DB values
are not rewritten** — rows keep bare relative paths like `products/abc.jpg`, and resolution stays
a read-time concern. This keeps Laravel and Node rendering identical images during the parallel
run and makes rollback free.

Uploads (multer) must write to the same directories with the same naming so both apps continue
to resolve each other's files.

---

## 6. Integration risk summary

| Integration | Failure mode | Must not break |
|---|---|---|
| Razorpay create | throws → checkout returns 422 with message | order row already exists as `pending` — that is intended |
| Razorpay verify | signature mismatch → 422, order stays `pending` | never mark paid without a valid signature |
| Meta CAPI | logged and swallowed | must never block or fail checkout |
| Meta catalog | 403 on bad token | must not leak the catalogue |
| Email | logged and swallowed | must never fail the order |
| Storage | missing file → fallback image | must not 500 |
