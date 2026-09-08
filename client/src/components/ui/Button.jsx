import { Link } from 'react-router-dom'

/**
 * Button / link.
 *
 * Square corners are deliberate — the live site uses `border-radius: 0` throughout, and
 * rounding them would be a redesign rather than a migration.
 *
 * Renders a real <button>, <a> or <Link> depending on what it does, so keyboard and
 * assistive-technology behaviour comes for free instead of being reconstructed.
 */

const VARIANTS = {
  primary: 'bg-brand text-white hover:bg-brand-soft',
  outline: 'border border-ink text-ink hover:bg-ink hover:text-white',
  light: 'border border-white/70 text-white hover:bg-white hover:text-brand',
  ghost: 'text-ink hover:text-brand underline-offset-4 hover:underline',
}

const SIZES = {
  sm: 'px-6 py-3 text-[13px]',
  // Matches the live hero button: 20px / 36px padding, 16px, 600.
  md: 'px-9 py-5 text-[15px]',
  lg: 'px-12 py-5 text-[16px]',
}

export default function Button({
  as,
  to,
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  disabled = false,
  loading = false,
  ...props
}) {
  const classes = [
    'inline-flex items-center justify-center gap-2 font-semibold tracking-[0.02em]',
    'transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[variant] ?? VARIANTS.primary,
    SIZES[size] ?? SIZES.md,
    className,
  ].join(' ')

  const content = loading ? (
    <>
      <span
        className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden="true"
      />
      {children}
    </>
  ) : (
    children
  )

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {content}
      </Link>
    )
  }

  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {content}
      </a>
    )
  }

  const Tag = as ?? 'button'
  return (
    <Tag
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {content}
    </Tag>
  )
}
