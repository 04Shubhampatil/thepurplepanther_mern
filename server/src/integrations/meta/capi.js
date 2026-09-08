import crypto from 'node:crypto'
import env from '../../config/env.js'
import logger from '../../config/logger.js'
import { toNumber } from '../../utils/money.js'

/**
 * Meta Conversions API — port of App\Services\MetaConversionsService.
 *
 * FAILURE POLICY IS LOAD-BEARING. `track()` never throws and never rejects. Meta failing
 * must not delay or break a checkout, and this module sits on the payment path. Every call
 * site fires and forgets; nothing awaits it.
 *
 * META_CAPI_ACCESS_TOKEN never leaves the server.
 */

/**
 * The 13 events the service declares. Only 9 have call sites — `Contact`, `FindLocation`,
 * `Schedule` and `StartTrial` are declared but never emitted. Kept for fidelity; do not
 * add emissions for them without a product decision.
 */
export const SUPPORTED_EVENTS = Object.freeze([
  'ViewContent',
  'Search',
  'AddToWishlist',
  'AddToCart',
  'InitiateCheckout',
  'AddPaymentInfo',
  'Purchase',
  'Subscribe',
  'StartTrial',
  'CompleteRegistration',
  'Contact',
  'FindLocation',
  'Schedule',
])

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')

/**
 * Normalisation before hashing, matching MetaConversionsService::normalize exactly.
 * Meta's match rate depends on this being byte-identical — a differently normalised value
 * hashes differently and simply fails to match.
 */
function normalize(field, value) {
  if (value === null || value === undefined || String(value).trim() === '') return null

  let out = String(value).trim().toLowerCase()

  if (field === 'phone' || field === 'date_of_birth') {
    out = out.replace(/\D+/g, '')
  } else if (field === 'country') {
    out = out === 'india' ? 'in' : out
  }

  return out === '' ? null : out
}

/** Meta's user_data key for each field we send. */
const HASH_FIELDS = Object.freeze({
  email: 'em',
  phone: 'ph',
  first_name: 'fn',
  last_name: 'ln',
  gender: 'ge',
  date_of_birth: 'db',
  city: 'ct',
  state: 'st',
  zip: 'zp',
  country: 'country',
  external_id: 'external_id',
})

/**
 * Build `user_data`.
 *
 * Every PII field is normalised, SHA-256 hashed, and wrapped in an ARRAY — Meta rejects a
 * bare string. `client_ip_address`, `client_user_agent`, `fbc` and `fbp` are sent
 * unhashed, as Meta requires.
 */
export function buildUserData(request, provided = {}) {
  const data = {
    client_ip_address: request?.ip ?? null,
    client_user_agent: request?.headers?.['user-agent'] ?? null,
    fbc: request?.cookies?._fbc ?? null,
    fbp: request?.cookies?._fbp ?? null,
  }

  // When the cookie is absent but the click id is in the URL, synthesise _fbc the way
  // Meta's pixel would have.
  if (!data.fbc && request?.query?.fbclid) {
    data.fbc = `fb.1.${Date.now()}.${request.query.fbclid}`
  }

  for (const [source, target] of Object.entries(HASH_FIELDS)) {
    const normalized = normalize(source, provided[source])
    if (normalized !== null) data[target] = [sha256(normalized)]
  }

  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && !v.length)),
  )
}

/** Referer if it is same-host, else the request's own URL — matches ::sourceUrl. */
function sourceUrl(request) {
  const referer = request?.headers?.referer ?? ''
  try {
    if (referer && new URL(referer).host === request.headers.host) return referer
  } catch {
    /* malformed referer — fall through */
  }
  return `${env.APP_URL}${request?.originalUrl ?? ''}`
}

const endpoint = () =>
  `https://graph.facebook.com/${String(env.META_CAPI_API_VERSION).replace(/^\/|\/$/g, '')}` +
  `/${encodeURIComponent(env.META_CAPI_DATASET_ID)}/events`

/**
 * Send one event.
 *
 * Always resolves, always returns the event id. A caller can therefore use the id for
 * client-side deduplication without needing to know whether the send succeeded.
 */
