/**
 * frontend/partials/product-price.blade.php.
 *
 * Three states, and the class names matter as much as the numbers — `.pp-price__mrp`,
 * `.pp-price__discount` and `.pp-price__selling` are styled independently, and the
 * wrapper's modifier decides whether the row is laid out as one price or as a struck
 * original beside a saving:
 *
 *   no selling price  -> MRP alone, `pp-price--mrp-only`
 *   selling + saving  -> struck MRP, "-N%", selling price
 *   selling, no saving-> selling price alone
 *
 * The server sends both the formatted strings and the percent (utils/product-presenter.js),
 * so no price arithmetic happens in the browser — the same rule the cart follows.
 *
 * The struck MRP is shown only when the MRP is actually higher than the price. The Blade
 * partial derived its percent from that comparison alone, but the card payload's
 * `discountPercent` can come from an attached offer, so a product whose MRP equals its
 * selling price could otherwise render the same figure twice, one of them crossed out.
 */
export default function PpPrice({ product }) {
  const hasSelling = product.hasSellingPrice
  const discount = Number(product.discountPercent ?? 0)
  const mrp = Number(product.mrp)
  const price = Number(product.price)
  const hasSaving = discount > 0 && !(Number.isFinite(mrp) && Number.isFinite(price) && mrp <= price)

  return (
    <span className={`pp-price ${hasSelling ? 'pp-price--has-selling-price' : 'pp-price--mrp-only'}`}>
      {!hasSelling ? (
        <span className="pp-price__mrp">{product.mrpFormatted}</span>
      ) : hasSaving ? (
        <>
          <span className="pp-price__mrp"><s>{product.mrpFormatted}</s></span>
          <span className="pp-price__discount">-{discount}%</span>
          <span className="pp-price__selling">{product.priceFormatted}</span>
        </>
      ) : (
        <span className="pp-price__selling">{product.priceFormatted}</span>
      )}
    </span>
  )
}
