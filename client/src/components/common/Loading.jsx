export default function Loading({ full = false, label = 'Loading…' }) {
  return (
    <div
      className={full ? 'pp-loading pp-loading--full' : 'pp-loading'}
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: full ? '120px 20px' : '40px 20px',
        minHeight: full ? '60vh' : undefined,
      }}
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" style={{ opacity: 0.6 }}>
        {label}
      </span>
    </div>
  )
}
