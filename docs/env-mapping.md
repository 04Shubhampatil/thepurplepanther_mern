# Environment Variable Mapping

**No secret values appear in this document, in `.env.example`, or anywhere in this repository.**
Only variable *names* and their classification were read from the Laravel `.env`. Every entry
below was traced to an actual usage site in `config/` and `app/`, not assumed.

## Classification key

| Tag | Meaning |
|---|---|
| **ACTIVE** | Used by running code; required in the new app |
| **OPTIONAL** | Used, but has a working default |
| **LEGACY** | Configured but no application code reads it — do not carry over |
| **DROP** | Laravel-specific; no Node equivalent |
| **SERVER-ONLY** | Must never reach the browser |
| **PUBLIC** | Safe to expose to React |

---

## 1. Application

| Laravel var | Node var | Class | Notes |
|---|---|---|---|
| `APP_NAME` | `APP_NAME` | ACTIVE · PUBLIC | Razorpay checkout title, catalog default brand |
| `APP_ENV` | `NODE_ENV` | ACTIVE | `production` in source `.env` |
| `APP_KEY` | — | DROP | Laravel encrypter; replaced by `JWT_SECRET` / `SESSION_SECRET` |
| `APP_DEBUG` | — | DROP | Use `NODE_ENV` + `LOG_LEVEL` |
| `APP_URL` | `APP_URL` | ACTIVE · PUBLIC | ⚠️ see below |
| `ASSET_URL` | `MEDIA_BASE_URL` | ACTIVE · PUBLIC | Base for `/storage/...` media |
| `APP_TIMEZONE` | `TZ` | ACTIVE | `Asia/Kolkata` — affects `ordered_at`, coupon windows, delivery dates |
| — | `PORT` | new | Express port |
| — | `FRONTEND_URL` | new | CORS origin + links in emails |

> ⚠️ **`APP_URL` defect.** The audited `.env` has `APP_URL=http://127.0.0.1:8000` while
> `APP_ENV=production`. Since all media URLs are built with `asset()`, deploying with that value
> yields broken absolute image URLs. In Node, `MEDIA_BASE_URL` must be set explicitly per
> environment and is validated at boot (`server/src/config/env.js`) rather than silently
> defaulting.

## 2. Database

| Laravel | Node | Class |
|---|---|---|
| `DB_CONNECTION` | — | DROP (Prisma provider is `mysql` in schema) |
| `DB_HOST` `DB_PORT` `DB_DATABASE` `DB_USERNAME` `DB_PASSWORD` | `DATABASE_URL` | **ACTIVE · SERVER-ONLY** |

Prisma takes one connection string:
`mysql://USER:PASSWORD@HOST:3306/DATABASE`.
Values: host `localhost`, port `3306`, database `u375273201_purple_panthdb`.
**Credentials are not reproduced here.**

Add `DATABASE_URL_DEV` for the local restored copy used in phases 1–13.

## 3. Auth & session

Laravel used file-based sessions. Node replaces this with HTTP-only cookies.

| Laravel | Node | Class | Notes |
|---|---|---|---|
| `SESSION_DRIVER` `SESSION_LIFETIME` `SESSION_PATH` | — | DROP | |
| `SESSION_DOMAIN` | `COOKIE_DOMAIN` | ACTIVE | |
| `SESSION_SECURE_COOKIE` | `COOKIE_SECURE` | ACTIVE | |
| `SESSION_SAME_SITE` | `COOKIE_SAME_SITE` | ACTIVE | |
| — | `JWT_SECRET` | **new · SERVER-ONLY** | ≥32 random bytes |
| — | `SESSION_SECRET` | **new · SERVER-ONLY** | signs the guest-cart cookie |
| — | `JWT_EXPIRES_IN` | new · OPTIONAL | default `7d` |

**Guest cart.** Laravel kept the guest cart and applied coupon code in the PHP session. Node
keeps a signed, HTTP-only `pp_guest` cookie holding a cart id, with lines stored server-side.
The applied coupon code lives alongside it. This preserves the "coupon is session state,
re-validated every read" rule from the audit.

## 4. Payments

| Var | Class | Notes |
|---|---|---|
| `RAZORPAY_KEY_ID` | ACTIVE · **PUBLIC** | Sent to the browser to open Razorpay checkout |
| `RAZORPAY_KEY_SECRET` | ACTIVE · **SERVER-ONLY** | Basic-auth + HMAC signature verification |
| `RAZORPAY_CURRENCY` | ACTIVE · OPTIONAL | `INR` |

`KEY_ID` is the only payment value React may receive, and it is delivered by
`GET /api/v1/checkout` — never bundled into the client at build time.

## 5. Mail

| Var | Class |
|---|---|
| `MAIL_MAILER` `MAIL_HOST` `MAIL_PORT` `MAIL_ENCRYPTION` | ACTIVE |
| `MAIL_USERNAME` | ACTIVE · SERVER-ONLY |
| `MAIL_PASSWORD` | ACTIVE · **SERVER-ONLY** (Gmail app password) |
| `MAIL_FROM_ADDRESS` `MAIL_FROM_NAME` | ACTIVE |
| `MAIL_ADMIN_ADDRESS` | ACTIVE — order-notification recipient; falls back to `MAIL_FROM_ADDRESS` |

