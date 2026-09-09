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
