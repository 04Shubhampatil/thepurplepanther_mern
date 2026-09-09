import { create } from 'zustand'

/**
 * Chrome state that used to live in the DOM.
 *
 * script.js coordinated the mobile menu and the search overlay by toggling classes from
 * delegated jQuery handlers — `.menubar` added `mm-menu_opened`, `.cart-search-btn` added
 * `.show` to `.search-16-wrap`, and the mmenu API closed one when the other opened. With
 * jQuery gone, the trigger (in the header) and the panel (rendered elsewhere, or into a
 * portal) have no DOM relationship left, so the open/closed state has to be shared here.
 *
 * Opening one closes the others, which is what the original did: the menu's search button
 * called `api.close()` before the overlay appeared, and site-drawers.js began every open
 * with `closeDrawers(false)`.
 *
 * `accountReturn` is site-drawers.js's `pp_account_return` — where to land after signing
 * in. The wishlist heart sets it so that saving something as a guest takes you to your
 * wishlist afterwards rather than dropping you on the account overview.
 */
export const useUiStore = create((set) => ({
  menuOpen: false,
  searchOpen: false,
  accountOpen: false,
  accountReturn: null,

  openMenu: () => set({ menuOpen: true, searchOpen: false, accountOpen: false }),
  closeMenu: () => set({ menuOpen: false }),

  openSearch: () => set({ searchOpen: true, menuOpen: false, accountOpen: false }),
  closeSearch: () => set({ searchOpen: false }),

  openAccount: (accountReturn = null) =>
    set({ accountOpen: true, menuOpen: false, searchOpen: false, accountReturn }),
  closeAccount: () => set({ accountOpen: false }),

  closeAll: () => set({ menuOpen: false, searchOpen: false, accountOpen: false }),
}))

export default useUiStore
