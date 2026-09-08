import prisma from '../config/database.js'
import { toNumber, format } from '../utils/money.js'

/**
 * Shipping quotes — port of App\Services\ShippingService.
 *
 * Single-row settings table. Laravel's ShippingSetting::current() created the row on first
 * access; reading with a fallback achieves the same result without writing on a GET.
 */

/** Schema defaults, used when the settings row is missing. */
const DEFAULTS = { freeShippingThreshold: 899, flatShippingRate: 60 }

export async function getSettings() {
  const row = await prisma.shippingSetting.findFirst({ orderBy: { id: 'asc' } })
  return {
    freeShippingThreshold: row ? toNumber(row.freeShippingThreshold) : DEFAULTS.freeShippingThreshold,
    flatShippingRate: row ? toNumber(row.flatShippingRate) : DEFAULTS.flatShippingRate,
  }
}

/**
 * @param subtotal — the amount the threshold is tested against.
 *
 * IMPORTANT: the caller passes the subtotal AFTER discount. CartService::summary computes
 * `max(0, subtotal - discount)` and passes that, so a coupon can push an order below the
 * free-shipping threshold. Passing the pre-discount subtotal here is a silent parity break
 * that shows up as customers being charged the wrong delivery fee.
 */
export async function quote(subtotal) {
  const { freeShippingThreshold, flatShippingRate } = await getSettings()
  const isFree = toNumber(subtotal) >= freeShippingThreshold
  const amount = isFree ? 0 : flatShippingRate

  return {
    amount,
    freeShippingThreshold,
    flatShippingRate,
    isFree,
    // Laravel emitted the literal string 'Free' rather than a formatted zero.
    amountFormatted: isFree ? 'Free' : format(amount),
  }
}

export default { quote, getSettings }
