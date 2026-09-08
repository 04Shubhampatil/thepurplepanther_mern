import { useId } from 'react'
import { Minus, Plus } from 'lucide-react'

/**
 * Quantity stepper.
 *
 * `max` is the server's per-variant limit — min(max_unit_buy, colour stock, size stock).
 * Clamping here keeps the UI honest, but the server re-validates on every add, so this is
 * a convenience rather than the control.
 *
 * The id is generated (or supplied) rather than fixed, because the cart renders one of
 * these per line and duplicate ids would break every label association on the page.
 */
export default function ProductQuantity({
  value,
  onChange,
  max = 99,
  disabled = false,
  id,
  label = 'Quantity',
  compact = false,
}) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  const set = (next) => onChange(Math.max(1, Math.min(max, next)))

  const size = compact ? 'size-9' : 'size-11'
  const button = `grid ${size} place-items-center text-ink transition-colors hover:text-brand disabled:cursor-not-allowed disabled:opacity-30`

  return (
    <div className="inline-flex items-center border border-line" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => set(value - 1)}
        disabled={disabled || value <= 1}
        className={button}
        aria-label={`Decrease ${label.toLowerCase()}`}
      >
        <Minus size={15} strokeWidth={1.5} aria-hidden="true" />
      </button>

      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <input
        id={inputId}
        type="number"
        min="1"
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => set(Number(e.target.value) || 1)}
        className={`${compact ? 'w-10 py-2' : 'w-12 py-2.5'} border-x border-line bg-transparent text-center text-[14px] text-ink focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />

      <button
        type="button"
        onClick={() => set(value + 1)}
        disabled={disabled || value >= max}
        className={button}
        aria-label={`Increase ${label.toLowerCase()}`}
      >
        <Plus size={15} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  )
}
