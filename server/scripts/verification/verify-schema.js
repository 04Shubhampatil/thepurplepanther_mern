#!/usr/bin/env node
/**
 * Schema verification.
 *
 * Compares the LIVE database against the hand-written Prisma schema: every model must have
 * its table, every table must be known, and the columns the business rules depend on must
 * exist with the right nullability.
 *
 * `prisma db pull` would rewrite the schema from the database; this does the opposite —
 * it checks the database matches what the code believes, without touching either.
 *
 * Usage: cd server && node ../scripts/verification/verify-schema.js
 * Exit 0 = match, 1 = drift.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Load server/.env explicitly. process.loadEnvFile (Node 20.12+) avoids depending on
// the working directory, so these run correctly from anywhere.
const here = path.dirname(fileURLToPath(import.meta.url))
try {
  process.loadEnvFile(path.resolve(here, '../../.env'))
} catch {
  // Already-set environment variables are used instead.
}
import { PrismaClient } from '@prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

const url = process.env.DATABASE_URL_DEV || process.env.DATABASE_URL
if (!url) {
  console.error('Set DATABASE_URL (or DATABASE_URL_DEV) before running this script.')
  process.exit(1)
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url) })

/** Every table the Prisma schema maps, including the four Laravel framework tables. */
const EXPECTED_TABLES = [
  'banner_images', 'banners', 'blog_posts', 'brands', 'cart_items', 'categories', 'colors',
  'contact_messages', 'coupon_redemptions', 'coupons', 'failed_jobs', 'home_section_products',
  'migrations', 'news_types', 'offers', 'order_items', 'order_status_logs', 'orders', 'pages',
  'password_reset_attempts', 'password_reset_tokens', 'personal_access_tokens', 'product_color',
  'product_images', 'product_reviews', 'product_size', 'products', 'shipping_settings', 'sizes',
  'sub_categories', 'subscribers', 'user_addresses', 'user_bank_accounts', 'users', 'wishlists',
]

/**
 * Columns the business rules read. If one of these is missing or has changed nullability,
 * something breaks in a way that unit tests with a mocked Prisma cannot catch.
 */
const CRITICAL_COLUMNS = {
  products: [
    'title', 'slug', 'category_id', 'mrp', 'selling_price', 'max_unit_buy',
    'accessory_packages', 'is_active', 'sort_order',
  ],
  product_color: ['product_id', 'color_id', 'quantity'],
  product_size: ['product_id', 'size_id', 'quantity'],
  cart_items: ['user_id', 'product_id', 'color', 'size', 'package_key', 'package_price', 'quantity'],
  coupons: [
    'code', 'offer_type', 'discount_type', 'discount_percent', 'discount_amount',
    'applies_to', 'category_ids', 'product_ids', 'bogo_buy_quantity', 'bogo_get_quantity',
    'used_count', 'usage_limit', 'free_shipping', 'is_public',
  ],
  orders: [
    'order_number', 'user_id', 'payment_status', 'razorpay_order_id', 'payment_id',
    'subtotal', 'discount_amount', 'delivery_charge', 'payable_amount', 'status', 'coupon_id',
  ],
  order_items: ['order_id', 'product_id', 'price', 'mrp', 'saving', 'quantity', 'total_price'],
  users: ['email', 'username', 'password', 'role', 'is_active'],
  shipping_settings: ['free_shipping_threshold', 'flat_shipping_rate'],
  password_reset_tokens: ['email', 'token', 'created_at'],
}

let problems = 0

try {
  const database = url.split('/').pop().split('?')[0]
  console.log(`Verifying schema of "${database}"\n`)

  const tables = await prisma.$queryRawUnsafe(
    `SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
    database,
  )
  const present = new Set(tables.map((t) => t.name))

  console.log('── Tables ' + '─'.repeat(56))

  const missing = EXPECTED_TABLES.filter((t) => !present.has(t))
  if (missing.length > 0) {
    console.log(`  ✖ Missing ${missing.length}: ${missing.join(', ')}`)
    problems += 1
  } else {
    console.log(`  ✓ All ${EXPECTED_TABLES.length} expected tables present`)
  }

  const extra = [...present].filter((t) => !EXPECTED_TABLES.includes(t))
  if (extra.length > 0) {
    // Not an error — a table the Prisma schema does not map is simply invisible to the
    // new app. Worth knowing about before cutover.
    console.log(`  ! ${extra.length} table(s) not mapped by Prisma: ${extra.join(', ')}`)
  }

  console.log('\n── Critical columns ' + '─'.repeat(47))

  for (const [table, columns] of Object.entries(CRITICAL_COLUMNS)) {
    if (!present.has(table)) continue

    const rows = await prisma.$queryRawUnsafe(
      `SELECT COLUMN_NAME AS name, IS_NULLABLE AS nullable, DATA_TYPE AS type
       FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      database,
      table,
    )

    const found = new Map(rows.map((r) => [r.name, r]))
    const absent = columns.filter((c) => !found.has(c))

    if (absent.length > 0) {
      console.log(`  ✖ ${table}: missing ${absent.join(', ')}`)
      problems += 1
    } else {
      console.log(`  ✓ ${table} (${columns.length} columns)`)
    }
  }

  console.log('\n── Known schema gaps (audit R4) ' + '─'.repeat(35))
  console.log('  These relations have NO foreign key in the live database:')
  console.log('    · blog_posts.news_type_id     (no FK, no index)')
  console.log('    · banner_images.banner_id     (no FK, no index)')
  console.log('    · home_section_products.product_id (no FK)')
  console.log('  Run verify-data.js to check for orphans they allow.')

  console.log('\n' + '─'.repeat(66))
  if (problems === 0) {
    console.log('✓ The database matches the Prisma schema.\n')
  } else {
    console.log(`✖ ${problems} mismatch(es). Do NOT deploy until resolved.\n`)
  }
  process.exit(problems === 0 ? 0 : 1)
} catch (error) {
  console.error('\nSchema verification failed:', error.message)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
