import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'

/**
 * Controls shared by the admin list screens, sized from admin.css.
 *
 * `.search-box` is a white box with a 1px #e0e0e0 border at 6px radius, 8px/12px padding
 * and an 8px gap, holding a borderless input. The icon is inside the box rather than
 * floated over it, which is how the Blade markup has it — a `<span>🔍</span>` beside the
 * input, both children of the same flex row.
 *
 * `.switch` is a 42×22 track with a 16px knob inset 3px, grey when off and --primary when
 * on, sliding 20px. It is a real checkbox behind a styled label so it stays keyboard
 * reachable, exactly as the original was.
 */

export function AdminSearch({ value, onChange, placeholder = 'Search here...' }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[#e0e0e0] bg-white px-3 py-2 max-sm:w-full">
      <Search size={16} className="shrink-0 text-admin-muted" />
      <input
        type="text"
        name="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full min-w-[160px] border-none bg-transparent text-[14px] outline-none max-sm:min-w-0"
      />
    </div>
  )
}

/** `.btn.btn-primary` as a router link — the "Add New" control in every page head. */
export function AddNewButton({ to, children = 'Add New' }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center rounded-md bg-admin-primary px-4 py-[10px] text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-dark"
    >
      {children}
    </Link>
  )
}

/**
 * `.switch` / `.slider`.
 *
 * In Blade this was a checkbox whose `onchange` submitted a one-field form, so flipping it
 * reloaded the page. Here it calls the toggle endpoint and refetches — same request, same
 * result, without the reload.
 */
export function Toggle({ checked, onChange, title, disabled }) {
  return (
    <label className="relative inline-block h-[22px] w-[42px] shrink-0" title={title}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="peer size-0 opacity-0"
      />
      <span
        className={`absolute inset-0 cursor-pointer rounded-full transition-colors ${
          checked ? 'bg-admin-primary' : 'bg-[#ccc]'
        } peer-disabled:cursor-not-allowed peer-disabled:opacity-60`}
      >
        <span
          className={`absolute bottom-[3px] left-[3px] size-4 rounded-full bg-white transition-transform duration-200 ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </span>
    </label>
  )
}

/*
 * `.inline-form` and friends — the add/edit form that sits above the table on the
 * master-data screens (Colors, Sizes, Sub-Categories).
 *
 * It is a GRID, not a flex row: `repeat(auto-fit, minmax(160px, 1fr))` at a 12px gap, which
 * is why the fields share the width evenly and wrap together rather than each shrinking to
 * its content. `.form-actions` carries `padding-top: 22px` to clear the label height so Save
 * lands on the inputs' baseline instead of above them.
 *
 * Controls are 42px tall with 11px/12px padding; labels are 13px/600 in #666 with a 6px
 * gap and a 16px minimum height, so a field with no label still lines up with one that has.
 */

export function FormGrid({ children, className = '', ...props }) {
  return (
    <form
      className={`grid grid-cols-1 items-start gap-3 min-[576px]:grid-cols-[repeat(auto-fit,minmax(160px,1fr))] ${className}`}
      {...props}
    >
      {children}
    </form>
  )
}

export function FormGroup({ label, children, error }) {
  return (
    <div className="flex min-w-0 flex-col">
      {label ? (
        <label className="mb-1.5 block min-h-4 text-[13px] font-semibold leading-[1.2] text-[#666]">{label}</label>
      ) : null}
      {children}
      {error ? <span className="mt-1 text-[12px] text-[#e53935]">{error}</span> : null}
    </div>
  )
}

/** `.form-group input` — 42px, 11px/12px, 1px #ddd at 6px radius. */
export const FORM_CONTROL =
  'h-[42px] w-full rounded-md border border-[#ddd] bg-white px-3 py-[11px] text-[14px] outline-none transition-colors focus:border-admin-primary'

export function FormActions({ children }) {
  return (
    <div className="flex min-h-[42px] flex-wrap items-center gap-2 pt-[22px]">{children}</div>
  )
}

/**
 * `.btn-edit` — white ground, #1e88e5 text, 1px #90caf9. The only blue control in the panel,
 * and deliberately not the pink primary: on these rows Edit and Delete sit side by side and
 * the colours are what separate a safe action from a destructive one.
 */
export function EditButton({ onClick, children = 'Edit' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-md border border-[#90caf9] bg-white px-[10px] py-1.5 text-[12px] font-semibold text-[#1e88e5] transition-colors hover:bg-[#e3f2fd]"
    >
      {children}
    </button>
  )
}

/** `.color-dot` — 22px circle, 1px #ddd, 8px to the right of it. */
export function ColorDot({ code }) {
  return (
    <span
      className="mr-2 inline-block size-[22px] shrink-0 rounded-full border border-[#ddd] align-middle"
      style={{ background: code || '#ccc' }}
    />
  )
}
