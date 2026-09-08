/**
 * Two distinct JSON concerns:
 *
 * 1. BigInt serialisation. Prisma maps MySQL BIGINT to JS BigInt, which JSON.stringify
 *    throws on. Ids must reach the browser as numbers.
 *
 * 2. JSON-in-longtext columns. products.highlights_items, information_items,
 *    specifications, accessory_packages and coupons.category_ids / product_ids are
 *    `longtext` with a json_valid() CHECK, not native JSON columns. Laravel's 'array'
 *    cast json_decode'd them on read and json_encode'd on write; these helpers do the
 *    same, so values round-trip byte-compatibly between the two apps.
 */

/**
 * Parse a JSON-in-longtext column. Never throws — a malformed value yields the fallback,
 * matching Laravel's cast, which returns null rather than erroring.
 */
export function parseJsonColumn(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'object') return value // already parsed
  try {
    const parsed = JSON.parse(value)
    return parsed === null ? fallback : parsed
  } catch {
    return fallback
  }
}

/** Parse a column expected to hold an array; always returns an array. */
export function parseJsonArray(value) {
  const parsed = parseJsonColumn(value, [])
  return Array.isArray(parsed) ? parsed : []
}

/** Serialise for writing back to a longtext column. null stays null (not "null"). */
export function stringifyJsonColumn(value) {
  if (value === null || value === undefined) return null
  return JSON.stringify(value)
}

/**
 * Recursively convert BigInt to Number and Prisma Decimal to Number for API responses.
 * Ids in this schema are far below Number.MAX_SAFE_INTEGER, so the conversion is lossless.
 */
export function serialize(value) {
  if (value === null || value === undefined) return value

  if (typeof value === 'bigint') {
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(-Number.MAX_SAFE_INTEGER)) {
      return value.toString()
    }
    return Number(value)
  }

  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(serialize)

  // Prisma Decimal
  if (typeof value === 'object' && typeof value.toNumber === 'function' && value.constructor?.name === 'Decimal') {
    return value.toNumber()
  }

  if (typeof value === 'object' && value.constructor === Object) {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = serialize(v)
    return out
  }

  return value
}

/**
 * Global safety net so a missed serialize() call degrades to a string id rather than
 * crashing the request with "Do not know how to serialize a BigInt".
 */
export function installBigIntSerializer() {
  if (!('toJSON' in BigInt.prototype)) {
    Object.defineProperty(BigInt.prototype, 'toJSON', {
      value: function () {
        return Number(this) <= Number.MAX_SAFE_INTEGER ? Number(this) : this.toString()
      },
      writable: true,
      configurable: true,
    })
  }
}

export default { parseJsonColumn, parseJsonArray, stringifyJsonColumn, serialize, installBigIntSerializer }
