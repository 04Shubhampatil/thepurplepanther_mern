import { Star } from 'lucide-react'

/**
 * Star rating.
 *
 * lucide's Star rather than the ★/☆ characters the Blade templates used: the glyphs
 * render differently in every font (and as emoji on some platforms), and a screen reader
 * announces them as "black star, black star…". Here the stars are decorative and the
 * rating is given once, as text, in the accessible name.
 */
export default function Rating({ value = 0, size = 15, showValue = false, className = '' }) {
  const rounded = Math.round(value)

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-brand ${className}`}
      role="img"
      aria-label={`${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          strokeWidth={1.5}
          aria-hidden="true"
          className={star <= rounded ? 'fill-current' : 'text-line'}
        />
      ))}

      {showValue && <span className="ml-1.5 text-[13px] text-body">{value}</span>}
    </span>
  )
}
