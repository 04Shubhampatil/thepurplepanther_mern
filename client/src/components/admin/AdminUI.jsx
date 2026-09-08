/**
 * Shared building blocks for the admin panel.
 *
 * The admin screens are dense, repetitive tables and forms. Putting the shell, the table
 * chrome and the small action buttons here keeps each page about its own data instead of
 * about layout, and guarantees they stay consistent with one another.
 *
 * Every table is wrapped in its own horizontal scroller: admin tables are wide by nature,
 * and without this the whole document scrolls sideways on a laptop.
 */

/** Page shell: title, optional description, optional right-hand actions. */
export function AdminPage({ title, description = null, actions = null, children }) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold text-ink">{title}</h1>
          {description && <p className="mt-1 text-[14px] text-body">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>

      <div className="mt-6">{children}</div>
    </div>
  )
}

/** Section within a page. */
export function AdminSection({ title, actions = null, className = '', children }) {
  return (
    <section className={className}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-[17px] font-semibold text-ink">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

/** Horizontally scrollable table wrapper. `caption` names the table for screen readers. */
export function Table({ caption, head, children }) {
  return (
    <div className="overflow-x-auto border border-line">
      <table className="w-full min-w-[640px] text-left text-[14px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-sand">
          <tr>{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Th({ className = '', children, ...props }) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap px-3 py-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink ${className}`}
      {...props}
    >
      {children}
    </th>
  )
}

export function Td({ className = '', children, ...props }) {
  return (
    <td className={`border-t border-line px-3 py-2.5 align-top text-ink ${className}`} {...props}>
      {children}
    </td>
  )
}

/** Row shown in place of the body when a query returns nothing. */
export function EmptyRow({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="border-t border-line px-3 py-8 text-center text-body">
        {children}
      </td>
    </tr>
  )
}

/** Compact button for in-table actions. */
export function AdminButton({
  variant = 'default',
  className = '',
  as: Tag = 'button',
  type = 'button',
  children,
  ...props
}) {
  const variants = {
    default: 'border-line text-ink hover:border-brand hover:text-brand',
    primary: 'border-brand bg-brand text-white hover:bg-brand-soft',
    danger: 'border-red-200 text-red-700 hover:border-red-600 hover:bg-red-50',
  }

  return (
    <Tag
      type={Tag === 'button' ? type : undefined}
      className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        variants[variant] ?? variants.default
      } ${className}`}
      {...props}
    >
      {children}
    </Tag>
  )
}

/** Status pill. Tone is chosen by the caller, since order/product states differ. */
export function Pill({ tone = 'neutral', children }) {
  const tones = {
    neutral: 'border-line text-body',
    brand: 'border-brand/30 bg-brand-tint text-brand',
    good: 'border-green-200 bg-green-50 text-green-800',
    warn: 'border-amber-200 bg-amber-50 text-amber-800',
    bad: 'border-red-200 bg-red-50 text-red-700',
  }

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap border px-2 py-0.5 text-[12px] ${
        tones[tone] ?? tones.neutral
      }`}
    >
      {children}
    </span>
  )
}

/** Stat tile for the dashboard. */
export function Stat({ label, value, hint = null }) {
  return (
    <div className="border border-line p-5">
      <p className="text-[13px] text-body">{label}</p>
      <p className="mt-1 text-[26px] font-semibold leading-tight text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-[12px] text-body">{hint}</p>}
    </div>
  )
}

/** Shared control classes, for the admin's ad-hoc inputs and selects. */
export const CONTROL =
  'border border-line bg-white px-3 py-2 text-[14px] text-ink placeholder:text-body/60 focus:border-brand focus:outline-none disabled:bg-sand'
