import { create } from 'zustand'
import * as api from '../services/endpoints.js'

/**
 * Application state.
 *
 * DELIBERATELY THIN. Cart totals, discounts and stock limits are NOT stored or computed
 * here — the server returns a fully-priced summary on every mutation and the store simply
 * replaces what it holds. That is the rule from the migration brief (§32): React must
 * never contain authoritative pricing, coupon, inventory or order logic. If the client
 * recalculated a total, it could disagree with what checkout charges.
 */

// ── auth ───────────────────────────────────────────────────────────────────

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  initialised: false,

  /** Called once at boot. The cookie is HTTP-only, so the server is the only way to ask. */
  async init() {
    if (get().initialised) return
    try {
      const { user } = await api.auth.me()
      set({ user, loading: false, initialised: true })
    } catch {
      set({ user: null, loading: false, initialised: true })
    }
  },

  async login(credentials) {
    const { user } = await api.auth.login(credentials)
    set({ user })
    // The server merges any guest cart on login, so re-read rather than trusting local state.
    await useCartStore.getState().refresh()
    return user
  },

  async register(values) {
    const { user } = await api.auth.register(values)
    set({ user })
    await useCartStore.getState().refresh()
    return user
  },

  async logout() {
    try {
      await api.auth.logout()
    } finally {
      set({ user: null })
      await useCartStore.getState().refresh()
    }
  },

  /** Used after a profile save, so the header reflects a changed name immediately. */
  setUser: (user) => set({ user }),

  isAuthenticated: () => Boolean(get().user),
  isAdmin: () => get().user?.role === 'admin',
}))

// ── cart ───────────────────────────────────────────────────────────────────

const EMPTY_CART = {
  items: [],
  count: 0,
  subtotal: 0,
  subtotalFormatted: '₹ 0.00',
  discount: { amount: 0, amountFormatted: '₹ 0.00', code: null, label: null, freeShipping: false },
  shipping: { amount: 0, amountFormatted: '₹ 0.00', isFree: false },
  total: 0,
  totalFormatted: '₹ 0.00',
}

export const useCartStore = create((set, get) => ({
  cart: EMPTY_CART,
  loading: false,
  error: null,
  drawerOpen: false,

  /** Replace local state with the server's summary. Never merge — the server is truth. */
  apply(payload) {
    set({ cart: payload?.cart ?? EMPTY_CART, error: null })
  },

  async refresh() {
    set({ loading: true })
    try {
      const data = await api.cart.get()
      get().apply(data)
    } catch {
      set({ cart: EMPTY_CART })
    } finally {
      set({ loading: false })
    }
  },

  /**
   * Every mutation returns the recomputed cart, so one helper covers them all and no
   * caller can forget to replace the totals.
   */
  async mutate(fn) {
    set({ loading: true, error: null })
    try {
      const data = await fn()
      get().apply(data)
      return data
    } catch (error) {
      set({ error: error.message })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  add: (body) => get().mutate(() => api.cart.add(body)),
  update: (productId, body) => get().mutate(() => api.cart.update(productId, body)),
  remove: (productId, body) => get().mutate(() => api.cart.remove(productId, body)),
  applyCoupon: (code) => get().mutate(() => api.cart.applyCoupon(code)),
  removeCoupon: () => get().mutate(() => api.cart.removeCoupon()),

  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  clearError: () => set({ error: null }),
}))

// ── recently viewed (per-device UI state) ─────────────────────────────────

const RECENT_KEY = 'pp_recently_viewed'
const RECENT_LIMIT = 12

/**
 * Laravel kept this in the PHP session. It moved to the client because it is per-device UI
 * state with no business meaning — it never affects pricing, stock or any server decision.
 * The ids are passed back as `?ids=` so the server can resolve them.
 */
export const useRecentStore = create((set, get) => ({
  ids: (() => {
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
      return Array.isArray(raw) ? raw.slice(0, RECENT_LIMIT) : []
    } catch {
      return []
    }
  })(),

  push(productId) {
    const id = String(productId)
    const ids = [id, ...get().ids.filter((v) => v !== id)].slice(0, RECENT_LIMIT)
    set({ ids })
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(ids))
    } catch {
      // Private browsing or blocked storage — a lost recently-viewed list is not an error.
    }
  },

  exclude: (productId) => get().ids.filter((v) => v !== String(productId)),
}))

// ── header offers ──────────────────────────────────────────────────────────

/**
 * The coupon ticker across the top of every page.
 *
 * Laravel injected these into every view through a `View::composer`, so they were free.
 * Here they are one request made once at boot and then held, rather than per page —
 * publicly advertisable coupons change on a human timescale, not a per-navigation one.
 */
export const useOffersStore = create((set, get) => ({
  offers: [],
  loaded: false,

  async load() {
    if (get().loaded) return
    try {
      const { coupons } = await api.cart.publicCoupons()
      set({ offers: coupons ?? [], loaded: true })
    } catch {
      // The header falls back to "SHOP NEW ARRIVALS", exactly as the @empty branch did.
      set({ loaded: true })
    }
  },
}))

// ── site config ────────────────────────────────────────────────────────────

export const useConfigStore = create((set, get) => ({
  config: { appName: 'The Purple Panther', currency: 'INR' },
  categories: [],
  loaded: false,

  async load() {
    if (get().loaded) return
    try {
      const [config, { categories }] = await Promise.all([
        api.misc.config(),
        api.catalog.categories(),
      ])
      set({ config, categories, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },
}))
