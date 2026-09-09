import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Image as ImageIcon } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import { Button } from '../../components/admin/AdminUI.jsx'
import { FORM_CONTROL } from '../../components/admin/AdminControls.jsx'
import RichTextEditor from '../../components/admin/RichTextEditor.jsx'
import { storageUrl } from '../../utils/admin-media.js'
import { toDateTimeLocal } from '../../utils/admin-date.js'
import { usePageTitle } from '../../theme/page.js'
import { toast } from '../../store/toast.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/coupons/create.blade.php + edit.blade.php + coupons/_form.blade.php,
 * plus every conditional in public/js/coupon-form.js.
 *
 * The `.offer-form-row` grid the banner form uses — a 220px label column beside the field —
 * inside a `.coupon-form-card`, which is a card with NO top padding: the title sits at
 * 18px/14px over a 1px #eee rule and the rows hang off it.
 *
 * Five rows show and hide, and they are behaviour rather than decoration:
 *
 *   - BOGO swaps the whole discount row for the Buy/Get pair, and takes the maximum-discount
 *     rows with it, because a BOGO coupon has no percentage to cap.
 *   - Maximum Discount (Amount) follows its own True/False.
 *   - Minimum Amount in Cart follows its own True/False.
 *   - Categories and Products appear only for the `applies_to` that uses them.
 *
 * The two discount fields are mutually exclusive — typing in one clears the other, which is
 * `syncDiscountExclusive`, and the server rejects both being set regardless.
 */

/** `.discount-input` — a 42px bordered row whose prefix is a grey cell, not a placeholder. */
function DiscountInput({ prefix, ...props }) {
  return (
    <div className="flex h-[42px] items-center overflow-hidden rounded-md border border-[#ddd] bg-white">
      <span className="flex h-full items-center border-r border-[#eee] bg-[#f7f7f7] px-3.5 font-bold text-[#555]">
        {prefix}
      </span>
      <input
        type="number"
        inputMode="decimal"
        className="h-10 min-w-0 flex-1 border-none px-3 text-[14px] outline-none"
        {...props}
      />
    </div>
  )
}

