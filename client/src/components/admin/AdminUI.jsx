import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, Check, Loader2, X } from 'lucide-react'

/**
 * The admin panel's shared primitives, sized from public/css/admin.css.
 *
 * Every class list here is a transcription of a rule in that file, so the numbers are not
 * design decisions and should not be "tidied":
 *
 *   .card        white, radius 10px, padding 18px, shadow 0 2px 10px rgba(0,0,0,.04)
 *   .btn         radius 6px, padding 10px 16px, 13px/600
 *   .btn-sm      padding 6px 10px, 12px
 *   .btn-danger  white ground, primary text, 1px #f8bbd0 border — NOT a red fill
 *   .table       th/td padding 12px 10px, 1px #eee rule, 14px; th #777 on #fafafa
 *   .page-head   space-between, 12px gap, 18px bottom margin, wraps
 *
 * `.btn-danger` is worth calling out because the name misleads: in this admin a "danger"
 * button is a quiet outline, not a red block, and rendering it red would make every delete
 * row shout.
 */

// ── layout ────────────────────────────────────────────────────────────────

export function Card({ className = '', children, ...props }) {
  return (
    <div
      className={`rounded-[10px] bg-white p-[18px] shadow-admin-card ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function PageHead({ title, children }) {
  return (
    <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-[20px] font-semibold text-[#333]">{title}</h2>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  )
}

// ── buttons ───────────────────────────────────────────────────────────────

/*
 * No `border-0` here.
 *
 * `.btn` sets `border: none` and `.btn-light` / `.btn-danger` then add one, which works in
 * CSS because the later rule wins. Tailwind utilities are all one class, so `border-0` and
 * `border` are the same specificity and EMISSION order decides — and `border-0` is emitted
 * last, so it silently flattened every bordered variant. The borderless variants say so
 * themselves instead.
 */
const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-semibold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-60'

const BUTTON_SIZES = {
  md: 'px-4 py-[10px] text-[13px]',
  sm: 'px-[10px] py-1.5 text-[12px]',
}

const BUTTON_VARIANTS = {
  primary: 'border-0 bg-admin-primary text-white hover:bg-admin-primary-dark',
  light: 'border border-[#ddd] bg-white text-[#555] hover:bg-[#f7f7f7]',
  danger: 'border border-[#f8bbd0] bg-white text-admin-primary hover:bg-[#fff5f8]',
  dark: 'border-0 bg-[#2a3140] text-white hover:bg-[#1f2430]',
}

export function Button({ variant = 'primary', size = 'md', className = '', loading, children, ...props }) {
  return (
    <button
      className={`${BUTTON_BASE} ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : null}
      {children}
    </button>
  )
}

// ── tables ────────────────────────────────────────────────────────────────

/**
 * `.table` sets `min-width: 520px` and the admin wraps it in a horizontally scrolling box,
 * which is how the Laravel panel behaves on a narrow screen. Reproduced rather than swapped
 * for a stacked card layout, because that is a redesign.
 */
export function Table({ children, className = '' }) {
  return (
    <div className="-mx-[18px] overflow-x-auto px-[18px]">
      <table className={`w-full min-w-[520px] border-collapse ${className}`}>{children}</table>
    </div>
  )
}

export function Th({ className = '', children, ...props }) {
  return (
    <th
      className={`border-b border-admin-line bg-[#fafafa] px-[10px] py-3 text-left text-[14px] font-semibold text-admin-muted ${className}`}
      {...props}
    >
      {children}
    </th>
  )
}

export function Td({ className = '', children, ...props }) {
  return (
    <td className={`border-b border-admin-line px-[10px] py-3 text-left text-[14px] ${className}`} {...props}>
      {children}
    </td>
  )
}

export function TableEmpty({ colSpan, children = 'No records found.' }) {
  return (
    <tr>
      <Td colSpan={colSpan} className="py-10 text-center text-admin-muted">
        {children}
      </Td>
    </tr>
  )
}

export function TableLoading({ colSpan }) {
  return (
    <tr>
      <Td colSpan={colSpan} className="py-10 text-center text-admin-muted">
        <span className="inline-flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </span>
      </Td>
    </tr>
  )
}

