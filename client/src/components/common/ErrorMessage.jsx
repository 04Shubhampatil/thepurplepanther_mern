/** Inline error. `error` may be an ApiError or a plain string. */
export default function ErrorMessage({ error, onRetry = null }) {
  if (!error) return null
  const message = typeof error === 'string' ? error : error.message

  return (
    <div className="alert alert-danger" role="alert" style={{ margin: '16px 0' }}>
      {message}
      {onRetry && (
        <button type="button" className="btn btn-link" onClick={onRetry} style={{ marginLeft: 8 }}>
          Try again
        </button>
      )}
    </div>
  )
}