Transport: `smtp.gmail.com:587`, TLS. Nodemailer config mirrors this exactly.

## 6. Meta

| Var | Class | Notes |
|---|---|---|
| `META_CAPI_ENABLED` | ACTIVE | `true` in production |
| `META_CAPI_DATASET_ID` | ACTIVE · SERVER-ONLY | |
| `META_CAPI_ACCESS_TOKEN` | ACTIVE · **SERVER-ONLY** | |
| `META_CAPI_API_VERSION` | OPTIONAL | `v26.0` |
| `META_CAPI_TEST_EVENT_CODE` | OPTIONAL | unset in prod |
| `META_CAPI_TIMEOUT` | OPTIONAL | default `4` seconds |
| `META_CATALOG_FEED_TOKEN` | **REQUIRED FOR MIGRATION** · SERVER-ONLY | **absent from source `.env`** — audit R1 |
| `META_CATALOG_CURRENCY` | OPTIONAL | default `INR` |
| `META_CATALOG_DEFAULT_BRAND` | OPTIONAL | defaults to `APP_NAME` |

The three `META_CATALOG_*` vars are read by `config/services.php` but none are set in the source
`.env`, so the feed defaults to *no token* and is publicly readable. In Node,
`META_CATALOG_FEED_TOKEN` is **mandatory** and boot fails without it.

## 7. Storage

| Var | Class | Notes |
|---|---|---|
| `FILESYSTEM_DISK` | ACTIVE | `public` → **local disk**, not S3 |
| `AWS_ACCESS_KEY_ID` `AWS_SECRET_ACCESS_KEY` `AWS_DEFAULT_REGION` `AWS_BUCKET` `AWS_USE_PATH_STYLE_ENDPOINT` | **LEGACY** | Disk defined, never selected. Do not carry over. |
| — | `STORAGE_ROOT` | new | Absolute path to the existing `public/storage` tree |
| — | `MEDIA_BASE_URL` | new · PUBLIC | Public URL prefix for that tree |

Uploads keep writing to the same directories so existing rows keep resolving:
`banners/ blog-posts/ brands/ categories/ coupons/ offers/ products/ users/`.
S3 is **not** implemented in phase 1. If it is ever adopted, it is a separate project with a
media-URL backfill, not part of this migration.

## 8. Logging

| Laravel | Node | Class |
|---|---|---|
| `LOG_CHANNEL` `LOG_DEPRECATIONS_CHANNEL` | — | DROP |
| `LOG_LEVEL` | `LOG_LEVEL` | ACTIVE — pino |

## 9. Legacy — do not carry over

No application code references any of these (verified by grep across `app/`):

`BROADCAST_DRIVER`, `PUSHER_APP_ID`, `PUSHER_APP_KEY`, `PUSHER_APP_SECRET`,
`PUSHER_APP_CLUSTER`, `PUSHER_HOST`, `PUSHER_PORT`, `PUSHER_SCHEME`,
`VITE_PUSHER_APP_KEY`, `VITE_PUSHER_APP_CLUSTER`, `VITE_PUSHER_HOST`, `VITE_PUSHER_PORT`,
`VITE_PUSHER_SCHEME`, `REDIS_HOST`, `REDIS_PASSWORD`, `REDIS_PORT`, `MEMCACHED_HOST`,
`CACHE_DRIVER` (file), `QUEUE_CONNECTION` (sync).

`routes/channels.php` defines one default broadcast channel that no client subscribes to.

---

## 10. Values React is allowed to receive

Everything else is server-only. React gets these **from API responses**, not from build-time
env, so a rebuild is not needed to rotate them:

| Value | Delivered by |
|---|---|
| `APP_NAME` | `GET /api/v1/config` |
| `MEDIA_BASE_URL` | `GET /api/v1/config` |
| `RAZORPAY_KEY_ID` | `GET /api/v1/checkout` |

The only build-time variable in `client/.env` is `VITE_API_BASE_URL`.

**Never exposed to the browser:** `DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET`,
`RAZORPAY_KEY_SECRET`, `MAIL_PASSWORD`, `MAIL_USERNAME`, `META_CAPI_ACCESS_TOKEN`,
`META_CAPI_DATASET_ID`, `META_CATALOG_FEED_TOKEN`, any `AWS_*`.

---

## 11. Credential rotation — required before cutover

The audited archive **contains a populated `.env`**. Every secret in it must be treated as
exposed and rotated before the new app goes live:

- [ ] MySQL password for `u375273201_purple_panthdb`
- [ ] `RAZORPAY_KEY_SECRET` (regenerate in Razorpay dashboard)
- [ ] Gmail app password (`MAIL_PASSWORD`)
- [ ] `META_CAPI_ACCESS_TOKEN`
- [ ] AWS keys — or better, delete the IAM user, since S3 is unused
- [ ] Generate a new `META_CATALOG_FEED_TOKEN` (never previously set)
- [ ] Generate fresh `JWT_SECRET` and `SESSION_SECRET`

`.gitignore` must exclude `.env`, `.env.*` (except `.env.example`), and
`*.sql` dumps before the first commit.
