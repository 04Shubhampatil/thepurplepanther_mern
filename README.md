# The Purple Panther

Migration of the Laravel 10 storefront to **React + Node.js + Express + Prisma + MySQL**.

The database does not change. Prisma maps the existing schema exactly, so this application
and the Laravel one can read and write the same rows — which is what makes the cutover
reversible.

```
React (Vite)  →  Express REST API  →  Prisma  →  the existing MySQL database
```

---

## Status

| Layer | State |
|---|---|
| Backend | Feature-complete — 13 phases, 480 tests passing |
| Frontend | Storefront + admin panel, 15 tests passing, builds clean |
| Database | Schema hand-written from the production dump; **not yet verified against a live server** |

Per-feature detail: [`docs/migration-status.md`](docs/migration-status.md).

> **One step remains before this can run.** `server/.env` needs a working `DATABASE_URL`.
> Until then the API exits at boot with `Could not connect to the database` — deliberately,
> so a misconfigured deploy fails immediately rather than on a customer's first request.

---

## Quick start

```bash
# 1. Fill in server/.env  (copy from server/.env.example)
#    At minimum: DATABASE_URL, DATABASE_URL_DEV, JWT_SECRET, SESSION_SECRET,
#    META_CATALOG_FEED_TOKEN

# 2. Restore a local copy of the production dump
cd server && npm run db:restore

# 3. Verify schema and data
node ../scripts/verification/verify-schema.js
node ../scripts/verification/verify-data.js

# 4. Run — from the REPOSITORY ROOT
npm run setup                     # installs client + server, generates Prisma client
npm run dev                       # API :5000 and Vite :5173 together, with hot reload
```

Health check: `GET http://localhost:5000/api/v1/health`

### One process, one origin

The app deploys as a SINGLE Node process: Express serves the built React bundle alongside
the API, so the site and its endpoints share an origin. That is not cosmetic — auth and the
guest cart ride on `SameSite=Lax` cookies, which are only first-party when the page and the
API agree on origin. Vite's dev proxy fakes the same arrangement on :5173.

```bash
npm run build     # vite build + prisma generate
npm start         # serves API + client from one port
npm run serve     # build, then start in production mode (one command)
```

`SERVE_CLIENT` decides whether this process serves the bundle. Empty means "by NODE_ENV":
on in production, off in development, where Vite owns the client and this process would
only ever hand back the last build. `CLIENT_DIST` overrides the build location
(default `client/dist`).

Everything else stays where it was — `client/` and `server/` keep their own
`package.json` and `node_modules`; the root package only orchestrates them.

| From the root | Does |
|---|---|
| `npm run dev` | Both dev servers, hot reload |
| `npm run build` | Build client + generate Prisma client |
| `npm start` | Start the single production process |
| `npm test` | Server suite, then client suite |
| `npm run clean` | Remove `client/dist` |

---

## Layout

```
server/
  prisma/schema.prisma      35 models mapped to the existing tables
  src/
    config/                 env (validated), logger (redacted), database (driver adapter)
    controllers/            thin: validate → service → response
    services/               ALL business logic lives here
    middleware/             auth, validation, guest cart, error handling
    validators/             Zod schemas — backend validation is authoritative
    integrations/           razorpay, email, meta
    constants/              order statuses, roles, CMS sections
    utils/                  money, media, json, password
  tests/                    480 tests

client/
  src/
    routes/                 URL table — preserves every Laravel URL
    pages/                  storefront + admin
    components/             layout, product, cart, common
    services/               API client and endpoint map
    store/                  Zustand — deliberately thin

docs/                       audit, mappings, API reference, deployment runbook
scripts/
  database/restore-dev.js   guarded local restore
  verification/             schema and data checks
```

---

## Principles this codebase holds to

**The server owns money.** Prices, discounts, shipping and totals are computed server-side
and returned pre-formatted. The client renders what it is given and never recalculates — so
what a customer sees cannot disagree with what checkout charges.

**Business logic lives in services.** Controllers validate and respond. Routes are a table
of contents.

**Validation is server-side.** Zod schemas are authoritative; client-side validation is a
convenience.

**Payment is verified, never asserted.** The browser hands back Razorpay's identifiers; the
server verifies the HMAC signature with a timing-safe comparison and decides.

**Authorisation is enforced at the API.** Route guards in React control what is *rendered*.
Every protected endpoint checks auth, role, and row ownership independently.

---

## Documentation

| Document | What it covers |
|---|---|
| [laravel-audit.md](docs/laravel-audit.md) | Source audit, 12 preserved business rules, risk register R1–R11 |
| [route-mapping.md](docs/route-mapping.md) | Every URL: Laravel → Express → React, plus 21 legacy redirects |
| [controller-mapping.md](docs/controller-mapping.md) | Controller → service → endpoint → page |
| [database-mapping.md](docs/database-mapping.md) | 35 tables → Prisma models, FK actions, JSON columns |
| [env-mapping.md](docs/env-mapping.md) | Every variable classified; rotation checklist |
| [integration-mapping.md](docs/integration-mapping.md) | Razorpay, Meta CAPI, catalog feed, mail, storage |
| [api.md](docs/api.md) | API reference |
| [deployment.md](docs/deployment.md) | Build, cutover and rollback runbook |
| [migration-status.md](docs/migration-status.md) | Live per-phase status |

---

## Things the audit found

Worth knowing before deploying, in full in [`laravel-audit.md`](docs/laravel-audit.md):

- **R1** — the Meta catalog feed is **currently unauthenticated in production**. The token
  check is skipped when the token is unset, and it is unset. Fixed here: the token is
  mandatory. Requires updating the feed URL in Meta Commerce Manager at cutover.
- **R2** — the source archive contains a populated `.env` with live credentials. Every one
  needs rotating.
- **R9** — Node's `bcrypt` silently returns `false` for Laravel's `$2y$` hashes. A direct
  port would have locked out every existing customer with a message indistinguishable from
  a wrong password. Fixed in `utils/password.js`; no customer needs a reset.
- **R11** — the `pages` CMS table is write-only. Admins edit four pages that no storefront
  view reads.

---

## Testing

```bash
cd server && npm test     # 480
cd client && npm test     # 15
```

Server tests currently mock Prisma, so they verify **business rules and query shapes**, not
SQL execution. Query correctness is confirmed by the verification scripts once a database
is available — see [`migration-status.md`](docs/migration-status.md).

---

## The Laravel application

Kept as the reference implementation and the rollback target. It is not modified, and it is
not deleted until the rollback window closes (brief §52).
