const TONES = {
  brand: 'bg-brand text-white',
  light: 'bg-white/90 text-ink',
  muted: 'bg-ink/70 text-white',
  outline: 'border border-ink text-ink',
}

/** Small pill used for sale percentages, "New", and stock state on product cards. */
export default function Badge({ tone = 'brand', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${TONES[tone] ?? TONES.brand} ${className}`}
    >
      {children}
    </span>
  )
}
