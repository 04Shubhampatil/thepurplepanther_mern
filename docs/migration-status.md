# Migration Status

Single source of truth for progress. **Nothing is marked COMPLETE until every box in the
completion criteria is genuinely ticked** — compiling is not completing.

Last updated: 2026-09-08 · Current phase: **1 → 2**

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
| 2 | Auth (customer + admin) | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED |
| 3 | Catalog | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED |
| 4 | CMS / home | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED |
| 5 | Cart | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED |
| 6 | Wishlist | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED |
| 7 | Promotions / coupons | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED |
| 8 | Account | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED |
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

## Open decisions

| # | Decision | Recommendation | Status |
|---|---|---|---|
| D1 | Guest cart transport | Signed HTTP-only cookie + server-side cart rows | proposed |
| D2 | Auth token transport | HTTP-only cookie holding a JWT (brief's preference) | proposed |
| D3 | Legacy 301s in proxy or React | Reverse proxy — real 301s for crawlers | proposed |
| D4 | `products.accessory_packages` JSON mapping | `Json? @db.LongText`, fallback to string + manual parse | verify in phase 1 |
| D5 | Password hash compatibility | Verify Node bcrypt accepts Laravel `$2y$` hashes | **verify in phase 2** |

**D5 is the highest-risk unknown.** Laravel writes `$2y$` bcrypt hashes. The `bcrypt` npm
package must verify them without a rewrite, or every existing customer is locked out. Phase 2
starts with a spike that tests a real hash from the dump against `bcrypt.compare`. If it fails,
the fallback is to normalise the `$2y$` prefix to `$2b$` at comparison time (the algorithms are
identical; only the prefix differs). **No user may be forced to reset a password.**

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
