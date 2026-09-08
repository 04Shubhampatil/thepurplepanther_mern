import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

/**
 * Section title with an optional "view all" link.
 * Matches the live site: 30px / 600 / +0.03em tracking on #1D1D1D.
 */
export default function SectionHeading({
  title,
  eyebrow = null,
  subtitle = null,
  to = null,
  linkLabel = 'View all',
  align = 'left',
  className = '',
}) {
  const centred = align === 'center'

  return (
    <div
      className={`mb-8 flex flex-col gap-3 md:mb-10 ${
        centred ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between'
      } ${className}`}
    >
      <div className={centred ? 'max-w-2xl' : ''}>
        {eyebrow && <p className="pp-eyebrow mb-2 text-brand">{eyebrow}</p>}
        <h2 className="pp-heading">{title}</h2>
        {subtitle && <p className="mt-2 max-w-xl text-body">{subtitle}</p>}
      </div>

      {to && (
        <Link
          to={to}
          className="group inline-flex shrink-0 items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink transition-colors hover:text-brand"
        >
          {linkLabel}
          <ArrowRight
            size={16}
            strokeWidth={1.5}
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:translate-x-1"
          />
        </Link>
      )}
    </div>
  )
}