/** `.offer-form-row` — hidden rows are removed rather than display:none'd. */
function Row({ label, top = false, hidden = false, labelExtra, children }) {
  if (hidden) return null

  return (
    <div
      className={`grid grid-cols-1 gap-2 border-b border-[#f0f0f0] py-3.5 min-[768px]:grid-cols-[220px_1fr] min-[768px]:gap-4 ${
        top ? 'items-start' : 'min-[768px]:items-center'
      }`}
    >
      <div>
        <label className="text-[14px] font-semibold text-[#555]">
          {label} <span className="text-[#888]">:-</span>
        </label>
        {labelExtra}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** `.hint.muted-hint` — 12px #888, below the field. */
const MutedHint = ({ children }) => (
  <p className="mt-1 text-[12px] leading-[1.3] text-[#888]">{children}</p>
)

/** `.offer-label-wrap .hint` — 12px #e53935, beside the label. */
const RedHint = ({ children }) => (
  <p className="mt-1 text-[12px] leading-[1.3] text-[#e53935]">{children}</p>
)

const FieldError = ({ children }) =>
  children ? <p className="mt-1 text-[12px] text-[#e53935]">{children}</p> : null

/** Every True/False row in the form is this same pair, valued '1' and '0'. */
function BoolSelect({ value, onChange }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={FORM_CONTROL}>
      <option value="1">True</option>
      <option value="0">False</option>
    </select>
  )
}

const emptyForm = {
  description: '',
  code: '',
  is_public: '1',
  offer_type: 'coupon',
  bogo_buy_quantity: 1,
  bogo_get_quantity: 1,
  discount_percent: '',
  discount_amount: '',
  max_discount_status: '1',
  max_discount_amount: '',
  min_cart_status: '1',
  min_cart_amount: '',
  applies_to: 'all',
  category_ids: [],
  product_ids: [],
  min_quantity: '',
  new_customers_only: '0',
  members_only: '0',
  free_shipping: '0',
  starts_at: '',
  ends_at: '',
  usage_limit: '',
  max_use_per_user: '0',
}

/** A `<select multiple>`'s chosen values, as the strings the options carry. */
const selectedValues = (select) => Array.from(select.selectedOptions, (option) => option.value)

export default function CouponForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  usePageTitle(`${isEdit ? 'Edit' : 'Add'} Coupon - Purple Panther`)

  const [form, setForm] = useState(emptyForm)
  const [image, setImage] = useState(null)
  const [currentImage, setCurrentImage] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const { data: formData } = useApi(() => api.admin.coupons.formData(), [])
  const { data: couponData } = useApi(
    () => (isEdit ? api.admin.coupons.show(id) : Promise.resolve(null)),
    [id],
  )

  const offerTypes = formData?.offerTypes ?? {}
  const categories = formData?.categories ?? []
  const products = formData?.products ?? []

  useEffect(() => {
    const coupon = couponData?.item
    if (!coupon) return

    /*
     * `category_ids` / `product_ids` are JSON-IN-LONGTEXT, and the admin API returns the raw
     * column — so this arrives as the string "[1,2]", not an array. Reading it as an array
     * would silently drop the admin's whole selection on edit, and the form would then save
     * an empty list back over it.
     */
    const ids = (value) => {
      if (Array.isArray(value)) return value.map(String)
      if (typeof value !== 'string' || value === '') return []
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed.map(String) : []
      } catch {
        return []
      }
    }

    setForm({
      description: coupon.description ?? '',
      code: coupon.code ?? '',
      is_public: coupon.isPublic ? '1' : '0',
      offer_type: coupon.offerType ?? 'coupon',
      bogo_buy_quantity: coupon.bogoBuyQuantity ?? 1,
      bogo_get_quantity: coupon.bogoGetQuantity ?? 1,
      // The Blade seeds each box only when it matches `discount_type`, so an amount coupon
      // does not show a stale percentage beside it.
      discount_percent: coupon.discountType === 'percent' ? (coupon.discountPercent ?? '') : '',
      discount_amount: coupon.discountType === 'amount' ? (coupon.discountAmount ?? '') : '',
      max_discount_status: coupon.maxDiscountStatus ? '1' : '0',
      max_discount_amount: coupon.maxDiscountAmount ?? '',
      min_cart_status: coupon.minCartStatus ? '1' : '0',
      min_cart_amount: coupon.minCartAmount ?? '',
      applies_to: coupon.appliesTo ?? 'all',
      category_ids: ids(coupon.categoryIds),
      product_ids: ids(coupon.productIds),
      min_quantity: coupon.minQuantity ?? '',
      new_customers_only: coupon.newCustomersOnly ? '1' : '0',
      members_only: coupon.membersOnly ? '1' : '0',
      free_shipping: coupon.freeShipping ? '1' : '0',
      starts_at: toDateTimeLocal(coupon.startsAt),
      ends_at: toDateTimeLocal(coupon.endsAt),
      usage_limit: coupon.usageLimit ?? '',
      max_use_per_user: coupon.maxUsePerUser ? '1' : '0',
    })
    setCurrentImage(coupon.image ?? '')
  }, [couponData])

  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }))
  const setInput = (key) => (event) => set(key)(event.target.value)

  const isBogo = form.offer_type === 'bogo'

  /** `syncDiscountExclusive` — a figure in one box empties the other. */
  function onDiscountChange(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(value !== ''
        ? { [field === 'discount_percent' ? 'discount_amount' : 'discount_percent']: '' }
        : {}),
    }))
  }

  async function onSubmit(event) {
    event.preventDefault()
    setErrors({})

    if (!isEdit && !image) {
      setErrors({ image: 'Please select a coupon image.' })
      toast.error('Please select a coupon image.')
      return
    }

    setSaving(true)

    // Empty strings would coerce to 0; the columns are nullable and Laravel sent null.
    const blank = (value) => (value === '' || value === null ? null : value)

    try {
      const res = await api.admin.coupons.save(
        id,
        {
          description: form.description,
          code: form.code.trim().toUpperCase(),
          is_public: form.is_public === '1',
          offer_type: form.offer_type,
          bogo_buy_quantity: isBogo ? Number(form.bogo_buy_quantity) || null : null,
          bogo_get_quantity: isBogo ? Number(form.bogo_get_quantity) || null : null,
          discount_percent: isBogo ? null : blank(form.discount_percent),
          discount_amount: isBogo ? null : blank(form.discount_amount),
          max_discount_status: !isBogo && form.max_discount_status === '1',
          max_discount_amount: blank(form.max_discount_amount),
          min_cart_status: form.min_cart_status === '1',
          min_cart_amount: blank(form.min_cart_amount),
          applies_to: form.applies_to,
          category_ids: form.applies_to === 'categories' ? form.category_ids.map(Number) : [],
          product_ids: form.applies_to === 'products' ? form.product_ids.map(Number) : [],
          min_quantity: blank(form.min_quantity),
          new_customers_only: form.new_customers_only === '1',
          members_only: form.members_only === '1',
          free_shipping: form.free_shipping === '1',
          starts_at: blank(form.starts_at),
          ends_at: blank(form.ends_at),
          usage_limit: blank(form.usage_limit),
          max_use_per_user: form.max_use_per_user === '1',
        },
        { image },
      )

      toast.success(res.$message)
      navigate('/admin/coupons')
    } catch (err) {
      // The server returns field errors keyed by name; showing them inline as well as in the
      // toast is what `.field-error` did.
      if (err.errors) {
        setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])))
      }
      toast.error(err.message)
      setSaving(false)
    }
  }

  return (
    <>
      {/* `.page-head` — this screen's head holds only the back link */}
      <div className="mb-[18px]">
        <Link
          to="/admin/coupons"
          className="inline-block text-[14px] font-semibold text-admin-primary hover:underline"
        >
          ← Back
        </Link>
      </div>

      {/* `.card.coupon-form-card` — no top padding; the title's rule is the card's edge */}
      <div className="rounded-[10px] bg-white px-[22px] pb-[22px] shadow-admin-card">
        <h2 className="border-b border-[#eee] py-[18px] pb-3.5 text-[20px] font-semibold text-[#444]">
          {isEdit ? 'Edit' : 'Add'} Coupon
        </h2>

        <form onSubmit={onSubmit} noValidate>
          <Row label="Description" top>
            <RichTextEditor
              id="coupon-description"
              rows={10}
              value={form.description}
              onChange={set('description')}
            />
            {/* The Blade recolours this hint to #666, not the usual #888 */}
            <p className="mt-2 text-[12px] leading-[1.3] text-[#666]">
              This description is shown in the top header announcement bar (HTML is converted to
              plain text).
            </p>
          </Row>

          <Row label="Coupon Code">
            <input
              type="text"
              maxLength={50}
              value={form.code}
              onChange={setInput('code')}
              placeholder="e.g. SAVE50"
              className={`${FORM_CONTROL} uppercase ${errors.code ? 'border-[#e53935]' : ''}`}
            />
            <FieldError>{errors.code}</FieldError>
          </Row>

          <Row label="Publicly Visible">
            <select value={form.is_public} onChange={setInput('is_public')} className={FORM_CONTROL}>
              <option value="1">Yes — show on website</option>
              <option value="0">No — private code only</option>
            </select>
            <MutedHint>
              Private coupons stay active and can be applied manually, but are not advertised on
              the website.
            </MutedHint>
          </Row>

          <Row label="Offer Type">
            <select value={form.offer_type} onChange={setInput('offer_type')} className={FORM_CONTROL}>
              {Object.entries(offerTypes).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </Row>

          {/* `#coupon-bogo-rule-row` — only for a BOGO offer */}
          <Row label="BOGO Rule" hidden={!isBogo}>
            <div className="flex items-center gap-2">
              <label className="text-[14px]">Buy</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.bogo_buy_quantity}
                onChange={setInput('bogo_buy_quantity')}
                className={`${FORM_CONTROL} max-w-[100px]`}
              />
              <label className="text-[14px]">Get free</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.bogo_get_quantity}
                onChange={setInput('bogo_get_quantity')}
                className={`${FORM_CONTROL} max-w-[100px]`}
              />
            </div>
            <MutedHint>Example: Buy 1, Get 1 makes every second matching eligible item free.</MutedHint>
            <FieldError>{errors.bogo_buy_quantity}</FieldError>
          </Row>

          {/* `.coupon-discount-row` — 1fr / auto / 1fr with OR between, hidden for BOGO */}
          {!isBogo ? (
            <div className="grid grid-cols-1 items-start gap-[18px] border-b border-[#f0f0f0] py-[18px] min-[768px]:grid-cols-[1fr_auto_1fr]">
              <div className="grid gap-2.5">
                <div>
                  <label className="text-[14px] font-semibold text-[#555]">
                    Discount in % <span className="text-[#888]">:-</span>
                  </label>
                  <MutedHint>(You no need to add % in field)</MutedHint>
                </div>
                <DiscountInput
                  prefix="%"
                  min="0.01"
                  max="100"
                  step="0.01"
                  placeholder="e.g. 50"
                  value={form.discount_percent}
                  onChange={(event) => onDiscountChange('discount_percent', event.target.value)}
                />
                <FieldError>{errors.discount_percent}</FieldError>
              </div>

              {/* `.coupon-or` — 22px/800, nudged down 28px to clear the label above */}
              <div className="self-center pt-7 text-[22px] font-extrabold text-[#333] max-[767px]:pt-0">
                OR
              </div>

              <div className="grid gap-2.5">
                <label className="text-[14px] font-semibold text-[#555]">
                  Discount in Amount <span className="text-[#888]">:-</span>
                </label>
                <DiscountInput
                  prefix="₹"
                  min="0.01"
                  step="0.01"
                  placeholder="e.g. 10"
                  value={form.discount_amount}
                  onChange={(event) => onDiscountChange('discount_amount', event.target.value)}
                />
                <FieldError>{errors.discount_amount}</FieldError>
              </div>
            </div>
          ) : null}

          <Row label="Maximum Discount Status" hidden={isBogo}>
            <BoolSelect value={form.max_discount_status} onChange={set('max_discount_status')} />
          </Row>

          {/* `#max-discount-amount-row` — its own True/False, and never for BOGO */}
          <Row label="Maximum Discount (Amount)" hidden={isBogo || form.max_discount_status !== '1'}>
            <input
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={form.max_discount_amount}
              onChange={setInput('max_discount_amount')}
              placeholder="e.g. 200"
              className={`${FORM_CONTROL} ${errors.max_discount_amount ? 'border-[#e53935]' : ''}`}
            />
            <FieldError>{errors.max_discount_amount}</FieldError>
          </Row>

          <Row label="Minimum Amount in Cart Status">
            <BoolSelect value={form.min_cart_status} onChange={set('min_cart_status')} />
          </Row>

          <Row label="Minimum Amount in Cart" hidden={form.min_cart_status !== '1'}>
            <input
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={form.min_cart_amount}
              onChange={setInput('min_cart_amount')}
              placeholder="e.g. 500"
              className={`${FORM_CONTROL} ${errors.min_cart_amount ? 'border-[#e53935]' : ''}`}
            />
            <FieldError>{errors.min_cart_amount}</FieldError>
          </Row>

          <Row label="Applies To">
            <select value={form.applies_to} onChange={setInput('applies_to')} className={FORM_CONTROL}>
              <option value="all">Entire cart</option>
              <option value="categories">Selected categories</option>
              <option value="products">Selected products</option>
            </select>
          </Row>

          <Row label="Categories" top hidden={form.applies_to !== 'categories'}>
            <select
              multiple
              size={6}
              value={form.category_ids}
              onChange={(event) => set('category_ids')(selectedValues(event.target))}
              className="w-full rounded-md border border-[#ddd] bg-white px-3 py-2 text-[14px] outline-none"
            >
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>{category.title}</option>
              ))}
            </select>
            <MutedHint>Hold Ctrl/Cmd to select multiple.</MutedHint>
            <FieldError>{errors.category_ids}</FieldError>
          </Row>

          <Row label="Products" top hidden={form.applies_to !== 'products'}>
            <select
              multiple
              size={8}
              value={form.product_ids}
              onChange={(event) => set('product_ids')(selectedValues(event.target))}
              className="w-full rounded-md border border-[#ddd] bg-white px-3 py-2 text-[14px] outline-none"
            >
              {products.map((product) => (
                <option key={product.id} value={String(product.id)}>{product.title}</option>
              ))}
            </select>
            <MutedHint>Hold Ctrl/Cmd to select multiple.</MutedHint>
            <FieldError>{errors.product_ids}</FieldError>
          </Row>

          <Row label="Minimum Quantity">
            <input
              type="number"
              min="1"
              step="1"
              value={form.min_quantity}
              onChange={setInput('min_quantity')}
              placeholder="Optional"
              className={FORM_CONTROL}
            />
          </Row>

          <Row label="New Customers Only">
            <BoolSelect value={form.new_customers_only} onChange={set('new_customers_only')} />
          </Row>

          <Row label="Members Only">
            <BoolSelect value={form.members_only} onChange={set('members_only')} />
          </Row>

          <Row label="Free Shipping">
            <BoolSelect value={form.free_shipping} onChange={set('free_shipping')} />
          </Row>

          <Row label="Starts At">
            <input
              type="datetime-local"
              value={form.starts_at}
              onChange={setInput('starts_at')}
              className={FORM_CONTROL}
            />
          </Row>

          <Row label="Ends At">
            <input
              type="datetime-local"
              value={form.ends_at}
              onChange={setInput('ends_at')}
              className={`${FORM_CONTROL} ${errors.ends_at ? 'border-[#e53935]' : ''}`}
            />
            <FieldError>{errors.ends_at}</FieldError>
          </Row>

          <Row label="Total Usage Limit">
            <input
              type="number"
              min="1"
              step="1"
              value={form.usage_limit}
              onChange={setInput('usage_limit')}
              placeholder="Leave blank for unlimited"
              className={FORM_CONTROL}
            />
          </Row>

          <Row label="Maximum Coupon Use Per User">
            <BoolSelect value={form.max_use_per_user} onChange={set('max_use_per_user')} />
          </Row>

          <Row
            label="Select Image"
            top
            labelExtra={
              <>
                <RedHint>(Recommended resolution: 300x130,400x173)</RedHint>
                <RedHint>(Accept png, jpg, jpeg, PNG, JPG, JPEG image files)</RedHint>
                <RedHint>
                  (Recommended jpg, jpeg, JPG, JPEG image files for best compression ratio)
                </RedHint>
              </>
            }
          >
            {/* `.offer-image-box` — the file input and its preview share one bordered box */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#ddd] bg-white p-2.5">
              <input
                type="file"
                accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                onChange={(event) => setImage(event.target.files?.[0] ?? null)}
                className="h-auto min-w-[180px] flex-1 border-none p-0 text-[14px]"
              />
              {/* `.coupon-image-preview` — 140px square on #eef5fb, wider than the offer form's */}
              <div className="flex size-[140px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#eef5fb] text-[28px] text-[#90a4ae]">
                {preview || currentImage ? (
                  <img
                    src={preview || storageUrl(currentImage)}
                    alt={form.code}
                    className="size-full object-cover"
                  />
                ) : (
                  <ImageIcon size={28} />
                )}
              </div>
            </div>
            <FieldError>{errors.image}</FieldError>
          </Row>

          {/* `.offer-form-actions` — 18px above a lone Save */}
          <div className="pt-[18px]">
            <Button type="submit" loading={saving} disabled={saving}>Save</Button>
          </div>
        </form>
      </div>
    </>
  )
}
