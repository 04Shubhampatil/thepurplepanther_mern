/**
 * Dates for the admin screens.
 *
 * MySQL `timestamp`/`datetime` columns hold NO zone. Laravel read them in the app timezone
 * (Asia/Kolkata) and printed them straight back, so a row storing `2026-08-09 20:27:36`
 * displayed as "09 Aug 2026".
 *
 * Prisma reads the same column as UTC and serialises it `2026-08-09T20:27:36.000Z`. Passing
 * that through `new Date(...)` and formatting locally then ADDS the offset again — the same
 * value renders as 10 Aug 01:57 in IST. Every journal date was a day late.
 *
 * So the wall-clock parts are read from the string as written, without constructing a Date.
 * That reproduces Laravel exactly and, unlike a hard-coded offset, cannot drift when the
 * server's timezone or DST changes — there is no conversion left to get wrong.
 */

const ISO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** The stored wall-clock parts, or null when the value is missing or unparseable. */
export function wallClockParts(value) {
  if (!value) return null

  const match = ISO.exec(typeof value === 'string' ? value : new Date(value).toISOString())
  if (!match) return null

  const [, year, month, day, hour, minute, second = '00'] = match
  return { year, month, day, hour, minute, second }
}

/** `optional($date)->format('d M Y')` — "09 Aug 2026". */
export function formatDate(value) {
  const parts = wallClockParts(value)
  if (!parts) return ''

  const month = MONTHS[Number(parts.month) - 1] ?? parts.month
  return `${parts.day} ${month} ${parts.year}`
}

/** `format('Y-m-d\TH:i')` — the value a `datetime-local` input expects. */
export function toDateTimeLocal(value) {
  const parts = wallClockParts(value)
  if (!parts) return ''

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

/**
 * `now()` in the same shape, for a new post's default.
 *
 * This one IS local: it is the admin's own clock, not a value read back from a column.
 */
export function nowDateTimeLocal() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}
