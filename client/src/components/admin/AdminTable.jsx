import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'

/**
 * The table furniture the Users, Orders and Contacts lists share.
 *
 * These screens use `.admin-table` rather than the `.table` the master-data screens use —
 * 10px/12px cells at 13px on a #f0f0f0 rule, with a #fafafa head in 700 weight #666. The two
 * are not interchangeable and the source uses both, so both exist here.
 */

/** `.admin-table` — note the 13px, one step down from `.table`'s 14px. */
export function DataTable({ caption, children, className = '' }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={`w-full border-collapse text-left ${className}`}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  )
}

export function DataTh({ className = '', children, ...props }) {
  return (
    <th
      scope="col"
      className={`border-b border-[#f0f0f0] bg-[#fafafa] px-3 py-2.5 align-middle text-[13px] font-bold text-[#666] ${className}`}
      {...props}
    >
      {children}
    </th>
  )
}

export function DataTd({ className = '', children, ...props }) {
  return (
    <td className={`border-b border-[#f0f0f0] px-3 py-2.5 align-middle text-[13px] ${className}`} {...props}>
      {children}
    </td>
  )
}

/**
 * `partials/sort-link.blade.php`.
 *
 * The arrow is part of the label, not a separate control: ⇅ when the column is not the one
 * being sorted, ▲/▼ when it is. Clicking an inactive column starts it ASCENDING — only a
 * second click on the already-active column flips it — which is the `$nextDir` line, and is
 * why this cannot be written as a plain toggle.
 */
export function SortTh({ column, label, sort, dir, onSort, className = '' }) {
  const active = sort === column
  const arrow = active ? (dir === 'asc' ? ' ▲' : ' ▼') : ' ⇅'

  return (
    <DataTh aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={className}>
      <button
        type="button"
        onClick={() => onSort(column, active && dir === 'asc' ? 'desc' : 'asc')}
        className={`inline-flex items-center gap-1 whitespace-nowrap font-bold ${
          active ? 'text-admin-primary' : 'text-inherit hover:text-admin-primary'
        }`}
      >
        {label}
        <span className="text-[10px] font-normal opacity-70">{arrow}</span>
      </button>
    </DataTh>
  )
}

/**
 * `.action-sq` — a 32px SQUARE at 4px radius, filled with its own colour and a white glyph.
 *
 * Deliberately not the `.icon-btn` circle the card grids use: on a dense table the fill is
 * what separates View (#42a5f5) from Edit (--primary) from Delete (#ff7043) at a glance.
 */
const ACTION_TONES = {
  view: 'bg-[#42a5f5] hover:bg-[#2196f3]',
  edit: 'bg-admin-primary hover:bg-admin-primary-dark',
  delete: 'bg-[#ff7043] hover:bg-[#f4511e]',
}

export function ActionSquare({ tone = 'view', as: As = 'button', className = '', children, ...props }) {
  return (
    <As
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded text-[13px] text-white transition-colors ${ACTION_TONES[tone]} ${className}`}
      {...(As === 'button' ? { type: 'button' } : {})}
      {...props}
    >
      {children}
    </As>
  )
}

/** `.product-search` — the 40px pill with the icon on the right. */
export function PanelSearch({ value, onChange, placeholder = 'Search here...' }) {
  return (
    <div className="flex h-10 min-w-[220px] items-center rounded-full border border-[#e0e0e0] bg-white pl-4 pr-1 max-sm:w-full">
      <input
        type="text"
        placeholder={placeholder}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 border-none bg-transparent text-[14px] text-[#555] outline-none placeholder:text-[#bdbdbd]"
      />
      <button type="button" aria-label="Search" className="inline-flex size-9 items-center justify-center rounded-full text-[#bdbdbd]">
        <Search size={16} />
      </button>
    </div>
  )
}

/** `.per-page-form select` — 38px at 6px radius. The four sizes are Laravel's whitelist. */
export const PER_PAGE_OPTIONS = [10, 25, 50, 100]

export function PerPageSelect({ value, onChange }) {
  return (
    <select
      aria-label="Rows per page"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-[38px] rounded-md border border-[#ddd] bg-white px-2.5 text-[14px] text-[#555] outline-none"
    >
      {PER_PAGE_OPTIONS.map((n) => (
        <option key={n} value={n}>{n}</option>
      ))}
    </select>
  )
}

/** `.select-all-label` — 13px/500 #555 beside a 15px box tinted with --primary. */
export function SelectAll({ checked, indeterminate, onChange }) {
  const ref = useRef(null)

  // `indeterminate` is a PROPERTY, not an attribute — React cannot set it from JSX, so the
  // partial-selection state has to be written to the node directly.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate) && !checked
  }, [indeterminate, checked])

  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[13px] font-medium text-[#555]">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-[15px] accent-admin-primary"
      />
      Select All
    </label>
  )
}

/**
 * `.bulk-action-wrap` — the Action button and its drop-down.
 *
 * Closes on an outside click, which the Blade's document-level listener did. Each item
 * carries its own confirm flag: Enable applies straight away while Disable and Delete go
 * through the confirm dialog, matching `js-bulk-confirm`.
 */
export function BulkActions({ items, onSelect, label = 'Action' }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const onDocumentClick = (event) => {
      if (!wrap.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('click', onDocumentClick)
    return () => document.removeEventListener('click', onDocumentClick)
  }, [open])

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-md bg-admin-primary px-[18px] text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-dark"
      >
        {label}
        <ChevronDown size={12} strokeWidth={3} aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+4px)] z-20 min-w-[200px] overflow-hidden rounded-lg border border-[#eee] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          {items.map((item) => (
            <button
              key={item.value}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onSelect(item)
              }}
              className="block w-full bg-white px-3.5 py-2.5 text-left text-[13px] text-[#333] transition-colors hover:bg-[#f7f7f7] hover:text-admin-primary"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/**
 * `.pagination-info` — "Showing 1 to 10 of 42 entries", and "0 to 0 of 0" when empty rather
 * than hidden, so the row does not jump when a filter empties the table.
 */
export function PaginationInfo({ pagination }) {
  const { page = 1, perPage = 10, total = 0 } = pagination ?? {}
  const first = total ? (page - 1) * perPage + 1 : 0
  const last = total ? Math.min(page * perPage, total) : 0

  return (
    <div className="text-[13px] text-[#777]">
      Showing {first} to {last} of {total} entries
    </div>
  )
}
