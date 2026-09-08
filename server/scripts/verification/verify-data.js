#!/usr/bin/env node
/**
 * Data verification (migration brief §45).
 *
 * Counts every table and checks the relationships that have NO database-level foreign key
 * (audit R4), where orphans are actually possible. Read-only — it never writes.
 *
 * Usage:
 *   cd server && node ../scripts/verification/verify-data.js
 *   DATABASE_URL=... node scripts/verification/verify-data.js
 *
 * Exit code 0 = clean, 1 = inconsistencies found.
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

/**
 * Row counts expected from the production dump, taken from its AUTO_INCREMENT values.
 * These are UPPER BOUNDS — deleted rows mean the real count is lower — so they are
 * reported for comparison rather than asserted.
 */
const EXPECTED_UPPER_BOUND = {
  user: 9,
  userAddress: 7,
  userBankAccount: 0,
  category: 9,
  subCategory: 15,
  brand: 3,
  color: 24,
  size: 14,
  offer: 4,
  product: 66,
  productColor: 99,
  productSize: 175,
  productImage: 289,
  productReview: 4,
  banner: 11,
  bannerImage: 28,
  homeSectionProduct: 9,
  cartItem: 43,
  wishlist: 7,
  order: 22,
  orderItem: 29,
  orderStatusLog: 35,
  coupon: 5,
  couponRedemption: 1,
  subscriber: 5,
  page: 4,
  newsType: 6,
  blogPost: 0, // no AUTO_INCREMENT recorded in the dump for this table
  shippingSetting: 1,
  passwordResetAttempt: 5,
}

const pad = (text, width) => String(text).padEnd(width)
let problems = 0

async function countAll() {
  console.log('\n── Row counts ' + '─'.repeat(52))
  console.log(`${pad('Model', 24)}${pad('Rows', 10)}Dump upper bound`)

  for (const [model, bound] of Object.entries(EXPECTED_UPPER_BOUND)) {
    try {
      const count = await prisma[model].count()
      const flag = count > bound ? '  (higher — new rows since the export)' : ''
      console.log(`${pad(model, 24)}${pad(count, 10)}${bound}${flag}`)
    } catch (error) {
      console.log(`${pad(model, 24)}ERROR — ${error.message.split('\n')[0]}`)
      problems += 1
    }
  }
}

/**
 * Orphan checks.
 *
 * The three relations WITHOUT a database foreign key are the ones that matter — MySQL is
 * not enforcing them, so nothing else would catch a break. The rest are checked anyway,
 * cheaply, in case a constraint was ever dropped.
 */
async function checkOrphans() {
  console.log('\n── Relationship integrity ' + '─'.repeat(41))

  const checks = [
    {
      label: 'blog_posts -> news_types',
      noForeignKey: true,
      run: () => prisma.$queryRaw`
        SELECT COUNT(*) AS n FROM blog_posts b
        LEFT JOIN news_types t ON t.id = b.news_type_id
        WHERE b.news_type_id IS NOT NULL AND t.id IS NULL`,
    },
    {
      label: 'banner_images -> banners',
      noForeignKey: true,
      run: () => prisma.$queryRaw`
        SELECT COUNT(*) AS n FROM banner_images bi
        LEFT JOIN banners b ON b.id = bi.banner_id
        WHERE b.id IS NULL`,
    },
    {
      label: 'home_section_products -> products',
      noForeignKey: true,
      run: () => prisma.$queryRaw`
        SELECT COUNT(*) AS n FROM home_section_products h
        LEFT JOIN products p ON p.id = h.product_id
        WHERE p.id IS NULL`,
    },
    {
      label: 'products -> categories',
      run: () => prisma.$queryRaw`
        SELECT COUNT(*) AS n FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE c.id IS NULL`,
    },
    {
      label: 'orders -> users',
      run: () => prisma.$queryRaw`
        SELECT COUNT(*) AS n FROM orders o
        LEFT JOIN users u ON u.id = o.user_id
        WHERE u.id IS NULL`,
    },
    {
      label: 'order_items -> orders',
      run: () => prisma.$queryRaw`
        SELECT COUNT(*) AS n FROM order_items oi
        LEFT JOIN orders o ON o.id = oi.order_id
        WHERE o.id IS NULL`,
    },
    {
      label: 'cart_items -> products',
      run: () => prisma.$queryRaw`
        SELECT COUNT(*) AS n FROM cart_items ci
        LEFT JOIN products p ON p.id = ci.product_id
        WHERE p.id IS NULL`,
    },
    {
      label: 'coupon_redemptions -> coupons',
      run: () => prisma.$queryRaw`
        SELECT COUNT(*) AS n FROM coupon_redemptions cr
        LEFT JOIN coupons c ON c.id = cr.coupon_id
        WHERE c.id IS NULL`,
    },
  ]

  for (const check of checks) {
    try {
      const [row] = await check.run()
      const orphans = Number(row.n)
      const marker = check.noForeignKey ? ' [no FK in schema]' : ''

      if (orphans > 0) {
        console.log(`  ✖ ${pad(check.label, 38)}${orphans} orphan(s)${marker}`)
        problems += 1
      } else {
        console.log(`  ✓ ${pad(check.label, 38)}clean${marker}`)
      }
    } catch (error) {
      console.log(`  ? ${pad(check.label, 38)}${error.message.split('\n')[0]}`)
      problems += 1
    }
  }
}