// ── status badges ─────────────────────────────────────────────────────────

/**
 * admin.css defines one class per order status with its own pair of colours. They are
 * transcribed rather than generated from a palette, because the set is closed and the exact
 * pairings are what make a status scannable at a glance.
 */
const BADGE_STATUS = {
  placed: 'bg-[#eceff1] text-[#546e7a]',
  pending: 'bg-[#eceff1] text-[#546e7a]',
  packed: 'bg-[#e3f2fd] text-[#1565c0]',
  shipped: 'bg-[#fff3e0] text-[#ef6c00]',
  delivered: 'bg-[#e8f5e9] text-[#2e7d32]',
  cancelled: 'bg-[#ffebee] text-[#c62828]',
}

export function StatusBadge({ status, children }) {
  const key = String(status ?? '').toLowerCase()
  const tone = BADGE_STATUS[key] ?? 'bg-[#eceff1] text-[#546e7a]'

  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-[12px] font-semibold capitalize ${tone}`}>
      {children ?? status}
    </span>
  )
}

/** The active/inactive pill used on every master-data list. */
export function ActiveBadge({ active }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[12px] font-semibold ${
        active ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-[#eceff1] text-[#546e7a]'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

// ── forms ─────────────────────────────────────────────────────────────────

export function Field({ label, required, error, hint, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[13px] font-semibold text-[#444]">
        {label}
        {required ? <span className="text-admin-primary"> *</span> : null}
      </span>
      {children}
      {hint && !error ? <span className="mt-1 block text-[12px] text-admin-muted">{hint}</span> : null}
      {error ? <span className="mt-1 block text-[12px] text-[#c62828]">{error}</span> : null}
    </label>
  )
}

const CONTROL =
  'w-full rounded-md border border-[#ddd] bg-white px-3 py-2 text-[14px] outline-none transition-colors focus:border-admin-primary disabled:bg-[#f7f7f7]'

export function Input({ className = '', invalid, ...props }) {
  return <input className={`${CONTROL} ${invalid ? 'border-[#c62828]' : ''} ${className}`} {...props} />
}

export function Textarea({ className = '', invalid, ...props }) {
  return <textarea className={`${CONTROL} ${invalid ? 'border-[#c62828]' : ''} ${className}`} {...props} />
}

export function Select({ className = '', invalid, children, ...props }) {
  return (
    <select className={`${CONTROL} ${invalid ? 'border-[#c62828]' : ''} ${className}`} {...props}>
      {children}
    </select>
  )
}

export function Checkbox({ label, className = '', ...props }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 text-[14px] ${className}`}>
      <input type="checkbox" className="size-4 accent-admin-primary" {...props} />
      {label}
    </label>
  )
}

// ── modal + confirm ───────────────────────────────────────────────────────

/**
 * Motion is used here and nowhere heavier: a fade on the backdrop and a short rise on the
 * panel. The brief asks for subtle transitions on modals and drawers and explicitly not for
 * decoration, so this is the whole animation budget for the admin.
 */
