/** Route-level loading state. Kept quiet — a spinner on every navigation reads as slow. */
export default function Loading({ full = false, label = 'Loading' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center ${full ? 'min-h-[60vh] py-24' : 'py-12'}`}
    >
      <span className="sr-only">{label}</span>
      <span
        aria-hidden="true"
        className="size-6 animate-spin rounded-full border-2 border-line border-t-brand"
      />
    </div>
  )
}
