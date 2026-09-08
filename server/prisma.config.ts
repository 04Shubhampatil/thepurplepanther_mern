import 'dotenv/config'
import { defineConfig } from 'prisma/config'

/**
 * Prisma 7 moved the datasource URL out of schema.prisma. This file supplies it to
 * CLI commands (db pull, validate, studio). The runtime client gets its connection
 * from the MariaDB driver adapter in src/config/database.js instead.
 *
 * SAFETY: `prisma migrate` must never be pointed at production. Use DATABASE_URL_DEV
 * for any command that can write schema. See docs/database-mapping.md §8.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL_DEV || process.env.DATABASE_URL || '',
  },
})
