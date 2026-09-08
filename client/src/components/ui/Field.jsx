/**
 * Form primitives.
 *
 * One implementation of label + control + error, so every form on the site is consistent
 * and accessible by construction: the label is always associated, the error is always
 * linked with aria-describedby, and aria-invalid is always set.
 *
 * Square borders and the brand focus ring match the live site.
 */
const CONTROL =
  'w-full border border-line bg-white px-4 py-3 text-[14px] text-ink transition-colors ' +
  'placeholder:text-body/60 focus:border-brand focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-sand aria-[invalid=true]:border-red-600'

export function Field({ label, htmlFor, error, hint, required, className = '', children }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] text-ink">
          {label}
          {required && (
            <span className="text-brand" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
      )}

      {children}

      {hint && !error && <p className="mt-1 text-[12px] text-body">{hint}</p>}

      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1 text-[12px] text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

export function Input({ id, error, className = '', ...props }) {
  return (
    <input
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      className={`${CONTROL} ${className}`}
      {...props}
    />
  )
}

export function Textarea({ id, error, className = '', rows = 4, ...props }) {
  return (
    <textarea
      id={id}
      rows={rows}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      className={`${CONTROL} ${className}`}
      {...props}
    />
  )
}

export function Select({ id, error, className = '', children, ...props }) {
  return (
    <select
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      className={`${CONTROL} ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

export function Checkbox({ id, label, className = '', ...props }) {
  return (
    <div className={`flex items-start gap-2.5 ${className}`}>
      <input
        id={id}
        type="checkbox"
        className="mt-1 size-4 shrink-0 accent-brand"
        {...props}
      />
      <label htmlFor={id} className="text-[14px] text-ink">
        {label}
      </label>
    </div>
  )
}

export default Field
