import * as api from '../services/endpoints.js'

/**
 * Every product, for the admin's product PICKERS (Shop the Look, You May Also Like).
 *
 * Those screens need the whole catalogue in one <select>, but the admin list endpoint
 * CLAMPS per_page to 100 however much you ask for. Requesting 200 and trusting the reply
 * silently dropped everything past the hundredth product: it simply could not be picked,
 * and nothing said why. The cap is a sensible protection on the server, so this pages
 * through instead of asking for it to be raised.
 *
 * The page count comes from the response, so this makes exactly as many requests as the
 * catalogue needs — one for a shop with fewer than a hundred products.
 */
export async function fetchAllProducts({ perPage = 100, maxPages = 50 } = {}) {
  const first = await api.admin.products.list({ per_page: perPage, page: 1 })
  const items = [...(first?.items ?? [])]

  // `lastPage` is absent on older responses; one page is the safe assumption.
  const lastPage = Math.min(Number(first?.pagination?.lastPage ?? 1) || 1, maxPages)

  for (let page = 2; page <= lastPage; page += 1) {
    const next = await api.admin.products.list({ per_page: perPage, page })
    const rows = next?.items ?? []
    if (rows.length === 0) break
    items.push(...rows)
  }

  return items
}

export default fetchAllProducts
