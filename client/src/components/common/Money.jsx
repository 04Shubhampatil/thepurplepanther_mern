/**
 * Renders a formatted amount.
 *
 * ALWAYS pass the server's pre-formatted string. The client must not format currency
 * itself: the server is the single source of truth for money, and a second implementation
 * is a second thing to drift (brief §32).
 */
export default function Money({ formatted, amount = null, className = '' }) {
  if (formatted) return <span className={className}>{formatted}</span>
  // Fallback only for values the API did not pre-format.
  if (amount === null || amount === undefined) return null
  return <span className={className}>{`₹ ${Number(amount).toFixed(2)}`}</span>
}
