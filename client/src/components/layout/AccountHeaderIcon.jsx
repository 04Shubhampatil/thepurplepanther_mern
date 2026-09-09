import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/index.js'
import { useUiStore } from '../../store/ui.js'

/**
 * frontend/partials/account-header-icon.blade.php.
 *
 * Guest sees the outline person; a signed-in customer sees their initials. The Blade
 * version computed the initials with preg_split + mb_substr on the first two name parts —
 * the same rule is kept here so a two-word name still reads "AB" and a one-word name "A".
 *
 * A GUEST DOES NOT GO TO /login. site-drawers.js intercepted this button and slid the
 * "My account" panel over the page instead, so signing in never costs you the page you were
 * on. The href stays /login so the control still means something without JavaScript and to
 * middle-click into a full page.
 */
export default function AccountHeaderIcon() {
  const user = useAuthStore((s) => s.user)
  const openAccount = useUiStore((s) => s.openAccount)
  const loggedIn = Boolean(user) && user.role !== 'admin'

  const parts = String(user?.name ?? '').trim().split(/\s+/).filter(Boolean)
  const initials = loggedIn
    ? ((parts[0] ?? 'U').charAt(0) + (parts[1] ? parts[1].charAt(0) : '')).toUpperCase()
    : 'U'

  return (
    <Link
      to={loggedIn ? '/account/overview' : '/login'}
      className={`signin-cart-btn${loggedIn ? ' is-logged-in' : ''}`}
      aria-label={loggedIn ? 'My account' : 'Account'}
      {...(loggedIn ? { 'data-account-logged-in': '1' } : {})}
      onClick={
        loggedIn
          ? undefined
          : (event) => {
              event.preventDefault()
              openAccount()
            }
      }
    >
      {loggedIn ? (
          <span className="site-account-avatar" aria-hidden="true">{initials}</span>
        ) : (
          <svg className="site-account-icon-guest" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M7.99996 8.49967C5.88663 8.49967 4.16663 6.77967 4.16663 4.66634C4.16663 2.55301 5.88663 0.833008 7.99996 0.833008C10.1133 0.833008 11.8333 2.55301 11.8333 4.66634C11.8333 6.77967 10.1133 8.49967 7.99996 8.49967ZM7.99996 1.83301C6.43996 1.83301 5.16663 3.10634 5.16663 4.66634C5.16663 6.22634 6.43996 7.49967 7.99996 7.49967C9.55996 7.49967 10.8333 6.22634 10.8333 4.66634C10.8333 3.10634 9.55996 1.83301 7.99996 1.83301Z" fill="currentColor" />
          <path d="M13.7267 15.1667C13.4534 15.1667 13.2267 14.94 13.2267 14.6667C13.2267 12.3667 10.8801 10.5 8.00013 10.5C5.1201 10.5 2.77344 12.3667 2.77344 14.6667C2.77344 14.94 2.54677 15.1667 2.27344 15.1667C2.0001 15.1667 1.77344 14.94 1.77344 14.6667C1.77344 11.82 4.56676 9.5 8.00013 9.5C11.4335 9.5 14.2267 11.82 14.2267 14.6667C14.2267 14.94 14.0001 15.1667 13.7267 15.1667Z" fill="currentColor" />
        </svg>
        )}
        </Link>
  )
}
