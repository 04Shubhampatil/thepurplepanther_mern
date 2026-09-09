import { create } from 'zustand'

/**
 * Admin toasts — public/js/toast.js.
 *
 * In Laravel every write redirected and the layout turned the flash bag into a toast:
 * `Toast.success(session('success'))`, `Toast.error(session('error'))` and
 * `Toast.error($errors->first())`. So the message the admin sees is the one the CONTROLLER
 * wrote, not one the page invents — the API's `message` field carries it here for the same
 * reason.
 *
 * Auto-dismiss is 4s with a 250ms fade, matching toast.js's two timers. The store holds the
 * queue; the fade lives in the component, because a toast that is on its way out is still in
 * the DOM and cannot be dropped from state yet.
 */

let nextId = 0

export const useToastStore = create((set) => ({
  toasts: [],

  push: (message, tone = 'info') => {
    if (!message) return null

    const id = ++nextId
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }))
    return id
  },

  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  clear: () => set({ toasts: [] }),
}))

/**
 * The `window.Toast` shape, callable from anywhere — including outside a component, which
 * is where most of these fire (an await in a submit handler).
 */
export const toast = {
  success: (message) => useToastStore.getState().push(message, 'success'),
  error: (message) => useToastStore.getState().push(message, 'error'),
  info: (message) => useToastStore.getState().push(message, 'info'),
  show: (message, tone) => useToastStore.getState().push(message, tone),
}

export default toast
