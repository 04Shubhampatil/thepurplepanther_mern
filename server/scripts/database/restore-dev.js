#!/usr/bin/env node
/**
 * Restore the production dump into a LOCAL DEVELOPMENT database.
 *
 * SAFETY — this script refuses to run unless all of the following hold:
 *   1. DATABASE_URL_DEV is set (it never reads DATABASE_URL).
 *   2. Its host is localhost / 127.0.0.1.
 *   3. Its database name is NOT the production name.
 *   4. The database name ends in _dev, _test or _local.
 *
 * It shells out to the mysql client rather than executing SQL itself, so the dump is
 * applied exactly as mysqldump wrote it.
 *
 * Usage:  npm run db:restore  (from server/)
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

// Load server/.env explicitly. process.loadEnvFile (Node 20.12+) avoids depending on
// the working directory, so these run correctly from anywhere.
const here = path.dirname(fileURLToPath(import.meta.url))
try {
  process.loadEnvFile(path.resolve(here, '../../.env'))
} catch {
  // Already-set environment variables are used instead.
}

const PRODUCTION_DB_NAMES = ['u375273201_purple_panthdb']
const ALLOWED_SUFFIXES = ['_dev', '_test', '_local']

const DUMP_PATH =
  process.env.DUMP_PATH ||
  path.resolve(here, '../../../../thepurplepanther/u375273201_purple_panthdb 1.sql')

function die(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

const url = process.env.DATABASE_URL_DEV
if (!url) {
  die(
    'DATABASE_URL_DEV is not set.\n' +
      '  Add it to server/.env, for example:\n' +
      '  DATABASE_URL_DEV=mysql://root:YOUR_PASSWORD@localhost:3306/purple_panther_dev',
  )
}

let parsed
try {
  parsed = new URL(url)
} catch {
  die('DATABASE_URL_DEV is not a valid URL. Expected mysql://user:pass@host:port/database')
}

const host = parsed.hostname
const port = parsed.port || '3306'
const user = decodeURIComponent(parsed.username)
const password = decodeURIComponent(parsed.password)
const database = parsed.pathname.replace(/^\//, '')

// --- guard 1: local only ---------------------------------------------------
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  die(`Refusing to run against a non-local host (${host}). This script is for local development only.`)
}

// --- guard 2: not the production database ----------------------------------
if (PRODUCTION_DB_NAMES.includes(database)) {
  die(`Refusing to run against "${database}" — that is the production database name.`)
}

// --- guard 3: explicit dev naming ------------------------------------------
if (!ALLOWED_SUFFIXES.some((s) => database.endsWith(s))) {
  die(
    `Refusing to run against "${database}".\n` +
      `  The development database name must end in one of: ${ALLOWED_SUFFIXES.join(', ')}`,
  )
}

if (!existsSync(DUMP_PATH)) {
  die(`Dump not found at:\n  ${DUMP_PATH}\n  Set DUMP_PATH to override.`)
}

console.log(`Restoring into  ${database}  on  ${host}:${port}`)
console.log(`From            ${DUMP_PATH}\n`)

/** Run the mysql client. The password goes via MYSQL_PWD so it never appears in argv. */
function mysql(args, { stdinFile } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('mysql', ['-h', host, '-P', port, '-u', user, ...args], {
      env: { ...process.env, MYSQL_PWD: password },
      stdio: [stdinFile ? 'pipe' : 'inherit', 'inherit', 'inherit'],
      shell: false,
    })

    if (stdinFile) {
      import('node:fs').then(({ createReadStream }) => {
        createReadStream(stdinFile).pipe(child.stdin)
      })
    }

    child.on('error', reject)
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`mysql exited with code ${code}`)),
    )
  })
}

try {
  await mysql([
    '-e',
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
  ])
  await mysql([database], { stdinFile: DUMP_PATH })

  console.log(`\n✔ Restored into ${database}.`)
  console.log('  Next:  npx prisma db pull --print   (to diff against the hand-written schema)')
} catch (error) {
  die(
    `Restore failed: ${error.message}\n` +
      '  Check that the MySQL client is on PATH and the credentials in DATABASE_URL_DEV are correct.',
  )
}
