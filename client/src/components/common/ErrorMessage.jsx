import { AlertCircle } from 'lucide-react'
import Button from '../ui/Button.jsx'

/** Inline error. `error` may be an ApiError or a plain string. */
export default function ErrorMessage({ error, onRetry = null }) {
  if (!error) return null
  const message = typeof error === 'string' ? error : error.message

  return (
    <div role="alert" className="flex flex-col items-start gap-3 border border-line bg-sand p-6">
      <p className="flex items-center gap-2 text-ink">
        <AlertCircle size={18} strokeWidth={1.5} aria-hidden="true" className="text-brand" />
        {message}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
