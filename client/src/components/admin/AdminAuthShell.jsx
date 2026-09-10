import { useEffect } from 'react'
import { useAdminStylesheets } from '../../theme/adminChrome.js'

/**
 * admin/layouts/auth.blade.php + public/css/admin-auth.css.
 *
 * A standalone document in Laravel with its OWN stylesheet, and its own palette: the auth
 * screens are #391550 dark purple, not the #e91e63 pink the rest of the panel uses. Nothing
 * else in the admin is that colour, so the tokens live here rather than in admin.css.
 *
 * The logo carries `mix-blend-mode: multiply` so the PNG's white ground disappears against
 * the card — it is the same dark logo the sidebar inverts to white, used here as-is.
 */
const PURPLE = '#391550'
const PURPLE_DARK = '#2a103c'

/** The `.input-icon` glyphs, inlined exactly as the Blade has them. */
export const ICONS = {
  user: 'M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z',
  key: 'M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
  mail: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
}

/**
 * `.field-wrap` > `.input-group` + `.field-error`.
 *
 * The error slot is ALWAYS rendered, empty or not. `form-validation.js` creates it on init
 * (`prepareErrorSlots`) precisely so `min-height: 18px` reserves the space up front — without
 * it the fields shift down the moment a message appears, and the untouched form sits tighter
 * than the real one.
 *
 * Three classes move together when a field fails: `.field-wrap.has-error`,
 * `.input-group.has-error` (the red border) and `input.is-invalid` (a #fff8f8 tint).
 */
export function AuthField({ icon, error, ...props }) {
  return (
    <div className="mb-3.5">
      <div
        className={`flex items-stretch overflow-hidden rounded border transition-colors ${
          error ? 'border-[#e53935]' : 'border-[#ddd]'
        }`}
      >
        <span className="flex w-12 shrink-0 items-center justify-center border-r border-[#ddd] bg-[#f3f3f3] text-[#777] max-[480px]:w-[42px]">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d={icon} />
          </svg>
        </span>
        <input
          className={`w-full min-w-0 flex-1 border-none px-3.5 py-[13px] text-[14px] text-[#333] outline-none placeholder:text-[#aaa] max-[480px]:px-2.5 max-[480px]:py-3 max-[480px]:text-[16px] ${
            error ? 'bg-[#fff8f8]' : ''
          }`}
          {...props}
        />
      </div>
      {/* `.field-error` — 12px #e53935, 6px above, and 18px tall even when empty */}
      <div aria-live="polite" className="mt-1.5 min-h-[18px] text-[12px] leading-[18px] text-[#e53935]">
        {error}
      </div>
    </div>
  )
}

/**
 * `FormValidator` — the rule kinds admin-auth.js actually uses, with its own messages
 * supplied per field by the caller.
 *
 * Validation runs on BLUR and on INPUT, not only on submit, which is what makes a message
 * clear itself as soon as the field is corrected.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateField(value, rules, values = {}) {
  const text = String(value ?? '').trim()

  for (const rule of rules) {
    if (rule.type === 'required' && text === '') return rule.message
    if (text === '') continue
    if (rule.type === 'min' && text.length < rule.value) return rule.message
    if (rule.type === 'email' && !EMAIL_RE.test(text)) return rule.message
    if (rule.type === 'match' && text !== String(values[rule.field] ?? '')) return rule.message
  }

  return ''
}

/** Validate every field at once; used on submit, where the first invalid one takes focus. */
export function validateAll(values, schema) {
  const errors = {}

  for (const [name, rules] of Object.entries(schema)) {
    const message = validateField(values[name], rules, values)
    if (message) errors[name] = message
  }

  return errors
}

/** `.auth-btn` — full width, 1px tracking, uppercase in the markup rather than by CSS. */
export function AuthButton({ children, ...props }) {
  return (
    <button
      className="w-full cursor-pointer rounded border-none p-3.5 text-[15px] font-bold tracking-[1px] text-white transition-colors disabled:cursor-not-allowed disabled:opacity-70 max-[480px]:p-[13px] max-[480px]:text-[14px]"
      style={{ background: PURPLE }}
      onMouseEnter={(event) => { event.currentTarget.style.background = PURPLE_DARK }}
      onMouseLeave={(event) => { event.currentTarget.style.background = PURPLE }}
      {...props}
    >
      {children}
    </button>
  )
}

/** `.auth-links` — a muted link that turns purple on hover. */
export function AuthLink({ to, children }) {
  return (
    <div className="mb-[22px] mt-1">
      <a
        href={to}
        onClick={(event) => {
          event.preventDefault()
          window.history.pushState({}, '', to)
          window.dispatchEvent(new PopStateEvent('popstate'))
        }}
        className="text-[13px] text-[#888] no-underline transition-colors hover:text-[#391550]"
      >
        {children}
      </a>
    </div>
  )
}

/** `.alert` — 13px, its own two tones, above the form. */
export function AuthAlert({ tone = 'error', children }) {
  if (!children) return null

  return (
    <div
      className={`mb-4 rounded px-3 py-2.5 text-[13px] ${
        tone === 'success' ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-[#fce4ec] text-[#c2185b]'
      }`}
    >
      {children}
    </div>
  )
}

export default function AdminAuthShell({ children }) {
  // The Blade served these outside the panel's stylesheet entirely; disabling the
  // storefront's here is the same isolation.
  useAdminStylesheets()

  // `.auth-body` is a full-height centred flex with its own radial ground. The panel's
  // `.admin-body` background would otherwise show through.
  useEffect(() => {
    const previous = document.body.style.cssText
    document.body.style.background = 'radial-gradient(circle at center, #f5f5f5 0%, #e8e8e8 100%)'
    return () => {
      document.body.style.cssText = previous
    }
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center p-5 font-[system-ui,'Segoe_UI',Tahoma,sans-serif] max-[480px]:items-start max-[480px]:p-3 max-[480px]:pt-10">
      {/* `.auth-card` — 420px, 8px radius, 0 8px 30px rgba(0,0,0,.08) */}
      <div className="w-full max-w-[420px] rounded-lg bg-white px-9 pb-9 pt-10 shadow-[0_8px_30px_rgba(0,0,0,0.08)] max-[480px]:rounded-md max-[480px]:px-[18px] max-[480px]:pb-6 max-[480px]:pt-7">
        <div className="mx-auto mb-1 text-center">
          <img
            src="/images/brand/logo-dark.png"
            alt="Purple Panther"
            className="mx-auto block h-auto w-full max-w-[180px] max-[480px]:max-w-[140px]"
            style={{ mixBlendMode: 'multiply' }}
          />
        </div>

        {/* `.auth-divider` — two rules either side of three rotated squares */}
        <div className="mb-7 mt-4 flex items-center justify-center gap-1.5">
          <span className="h-0.5 max-w-[90px] flex-1" style={{ background: PURPLE }} />
          {[0, 1, 2].map((i) => (
            <i
              key={i}
              className="inline-block size-2.5"
              /* The 45° turn IS the shape — a square without it. Set inline so it
                 cannot be dropped by a utility that loses the transform. */
              style={{ background: PURPLE, transform: 'rotate(45deg)' }}
            />
          ))}
          <span className="h-0.5 max-w-[90px] flex-1" style={{ background: PURPLE }} />
        </div>

        {children}
      </div>
    </div>
  )
}
