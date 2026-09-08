import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Store tests.
 *
 * The rule under test is architectural: the client must never compute money. The store
 * replaces its cart wholesale with the server's summary rather than merging or
 * recalculating, so what a customer sees can never disagree with what checkout charges.
 */

vi.mock('../services/endpoints.js', () => ({
  auth: { me: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn() },
  cart: {
    get: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    applyCoupon: vi.fn(),
    removeCoupon: vi.fn(),
  },
  misc: { config: vi.fn() },
  catalog: { categories: vi.fn() },
}))

const api = await import('../services/endpoints.js')
const { useCartStore, useRecentStore } = await import('./index.js')

const SERVER_CART = {
  cart: {
    items: [{ lineKey: '1||', productId: 1, quantity: 2, unitPrice: 1000, lineTotal: 2000 }],
    count: 2,
    subtotal: 2000,
    subtotalFormatted: '₹ 2,000.00',
    discount: { amount: 200, amountFormatted: '₹ 200.00', code: 'SAVE10', freeShipping: false },
    shipping: { amount: 60, amountFormatted: '₹ 60.00', isFree: false },
    total: 1860,
    totalFormatted: '₹ 1,860.00',
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  useCartStore.setState({ cart: { items: [], count: 0 }, loading: false, error: null })
})

describe('cart store', () => {
  it('replaces its state with the server summary rather than merging', async () => {
    api.cart.get.mockResolvedValue(SERVER_CART)
    await useCartStore.getState().refresh()

    const { cart } = useCartStore.getState()
    expect(cart.total).toBe(1860)
    expect(cart.totalFormatted).toBe('₹ 1,860.00')
    expect(cart.discount.code).toBe('SAVE10')
  })

  it('takes the server total verbatim, even when it disagrees with the arithmetic', async () => {
    // The server is the single source of truth for money. If it says 999 the client shows
    // 999 — it does not "correct" the figure from the parts.
    api.cart.get.mockResolvedValue({
      cart: { ...SERVER_CART.cart, total: 999, totalFormatted: '₹ 999.00' },
    })
    await useCartStore.getState().refresh()

    expect(useCartStore.getState().cart.total).toBe(999)
  })

  it('updates totals from the mutation response', async () => {
    api.cart.add.mockResolvedValue(SERVER_CART)
    await useCartStore.getState().add({ product_id: 1, quantity: 2 })

    expect(useCartStore.getState().cart.count).toBe(2)
    expect(useCartStore.getState().cart.subtotal).toBe(2000)
  })

  it('surfaces the server message when a mutation fails', async () => {
    api.cart.add.mockRejectedValue(new Error('Only 2 item(s) are available for this product option.'))

    await expect(useCartStore.getState().add({ product_id: 1, quantity: 9 })).rejects.toThrow()
    expect(useCartStore.getState().error).toBe(
      'Only 2 item(s) are available for this product option.',
    )
  })

  it('falls back to an empty cart when the request fails', async () => {
    api.cart.get.mockRejectedValue(new Error('offline'))
    await useCartStore.getState().refresh()

    expect(useCartStore.getState().cart.count).toBe(0)
    expect(useCartStore.getState().cart.items).toEqual([])
  })
})

describe('recently viewed', () => {
  beforeEach(() => {
    localStorage.clear()
    useRecentStore.setState({ ids: [] })
  })

  it('keeps the most recent first', () => {
    const { push } = useRecentStore.getState()
    push(1)
    push(2)
    push(3)
    expect(useRecentStore.getState().ids).toEqual(['3', '2', '1'])
  })

  it('moves a repeat view to the front rather than duplicating it', () => {
    const { push } = useRecentStore.getState()
    push(1)
    push(2)
    push(1)
    expect(useRecentStore.getState().ids).toEqual(['1', '2'])
  })

  it('caps the list at 12', () => {
    const { push } = useRecentStore.getState()
    for (let i = 1; i <= 20; i += 1) push(i)
    expect(useRecentStore.getState().ids).toHaveLength(12)
  })

  it('excludes the current product', () => {
    const { push, exclude } = useRecentStore.getState()
    push(1)
    push(2)
    expect(useRecentStore.getState().ids).toContain('1')
    expect(exclude(1)).not.toContain('1')
  })
})
