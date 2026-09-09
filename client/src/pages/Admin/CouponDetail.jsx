import { Link, useParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import { Card } from '../../components/admin/AdminUI.jsx'
import { discountLabel, offerTypeLabel, couponImageUrl } from '../../utils/coupon.js'
import { formatDateTime } from '../../utils/admin-date.js'
import { usePageTitle } from '../../theme/page.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/coupons/show.blade.php.
 *
 * A 160px hero carrying the discount label over the coupon's own art, then a two-column
 * definition grid. Every row prints SOMETHING — Laravel wrote 'True'/'False' rather than
 * hiding a false flag, and an em dash where an amount is gated off by its status switch, so
 * the shape of the card does not change with the data.
 *
 * The BOGO row is the one exception: it only exists when the offer type is bogo.
 */

/** `'₹ '.number_format($v, 2)` — grouped, always two decimals. */
const rupees = (value) =>
  `₹ ${Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const yesNo = (value) => (value ? 'True' : 'False')

/** `ucfirst(str_replace('_', ' ', $v))` — "all", "specific_products" -> "Specific products". */
function humanise(value) {
  const text = String(value ?? '').replace(/_/g, ' ')
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : ''
}

/** `.coupon-detail-grid div` — a 12px uppercase caption over a 15px/600 value. */
function Row({ label, children }) {
  return (
    <div className="flex flex-col gap-1 border-b border-[#f0f0f0] pb-2.5">
      <strong className="text-[12px] uppercase tracking-[0.3px] text-[#888]">{label}</strong>
      <span className="text-[15px] font-semibold text-[#333]">{children}</span>
    </div>
  )
}

export default function CouponDetail() {
  const { id } = useParams()
  usePageTitle('Coupon Detail - Purple Panther')

  const { data, loading } = useApi(() => api.admin.coupons.show(id), [id])
  const coupon = data?.item

  return (
    <>
      {/* `.page-head` — back link above the title, Edit on the right */}
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/admin/coupons"
            className="mb-1.5 inline-block text-[14px] font-semibold text-admin-primary hover:underline"
          >
            ← Back
          </Link>
          <h2 className="text-[22px] font-bold text-[#333]">Coupon Detail</h2>
        </div>
        {coupon ? (
          <Link
            to={`/admin/coupons/${coupon.id}/edit`}
            className="inline-flex items-center justify-center rounded-md bg-admin-primary px-4 py-[10px] text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-dark"
          >
            Edit
          </Link>
        ) : null}
      </div>

      {loading || !coupon ? (
        <div className="rounded-[10px] bg-white p-6 text-center text-admin-muted">
          {loading ? 'Loading…' : 'Coupon not found.'}
        </div>
      ) : (
        <Card>
          {/* `.coupon-detail-hero` — 160px, label sitting on the bottom edge */}
          <div
            className="relative flex h-40 items-end overflow-hidden rounded-[10px] bg-[#333] bg-cover bg-center bg-no-repeat p-4 text-[22px] font-bold text-white"
            style={{ backgroundImage: `url('${couponImageUrl(coupon)}')` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/55" aria-hidden="true" />
            <span className="relative z-[1]">{discountLabel(coupon)}</span>
          </div>

          {/* `.coupon-detail-grid` — two columns, 14px/24px gutters */}
          <div className="mt-[18px] grid grid-cols-1 gap-x-6 gap-y-3.5 min-[768px]:grid-cols-2">
            <Row label="Coupon Code">{coupon.code}</Row>
            <Row label="Offer Type">{offerTypeLabel(coupon)}</Row>
            <Row label="Status">{coupon.isActive ? 'Active' : 'Inactive'}</Row>
            <Row label="Website Visibility">{coupon.isPublic ? 'Public' : 'Private code only'}</Row>
            <Row label="Discount Type">{coupon.discountType === 'percent' ? 'Percentage' : 'Amount'}</Row>
            <Row label="Discount">{discountLabel(coupon)}</Row>
            <Row label="Max Discount Status">{yesNo(coupon.maxDiscountStatus)}</Row>
            <Row label="Max Discount Amount">
              {coupon.maxDiscountStatus ? rupees(coupon.maxDiscountAmount) : '—'}
            </Row>
            <Row label="Min Cart Status">{yesNo(coupon.minCartStatus)}</Row>
            <Row label="Min Cart Amount">
              {coupon.minCartStatus ? rupees(coupon.minCartAmount) : '—'}
            </Row>
            <Row label="Applies To">{humanise(coupon.appliesTo)}</Row>
            <Row label="Min Quantity">{coupon.minQuantity || '—'}</Row>

            {coupon.offerType === 'bogo' ? (
              <Row label="BOGO Rule">
                Buy {coupon.bogoBuyQuantity}, get {coupon.bogoGetQuantity} free
              </Row>
            ) : null}

            <Row label="New Customers Only">{yesNo(coupon.newCustomersOnly)}</Row>
            <Row label="Members Only">{yesNo(coupon.membersOnly)}</Row>
            <Row label="Free Shipping">{yesNo(coupon.freeShipping)}</Row>
            <Row label="Starts At">{formatDateTime(coupon.startsAt) || '—'}</Row>
            <Row label="Ends At">{formatDateTime(coupon.endsAt) || '—'}</Row>
            <Row label="Usage Limit">
              {coupon.usageLimit !== null && coupon.usageLimit !== undefined
                ? `${coupon.usedCount}/${coupon.usageLimit}`
                : `${coupon.usedCount} used`}
            </Row>
            <Row label="Max Use Per User">{yesNo(coupon.maxUsePerUser)}</Row>
            <Row label="Created">{formatDateTime(coupon.createdAt)}</Row>
          </div>

          {coupon.description ? (
            <div className="mt-[22px]">
              <h3 className="mb-2 text-[16px] font-bold text-[#333]">Description</h3>
              {/*
                `{!! !!}` — the description is rich text the admin wrote in the coupon form,
                so it is rendered as markup here exactly as the Blade did. `.admin-rte` gives
                it the heading and list styles the admin reset would otherwise strip.
              */}
              <div
                className="admin-rte text-[14px] leading-[1.6] text-[#444]"
                dangerouslySetInnerHTML={{ __html: coupon.description }}
              />
            </div>
          ) : null}
        </Card>
      )}
    </>
  )
}
