# Scripts

These live under `server/` rather than the repository root for one practical reason: Node
resolves `node_modules` by walking up from the **script's own directory**, so a script at
the repo root cannot import `@prisma/client` or `dotenv` from `server/node_modules`.

Run them from `server/`:

```bash
npm run db:restore      # scripts/database/restore-dev.js
npm run verify:schema   # scripts/verification/verify-schema.js
npm run verify:data     # scripts/verification/verify-data.js
npm run verify          # both verifications
```

`restore-dev.js` refuses to run against a non-local host, the production database name, or
any database whose name does not end in `_dev` / `_test` / `_local`.
