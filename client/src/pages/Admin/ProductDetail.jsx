import { Link, useParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import { Card } from '../../components/admin/AdminUI.jsx'
import { storageUrl } from '../../utils/admin-media.js'
import { usePageTitle } from '../../theme/page.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/products/show.blade.php — the read-only view behind the list's "View" action.
 *
 * A two-column `.product-view-grid` (1fr / 1.2fr, collapsing to one column at 991px): the
 * media on the left, a `.detail-table` of every field on the right.
 *
 * Nothing here is editable, and that is the point — the row it renders is the RAW Prisma
 * record, so anything Blade got from an accessor has to be worked out on this side. Prices
 * come back as strings from a DECIMAL column, `featured_image` is a bare storage path, and
 * the colour/size pivots arrive as join rows carrying their own `quantity`.
 */

/**
 * `number_format($value, 2)` — grouped thousands and exactly two decimals.
 *
 * Deliberately 'en-US', not 'en-IN': PHP's `number_format` groups in threes the whole way
 * up, while en-IN would render 1,23,456.00 for the same figure. There is no ₹ here either,
 * because the Blade prints the bare number.
 */
const amount = (value) =>
  Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Blade's `?? '—'`, which also has to catch the empty string a nullable VARCHAR gives back. */
const dash = (value) => (value === null || value === undefined || value === '' ? '—' : value)

const yesNo = (value) => (value ? 'Yes' : 'No')

/**
 * The Brand row is hidden, not removed — `@php($showBrands = false)` sits directly above it
 * in the Blade. Same flag the sidebar and dashboard carry, so all three flip together.
 */
const SHOW_BRANDS = false

/*
 * `.btn` as a LINK, not a button: both head actions are anchors in the Blade and they
 * navigate, so `<Button>` — which always renders `<button>` — is the wrong element here.
 * These are its `md` size and its `primary` / `light` variants spelled out.
 */
const BTN_BASE =
  'inline-flex items-center justify-center rounded-md px-4 py-[10px] text-[13px] font-semibold no-underline transition-colors'
const BTN_PRIMARY = `${BTN_BASE} bg-admin-primary text-white hover:bg-admin-primary-dark`
const BTN_LIGHT = `${BTN_BASE} border border-[#ddd] bg-white text-[#555] hover:bg-[#f7f7f7]`

/** `.detail-table` — a 140px muted `th` against a `td`, both on a 1px #f0f0f0 rule. */
function DetailRow({ label, children }) {
  return (
    <tr>
      <th className="w-[140px] border-b border-[#f0f0f0] py-2 pr-3 text-left align-top text-[14px] font-semibold text-[#777]">
        {label}
      </th>
      <td className="border-b border-[#f0f0f0] py-2 text-left align-top text-[14px]">{children}</td>
    </tr>
  )
}

export default function ProductDetail() {
  usePageTitle('View Product - Purple Panther')

  const { id } = useParams()
  const { data, loading, error } = useApi(() => api.admin.products.show(id), [id])

  const product = data?.item

  if (loading) return <Card>Loading…</Card>
  if (error) return <Card className="text-[#c62828]">{error.message}</Card>
  if (!product) return null

  const gallery = product.images ?? []
  const colors = product.colors ?? []
  const sizes = product.sizes ?? []

  return (
    <>
      {/* `.page-head` with a `.back-link` stacked above the title, then `.page-head-actions` */}
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/admin/products"
            className="mb-1.5 inline-block text-[14px] font-semibold text-admin-primary hover:underline"
          >
            ← Back
          </Link>
          <h2 className="text-[22px] font-bold text-[#333]">{product.title}</h2>
        </div>
        {/* `.page-head-actions` — and it takes the full width below 991px, where the head wraps */}
        <div className="flex flex-wrap items-center gap-2.5 max-[991px]:w-full">
          <Link to={`/admin/products/${product.id}/edit`} className={BTN_PRIMARY}>Edit</Link>
          <Link to={`/admin/products/${product.id}/reviews`} className={BTN_LIGHT}>
            Reviews ({product._count?.reviews ?? 0})
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 min-[992px]:grid-cols-[1fr_1.2fr]">
        <Card>
          {/* `.product-view-media` — two square tiles, the second only if there is one */}
          <div className="grid grid-cols-2 gap-2.5">
            {product.featuredImage && (
              <img
                src={storageUrl(product.featuredImage)}
                alt={product.title}
                className="aspect-square w-full rounded-lg bg-[#f5f5f5] object-cover"
              />
            )}
            {product.featuredImage2 && (
              <img
                src={storageUrl(product.featuredImage2)}
                alt=""
                className="aspect-square w-full rounded-lg bg-[#f5f5f5] object-cover"
              />
            )}
          </div>

          {/* `.gallery-existing` — only rendered when the product has extra images */}
          {gallery.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2.5">
              {gallery.map((image) => (
                <div
                  key={image.id}
                  className="w-[90px] overflow-hidden rounded-lg border border-[#eee] bg-[#fafafa] text-center"
                >
                  <img
                    src={storageUrl(image.image)}
                    alt=""
                    className="block h-[70px] w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <table className="w-full border-collapse">
            <tbody>
              <DetailRow label="Category">{dash(product.category?.title)}</DetailRow>
              <DetailRow label="Sub-Category">{dash(product.subCategory?.title)}</DetailRow>

              {SHOW_BRANDS && <DetailRow label="Brand">{dash(product.brand?.name)}</DetailRow>}

              <DetailRow label="Offer">
                {product.offer
                  ? `${product.offer.title} (${product.offer.discountPercent}%)`
                  : '—'}
              </DetailRow>
              <DetailRow label="M.R.P">{amount(product.mrp)}</DetailRow>
              <DetailRow label="Selling Price">{amount(product.sellingPrice)}</DetailRow>
              <DetailRow label="Max Unit Buy">{product.maxUnitBuy}</DetailRow>
              <DetailRow label="Delivery Charge">{amount(product.deliveryCharge)}</DetailRow>
              {/* Blade spells this one out rather than Yes/No, and the two differ. */}
              <DetailRow label="Status">{product.isActive ? 'Enabled' : 'Disabled'}</DetailRow>
              <DetailRow label="Featured">{yesNo(product.isFeatured)}</DetailRow>
              <DetailRow label="Today's Deal">{yesNo(product.isTodaysDeal)}</DetailRow>
              <DetailRow label="Popular Accessories">{yesNo(product.isPopularAccessory)}</DetailRow>
              <DetailRow label="New Arrival">{yesNo(product.isNewArrival)}</DetailRow>

              <DetailRow label="Colors">
                {colors.length === 0
                  ? '—'
                  : colors.map((pivot, index) => (
                      <span key={pivot.colorId ?? pivot.color?.id}>
                        {/* `.color-dot` — a 22px swatch of the stored hex, inline with the name */}
                        <span
                          className="mr-2 inline-block size-[22px] rounded-full border border-[#ddd] align-middle"
                          style={{ background: pivot.color?.code }}
                        />
                        {pivot.color?.name} ({pivot.quantity})
                        {index < colors.length - 1 ? ', ' : ''}
                      </span>
                    ))}
              </DetailRow>

              <DetailRow label="Sizes">
                {sizes.length === 0
                  ? '—'
                  : sizes
                      .map((pivot) => `${pivot.size?.name} (${pivot.quantity})`)
                      .join(', ')}
              </DetailRow>
            </tbody>
          </table>

          {product.shortDescription && (
            <>
              <h4 className="mb-2 mt-4 text-[16px] font-bold text-[#333]">Short Description</h4>
              <p className="text-[14px]">{product.shortDescription}</p>
            </>
          )}

          {product.features && (
            <>
              <h4 className="mb-2 mt-4 text-[16px] font-bold text-[#333]">Features</h4>
              {/* `nl2br(e($product->features))` — escaped, with newlines the only markup that
                  survives. `whitespace-pre-line` does the same job without dangerouslySetInnerHTML. */}
              <div className="whitespace-pre-line text-[14px]">{product.features}</div>
            </>
          )}
        </Card>
      </div>
    </>
  )
}