export function Modal({ open, title, onClose, children, footer, width = 'max-w-[640px]' }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose?.()
          }}
        >
          <motion.div
            className={`w-full ${width} rounded-[10px] bg-white shadow-xl`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-admin-line px-[18px] py-3.5">
              <h3 className="text-[16px] font-semibold">{title}</h3>
              <button type="button" onClick={onClose} aria-label="Close" className="text-admin-muted hover:text-[#333]">
                <X size={18} />
              </button>
            </div>
            <div className="p-[18px]">{children}</div>
            {footer ? (
              <div className="flex justify-end gap-2 border-t border-admin-line px-[18px] py-3">{footer}</div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

/**
 * The global delete confirmation from layouts/app.blade.php: one question, CANCEL and
 * PROCEED. The wording and the upper case are the original's — it is the last thing shown
 * before something is destroyed, so it is reproduced exactly rather than softened.
 */
export function ConfirmDialog({ open, title = 'Are you sure?', onCancel, onProceed, busy }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onCancel?.()
          }}
        >
          <motion.div
            className="w-full max-w-[380px] rounded-[10px] bg-white p-6 text-center shadow-xl"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
          >
            <AlertTriangle size={28} className="mx-auto mb-3 text-admin-primary" />
            <h3 className="mb-5 text-[17px] font-semibold">{title}</h3>
            <div className="flex justify-center gap-2.5">
              <Button variant="light" onClick={onCancel}>CANCEL</Button>
              <Button variant="primary" onClick={onProceed} loading={busy} disabled={busy}>PROCEED</Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

// ── alerts ────────────────────────────────────────────────────────────────

export function Alert({ tone = 'error', children, onDismiss }) {
  if (!children) return null

  const tones = {
    error: 'border-[#f5c2c7] bg-[#fdecee] text-[#c62828]',
    success: 'border-[#badbcc] bg-[#e8f5e9] text-[#2e7d32]',
    info: 'border-[#b6d4fe] bg-[#e3f2fd] text-[#1565c0]',
  }

  return (
    <div className={`mb-4 flex items-start gap-2 rounded-md border px-3.5 py-2.5 text-[13px] ${tones[tone]}`}>
      {tone === 'success' ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
      <div className="flex-1">{children}</div>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100">
          <X size={14} />
        </button>
      ) : null}
    </div>
  )
}

// ── pagination ────────────────────────────────────────────────────────────

/**
 * Laravel paginated most admin lists at 15 and printed "Showing x to y of z". Both the
 * window and that line are reproduced so the footer reads the same.
 */
export function Pagination({ page, lastPage, total, perPage, onChange }) {
  if (!total) return null

  const from = (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  const pages = []
  const push = (value) => {
    if (pages[pages.length - 1] !== value) pages.push(value)
  }

  if (lastPage <= 9) {
    for (let i = 1; i <= lastPage; i += 1) push(i)
  } else {
    push(1)
    if (page - 2 > 2) push('…')
    for (let i = Math.max(2, page - 2); i <= Math.min(lastPage - 1, page + 2); i += 1) push(i)
    if (page + 2 < lastPage - 1) push('…')
    push(lastPage)
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-[13px] text-admin-muted">
        Showing {from} to {to} of {total}
      </p>
      {lastPage > 1 ? (
        <div className="flex flex-wrap items-center gap-1">
          <Button size="sm" variant="light" disabled={page <= 1} onClick={() => onChange(page - 1)}>Prev</Button>
          {pages.map((entry, index) =>
            entry === '…' ? (
              <span key={`gap-${index}`} className="px-1.5 text-[12px] text-admin-muted">…</span>
            ) : (
              <Button
                key={entry}
                size="sm"
                variant={entry === page ? 'primary' : 'light'}
                onClick={() => onChange(entry)}
              >
                {entry}
              </Button>
            ),
          )}
          <Button size="sm" variant="light" disabled={page >= lastPage} onClick={() => onChange(page + 1)}>Next</Button>
        </div>
      ) : null}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Aliases for Resource.jsx — the ONLY page still importing them.
//
// Every screen with a Blade counterpart has been rebuilt against it; Resource.jsx is not
// one of those. It is the generic `/admin/:resource` fallback, and what it actually serves
// is the Brands module, which layouts/app.blade.php hides behind `$showBrands = false`.
// Rebuilding a hidden screen against a Blade view nobody can reach would be work for its
// own sake, so the page and these four aliases stay together.
//
// Nothing new should import from this block.
// ─────────────────────────────────────────────────────────────────────────

export const AdminButton = Button
export const Pill = ActiveBadge
export { CONTROL }

export function AdminPage({ title, actions, children }) {
  return (
    <>
      <PageHead title={title}>{actions}</PageHead>
      {children}
    </>
  )
}

export function AdminSection({ className = '', children }) {
  return <Card className={className}>{children}</Card>
}

export function EmptyRow({ colSpan, children }) {
  return <TableEmpty colSpan={colSpan}>{children}</TableEmpty>
}
