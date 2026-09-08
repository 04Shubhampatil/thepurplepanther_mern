/**
 * "3 sizes" / "2 variants" — the meta line under a product card.
 *
 * Blade computed this inline with Str::plural: sizes win if the product has any, colours
 * are the fallback, and a product with neither shows nothing at all (not "0 sizes").
 */
export function variantLabel(product) {
  const sizes = product.sizes?.length ?? 0
  if (sizes > 0) return `${sizes} ${sizes === 1 ? 'size' : 'sizes'}`

  const colors = product.colors?.length ?? 0
  if (colors > 0) return `${colors} ${colors === 1 ? 'variant' : 'variants'}`

  return null
}

/** The default colour/size a "QUICK ADD" uses — the first of each, upper-cased for colour. */
export function defaultVariant(product) {
  return {
    color: product.colors?.[0]?.name ? String(product.colors[0].name).toUpperCase() : '',
    size: product.sizes?.[0]?.name ?? '',
  }
}
