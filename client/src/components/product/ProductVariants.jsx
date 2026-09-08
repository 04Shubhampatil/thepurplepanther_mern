/**
 * Colour, size and pack selectors.
 *
 * Out-of-stock options are shown disabled rather than hidden, so a customer can see the
 * variant exists and is simply unavailable — which is what the live site does.
 *
 * Colour values are upper-cased to match the server's `resolveVariants`, which upper-cases
 * the default colour. A mismatch there means the selected variant fails to match its
 * gallery, and add-to-cart returns a 422 the customer cannot act on.
 */
function OptionGroup({ legend, options, value, onChange, getLabel, getValue, getStock }) {
  if (!options?.length) return null

  return (
    <fieldset className="mt-6">
      <legend className="pp-eyebrow mb-3 text-ink">
        {legend}
        {value && <span className="ml-2 normal-case tracking-normal text-body">{value}</span>}
      </legend>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const optionValue = getValue(option)
          const stock = getStock ? Number(getStock(option)) : null
          const disabled = stock !== null && stock < 1
          const selected = value === optionValue

          return (
            <button
              key={option.id ?? optionValue}
              type="button"
              onClick={() => onChange(optionValue)}
              disabled={disabled}
              aria-pressed={selected}
              title={disabled ? `${getLabel(option)} — out of stock` : getLabel(option)}
              className={`relative min-w-[52px] border px-4 py-2.5 text-[13px] transition-colors duration-150 ${
                selected
                  ? 'border-brand bg-brand text-white'
                  : 'border-line text-ink hover:border-ink'
              } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
            >
              {getLabel(option)}
              {disabled && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 grid place-items-center"
                >
                  <span className="h-px w-full rotate-[-18deg] bg-current opacity-60" />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export default function ProductVariants({
  product,
  color,
  size,
  packageKey,
  onColor,
  onSize,
  onPackage,
}) {
  return (
    <>
      <OptionGroup
        legend="Colour"
        options={product.colors}
        value={color}
        onChange={onColor}
        getLabel={(c) => c.name}
        // Upper-cased to match the server's default-variant resolution.
        getValue={(c) => String(c.name).toUpperCase()}
        getStock={(c) => c.quantity}
      />

      <OptionGroup
        legend="Size"
        options={product.sizes}
        value={size}
        onChange={onSize}
        getLabel={(s) => s.name}
        getValue={(s) => s.name}
        getStock={(s) => s.quantity}
      />

      {/*
        Packs apply only to the accessories category. The price shown is the server's; it
        is re-resolved from the product row on every add, so a tampered value has no effect.
      */}
      <OptionGroup
        legend="Pack"
        options={product.accessoryPackages}
        value={packageKey}
        onChange={onPackage}
        getLabel={(p) => p.label}
        getValue={(p) => p.key}
      />
    </>
  )
}