export async function track(eventName, request, customData = {}, customerData = {}, eventId = null) {
  const id = eventId ?? crypto.randomUUID()

  if (!SUPPORTED_EVENTS.includes(eventName) || !env.metaCapiEnabled) return id

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: id,
        event_source_url: sourceUrl(request),
        action_source: 'website',
        user_data: buildUserData(request, customerData),
        custom_data: Object.fromEntries(
          Object.entries(customData).filter(([, v]) => v !== null && v !== ''),
        ),
      },
    ],
  }

  if (env.META_CAPI_TEST_EVENT_CODE) payload.test_event_code = env.META_CAPI_TEST_EVENT_CODE

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), env.META_CAPI_TIMEOUT * 1000)

  try {
    const response = await fetch(endpoint(), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.META_CAPI_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      logger.warn(
        { eventName, eventId: id, status: response.status, response: body.slice(0, 1000) },
        'Meta CAPI event rejected',
      )
    }
  } catch (error) {
    // Includes the timeout abort. Warn, never throw.
    logger.warn({ eventName, eventId: id, err: error.message }, 'Meta CAPI event failed')
  } finally {
    clearTimeout(timeout)
  }

  return id
}

/**
 * Fire-and-forget wrapper. Use this on every request path — especially checkout.
 * The `.catch` is belt and braces: track() already swallows everything, but an unhandled
 * rejection here would take the process down.
 */
export function trackAsync(...args) {
  void track(...args).catch(() => {})
}

// ─────────────────────────────────────────────── payload builders

/** MetaConversionsService::productData */
export function productData(product, quantity = 1) {
  const price = toNumber(product.sellingPrice) || toNumber(product.mrp)
  return {
    content_ids: [String(product.id)],
    content_name: product.title,
    content_category: product.category?.title ?? null,
    content_type: 'product',
    contents: [{ id: String(product.id), quantity, item_price: price }],
    value: Math.round(price * quantity * 100) / 100,
    currency: 'INR',
  }
}

/** MetaConversionsService::cartLineData */
export function cartLineData(line, value = null) {
  const quantity = Number(line.quantity ?? 1)
  const unitPrice = toNumber(line.unitPrice)
  return {
    content_ids: [String(line.productId ?? '')],
    content_name: line.title ?? null,
    content_type: 'product',
    contents: [{ id: String(line.productId ?? ''), quantity, item_price: unitPrice }],
    value: Math.round((value ?? unitPrice * quantity) * 100) / 100,
    currency: 'INR',
  }
}

/** MetaConversionsService::orderData */
export function orderData(order) {
  return {
    order_id: order.orderNumber,
    content_ids: (order.items ?? []).filter((i) => i.productId).map((i) => String(i.productId)),
    content_type: 'product',
    contents: (order.items ?? []).map((item) => ({
      id: String(item.productId),
      quantity: Number(item.quantity),
      item_price: toNumber(item.price),
    })),
    value: toNumber(order.payableAmount),
    currency: 'INR',
  }
}

/** MetaConversionsService::customerFromOrder */
export function customerFromOrder(order) {
  const parts = String(order.shippingName ?? '').trim().split(/\s+/)
  return {
    email: order.shippingEmail || order.userEmail,
    phone: order.shippingPhone || order.userPhone,
    first_name: parts[0] ?? null,
    last_name: parts.slice(1).join(' ') || null,
    city: order.shippingCity,
    state: order.shippingState,
    zip: order.shippingPincode,
    country: order.shippingCountry,
    external_id: order.userId ? String(order.userId) : null,
  }
}

/** Cart summary -> InitiateCheckout custom_data. */
export function cartData(summary) {
  return {
    content_ids: summary.items.map((i) => String(i.productId)),
    content_type: 'product',
    contents: summary.items.map((item) => ({
      id: String(item.productId),
      quantity: Number(item.quantity),
      item_price: toNumber(item.unitPrice),
    })),
    value: toNumber(summary.total),
    currency: 'INR',
    num_items: Number(summary.count),
  }
}

export default {
  track,
  trackAsync,
  productData,
  cartLineData,
  orderData,
  customerFromOrder,
  cartData,
  buildUserData,
  SUPPORTED_EVENTS,
}
