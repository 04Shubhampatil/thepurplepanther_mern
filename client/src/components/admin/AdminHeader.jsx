import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Menu } from 'lucide-react'

/** The bundled admin portrait — used when the account has no uploaded avatar of its own. */
const ADMIN_AVATAR = '/images/brand/admin_png.webp'

/**
 * The admin topbar — `.topbar` in admin.css: #2a3140, 58px minimum height, sticky, with the
 * hamburger and the wordmark on the left and the user menu on the right.
 *
 * The user dropdown reproduces the one the layout wired by hand: it opens on click, closes
 * on an outside click, and holds Profile and Logout. Clicks inside it are not allowed to
 * close it — the original called `stopPropagation` for exactly that reason, and without it
 * the Profile link closes the menu before the navigation lands.
 */
export default function AdminHeader({ user, onToggleSidebar, onLogout }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const onDocumentClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false)
    }

    document.addEventListener('click', onDocumentClick)
    return () => document.removeEventListener('click', onDocumentClick)
  }, [open])

  const initial = String(user?.name ?? 'A').charAt(0).toUpperCase()

  /*
   * The Blade shows `avatar_url` when the admin HAS an avatar and the initial otherwise.
   * The payload calls the field `avatar` (already resolved to a URL by utils/media.js) —
   * reading `avatarUrl` here meant the branch never taken and every admin got a letter.
   *
   * `ui-avatars.com` is `avatarUrl()`'s own fallback for a user with no file, and it is a
   * generated letter tile rather than a picture. Swapped for the bundled admin portrait, so
   * the header shows a face rather than a remote round-trip for an initial we already have.
   */
  const remoteFallback = 'https://ui-avatars.com/api/'
  const stored = user?.avatar
  const avatar = !stored || stored.startsWith(remoteFallback) ? ADMIN_AVATAR : stored

  return (
    <header className="sticky top-0 z-[15] flex min-h-[58px] items-center justify-between gap-2.5 bg-admin-topbar px-5 pl-[18px] text-white">
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Toggle menu" onClick={onToggleSidebar} className="min-[992px]:hidden">
          <Menu size={20} />
        </button>
        <h1 className="text-[17px] font-semibold">Purple Panther</h1>
      </div>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="true"
          onClick={(event) => {
            event.stopPropagation()
            setOpen((v) => !v)
          }}
          className="inline-flex max-w-[220px] items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-1"
        >
          {/* .avatar — 32px circle on --primary */}
          <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-admin-primary text-[13px] font-bold">
            {avatar ? (
              <img src={avatar} alt={user?.name ?? 'Admin'} className="size-full object-cover" />
            ) : (
              initial
            )}
          </span>
          <span className="truncate text-[14px]">{user?.name}</span>
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open ? (
          <div
            className="absolute right-0 top-[calc(100%+6px)] min-w-[160px] overflow-hidden rounded-lg bg-white py-1 text-[#333] shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <Link
              to="/admin/profile"
              className="block px-4 py-2.5 text-[13px] hover:bg-[#f4f5f7]"
              onClick={() => setOpen(false)}
            >
              Profile
            </Link>
            <button
              type="button"
              className="block w-full px-4 py-2.5 text-left text-[13px] text-admin-primary hover:bg-[#f4f5f7]"
              onClick={onLogout}
            >
              Logout
            </button>
          </div>
        ) : null}
      </div>
    </header>
  )
}
