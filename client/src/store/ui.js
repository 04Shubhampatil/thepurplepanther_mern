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
 * Opening one closes the other, which is what the original did: the menu's search button
 * called `api.close()` before the overlay appeared.
 */
export const useUiStore = create((set) => ({
  menuOpen: false,
  searchOpen: false,

  openMenu: () => set({ menuOpen: true, searchOpen: false }),
  closeMenu: () => set({ menuOpen: false }),

  openSearch: () => set({ searchOpen: true, menuOpen: false }),
  closeSearch: () => set({ searchOpen: false }),

  closeAll: () => set({ menuOpen: false, searchOpen: false }),
}))

export default useUiStore