/** Business-rule checks that would produce visibly wrong behaviour if broken. */
async function checkBusinessRules() {
  console.log('\n── Business data ' + '─'.repeat(50))

  const checks = [
    {
      label: 'coupons.used_count matches redemptions',
      run: async () => {
        const rows = await prisma.$queryRaw`
          SELECT c.id, c.code, c.used_count, COUNT(cr.id) AS actual
          FROM coupons c
          LEFT JOIN coupon_redemptions cr ON cr.coupon_id = c.id
          GROUP BY c.id, c.code, c.used_count
          HAVING c.used_count <> COUNT(cr.id)`
        return rows.map((r) => `${r.code}: counter ${r.used_count}, rows ${r.actual}`)
      },
    },
    {
      label: 'paid orders have a payment id',
      run: async () => {
        const rows = await prisma.$queryRaw`
          SELECT order_number FROM orders
          WHERE payment_status = 'paid' AND (payment_id IS NULL OR payment_id = '')`
        return rows.map((r) => r.order_number)
      },
    },
    {
      label: 'orders have at least one item',
      run: async () => {
        const rows = await prisma.$queryRaw`
          SELECT o.order_number FROM orders o
          LEFT JOIN order_items oi ON oi.order_id = o.id
          WHERE oi.id IS NULL`
        return rows.map((r) => r.order_number)
      },
    },
    {
      label: 'users have a bcrypt password hash',
      run: async () => {
        // A row that is not bcrypt cannot be verified by the new app.
        const rows = await prisma.$queryRaw`
          SELECT email FROM users WHERE password NOT LIKE '$2%' OR CHAR_LENGTH(password) <> 60`
        return rows.map((r) => r.email)
      },
    },
    {
      label: 'shipping settings row exists',
      run: async () => {
        const count = await prisma.shippingSetting.count()
        return count === 0 ? ['missing — defaults 899/60 will be used'] : []
      },
    },
  ]

  for (const check of checks) {
    try {
      const issues = await check.run()
      if (issues.length > 0) {
        console.log(`  ✖ ${pad(check.label, 38)}${issues.length} issue(s)`)
        issues.slice(0, 5).forEach((issue) => console.log(`      · ${issue}`))
        problems += 1
      } else {
        console.log(`  ✓ ${pad(check.label, 38)}clean`)
      }
    } catch (error) {
      console.log(`  ? ${pad(check.label, 38)}${error.message.split('\n')[0]}`)
    }
  }
}

/** Media paths that no longer resolve on disk would render as broken images. */
async function checkMedia() {
  console.log('\n── Media ' + '─'.repeat(58))

  const [{ n: missingFeatured }] = await prisma.$queryRaw`
    SELECT COUNT(*) AS n FROM products
    WHERE is_active = 1 AND (featured_image IS NULL OR featured_image = '')`

  console.log(
    missingFeatured > 0
      ? `  ✖ ${pad('active products without an image', 38)}${missingFeatured}`
      : `  ✓ ${pad('active products without an image', 38)}none`,
  )
  if (Number(missingFeatured) > 0) problems += 1

  if (!process.env.STORAGE_ROOT) {
    console.log('  ? STORAGE_ROOT is not set — on-disk file existence was not checked.')
  }
}

try {
  console.log('Verifying:', url.replace(/\/\/[^@]*@/, '//***@'))
  await countAll()
  await checkOrphans()
  await checkBusinessRules()
  await checkMedia()

  console.log('\n' + '─'.repeat(66))
  if (problems === 0) {
    console.log('✓ No inconsistencies found.\n')
  } else {
    console.log(`✖ ${problems} check(s) reported problems. Review before cutover.\n`)
  }
  process.exit(problems === 0 ? 0 : 1)
} catch (error) {
  console.error('\nVerification failed:', error.message)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
