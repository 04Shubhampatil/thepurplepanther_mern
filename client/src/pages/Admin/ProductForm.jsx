import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Image as ImageIcon } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import { Button } from '../../components/admin/AdminUI.jsx'
import { Toggle, FORM_CONTROL } from '../../components/admin/AdminControls.jsx'
import { storageUrl } from '../../utils/admin-media.js'
import { usePageTitle } from '../../theme/page.js'
import { toast } from '../../store/toast.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/products/_form.blade.php, plus the behaviour in public/js/product-form.js.
 *
 * Nine `.product-form-card` panels. Most of the layout is the `.offer-form-row` grid the
 * banner and coupon forms use, with `.product-pricing-row` (three columns) for the fields
 * that sit side by side and `.detail-repeater` for the four repeating sections.
 *
 * Five behaviours are load-bearing rather than cosmetic:
 *
 *   - Sub-Category is filtered by the chosen Category, and a sub-category belonging to a
 *     different category is cleared rather than left dangling.
 *   - The Accessory Package card appears ONLY when the category's slug is accessories, and
 *     its fields only when the switch inside it is on. Both gates matter: the packages
 *     replace the normal Selling Price on the storefront.
 *   - A colour's gallery slot appears only once that colour is ticked. Images filed under a
 *     colour swap in when the customer picks it; images with no colour are the shared
 *     gallery, and that distinction is the whole point of the section.
 *   - `products.title` is UNIQUE, so it is checked against the server before submitting
 *     rather than after — the same `check-title` probe the Blade ran on blur.
 *   - Colour and size quantities are PER-VARIANT STOCK. They ride along with the checkbox
 *     and are sent for every ticked variant, because the server's pivot sync reads them.
 */

/** `.product-form-card` — a card capped at 980px with 16px below it. */
function Panel({ title, hint, children }) {
  return (
    <div className="mb-4 max-w-[980px] rounded-[10px] bg-white p-[18px] shadow-admin-card">
      <h3 className="text-[18px] font-bold text-[#333]">{title}</h3>
      {hint}
      {children}
    </div>
  )
}

/** `.offer-form-row` — 220px label column beside the field. */
function Row({ label, top = false, children }) {
  return (
    <div
      className={`grid grid-cols-1 gap-2 border-b border-[#f0f0f0] py-3.5 min-[768px]:grid-cols-[220px_1fr] min-[768px]:gap-4 ${
        top ? 'items-start' : 'min-[768px]:items-center'
      }`}
    >
      <label className="text-[14px] font-semibold text-[#555]">
        {label} <span className="text-[#888]">:-</span>
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** `.form-group` — a 13px/600 #666 label above its control. */
function Field({ label, children, className = '' }) {
  return (
    <div className={`flex min-w-0 flex-col ${className}`}>
      <label className="mb-1.5 block min-h-4 text-[13px] font-semibold leading-[1.2] text-[#666]">
        {label}
      </label>
      {children}
    </div>
  )
}

const Hint = ({ children, className = '' }) => (
  <p className={`mt-1 text-[12px] leading-[1.3] text-[#888] ${className}`}>{children}</p>
)

/** `.toggle-row` */
function ToggleRow({ label, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#f0f0f0] py-3">
      <span className="text-[14px]">{label}</span>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}

/** `.detail-repeater__row` — a bordered block with its own numbered head and Remove. */
function RepeaterRow({ label, index, onRemove, children }) {
  return (
    <div className="mb-3 rounded-[10px] border border-[#ececec] p-3">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <strong className="text-[14px] font-bold text-[#333]">{label} {index + 1}</strong>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center justify-center rounded-md border border-[#ddd] bg-white px-[10px] py-1.5 text-[12px] font-semibold text-[#555] transition-colors hover:bg-[#f7f7f7]"
        >
          Remove
        </button>
      </div>
      {children}
    </div>
  )
}

/** `.btn.btn-light` as a plain button — the repeaters' "+ Add" controls. */
function LightButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-md border border-[#ddd] bg-white px-4 py-[10px] text-[13px] font-semibold text-[#555] transition-colors hover:bg-[#f7f7f7]"
    >
      {children}
    </button>
  )
}

/** `.offer-image-box` + `.offer-image-preview` — a 120x80 preview beside the picker. */
function ImageBox({ current, file, onPick }) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#ddd] bg-white p-2.5">
      <input
        type="file"
        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
        onChange={(event) => onPick(event.target.files?.[0] ?? null)}
        className="h-auto min-w-[180px] flex-1 border-none p-0 text-[14px]"
      />
      <div className="flex h-20 w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#e3f2fd] text-[#90a4ae]">
        {preview || current ? (
          <img src={preview || storageUrl(current)} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon size={28} />
        )}
      </div>
    </div>
  )
}

const SUGGESTED_PACKAGES = [
  { label: '1 piece', mrp: '549', price: '549' },
  { label: '2 pieces (1 set)', mrp: '899', price: '899' },
  { label: '4 pieces + 1 free', mrp: '1598', price: '1598' },
  { label: '6 pieces + 2 free', mrp: '2797', price: '2797' },
]

const emptyForm = {
  title: '',
  category_id: '',
  sub_category_id: '',
  short_description: '',
  features: '',
  mrp: 0,
  selling_price: '',
  offer_id: '',
  max_unit_buy: 1,
  delivery_charge: 0,
  is_active: true,
  is_featured: false,
  is_todays_deal: false,
  is_popular_accessory: false,
  is_new_arrival: false,
  show_size_guide: true,
  size_guide_content: '',
  highlights_short_description: '',
  seo_title: '',
  meta_description: '',
  meta_keywords: '',
  enable_accessory_packages: false,
}

export default function ProductForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  usePageTitle(`${isEdit ? 'Edit' : 'Add'} Product - Purple Panther`)

  const [form, setForm] = useState(emptyForm)
  const [colors, setColors] = useState({})   // colorId -> { checked, quantity }
  const [sizes, setSizes] = useState({})
  const [highlights, setHighlights] = useState([{ title: '', subtitle: '', description: '', icon: '' }])
  const [information, setInformation] = useState([{ title: '', text: '' }])
  const [specifications, setSpecifications] = useState([{ key: '', value: '' }])
  const [packages, setPackages] = useState([{ label: '', mrp: '', price: '' }])
  const [images, setImages] = useState([])
  const [removeGallery, setRemoveGallery] = useState([])
  const [files, setFiles] = useState({})     // fieldName -> File | File[]
  const [current, setCurrent] = useState({}) // stored image paths
  const [titleError, setTitleError] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const titleTimer = useRef(null)

  const { data: formData } = useApi(() => api.admin.products.formData(), [])
  const { data: productData } = useApi(
    () => (isEdit ? api.admin.products.show(id) : Promise.resolve(null)),
    [id],
  )

  const categories = formData?.categories ?? []
  const subCategories = formData?.subCategories ?? []
  const offers = formData?.offers ?? []
  const colorList = formData?.colors ?? []
  const sizeList = formData?.sizes ?? []

  useEffect(() => {
    const product = productData?.item
    if (!product) return

    setForm({
      title: product.title ?? '',
      category_id: product.categoryId ? String(product.categoryId) : '',
      sub_category_id: product.subCategoryId ? String(product.subCategoryId) : '',
      short_description: product.shortDescription ?? '',
      features: product.features ?? '',
      mrp: product.mrp ?? 0,
      // The Blade shows an EMPTY box when the selling price is 0, not a literal zero.
      selling_price: Number(product.sellingPrice) > 0 ? product.sellingPrice : '',
      offer_id: product.offerId ? String(product.offerId) : '',
      max_unit_buy: product.maxUnitBuy ?? 1,
      delivery_charge: product.deliveryCharge ?? 0,
      is_active: Boolean(product.isActive),
      is_featured: Boolean(product.isFeatured),
      is_todays_deal: Boolean(product.isTodaysDeal),
      is_popular_accessory: Boolean(product.isPopularAccessory),
      is_new_arrival: Boolean(product.isNewArrival),
      show_size_guide: Boolean(product.showSizeGuide),
      size_guide_content: product.sizeGuideContent ?? '',
      highlights_short_description: product.highlightsShortDescription ?? '',
      seo_title: product.seoTitle ?? '',
      meta_description: product.metaDescription ?? '',
      meta_keywords: product.metaKeywords ?? '',
      enable_accessory_packages: parseRows(product.accessoryPackages).length > 0,
    })

    // The pivot rows carry the per-variant stock; both halves have to come back.
    setColors(
      Object.fromEntries(
        (product.colors ?? []).map((pivot) => [
          String(pivot.colorId ?? pivot.color?.id),
          { checked: true, quantity: pivot.quantity ?? 0 },
        ]),
      ),
    )
    setSizes(
      Object.fromEntries(
        (product.sizes ?? []).map((pivot) => [
          String(pivot.sizeId ?? pivot.size?.id),
          { checked: true, quantity: pivot.quantity ?? 0 },
        ]),
      ),
    )

    const rows = (value, fallback) => {
      const parsed = parseRows(value)
      return parsed.length ? parsed : fallback
    }

    setHighlights(rows(product.highlightsItems, [{ title: '', subtitle: '', description: '', icon: '' }]))
    setInformation(rows(product.informationItems, [{ title: '', text: '' }]))
    setSpecifications(rows(product.specifications, [{ key: '', value: '' }]))
    setPackages(rows(product.accessoryPackages, [{ label: '', mrp: '', price: '' }]))
    setImages(product.images ?? [])
    setCurrent({
      featured_image: product.featuredImage ?? '',
      featured_image_2: product.featuredImage2 ?? '',
      size_guide_image: product.sizeGuideImage ?? '',
      highlights_image: product.highlightsImage ?? '',
    })
  }, [productData])

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))
  const flip = (key) => () => setForm((prev) => ({ ...prev, [key]: !prev[key] }))
  const setFile = (key, value) => setFiles((prev) => ({ ...prev, [key]: value }))

  /*
   * Sub-Category follows Category. Clearing a sub-category that belongs to a different one
   * matters: the select would still be showing it while the option list no longer offers it,
   * and the stale id would be saved.
   */
  const visibleSubs = subCategories.filter(
    (sub) => !form.category_id || String(sub.categoryId) === String(form.category_id),
  )

  useEffect(() => {
    if (!form.sub_category_id) return
    if (visibleSubs.some((sub) => String(sub.id) === String(form.sub_category_id))) return
    setForm((prev) => ({ ...prev, sub_category_id: '' }))
  }, [form.category_id, subCategories])

  /* `toggleAccessoryPackages` — the card is gated on the category's SLUG, not its name. */
  const categorySlug = String(
    categories.find((c) => String(c.id) === String(form.category_id))?.slug ?? '',
  ).toLowerCase()
  const isAccessory = categorySlug === 'accessories' || categorySlug === 'accessory'
  const packagesOn = isAccessory && form.enable_accessory_packages

  const selectedColorIds = Object.entries(colors)
    .filter(([, v]) => v.checked)
    .map(([key]) => key)

  function toggleVariant(setState, key) {
    setState((prev) => {
      const row = prev[key] ?? { checked: false, quantity: 0 }
      return { ...prev, [key]: { ...row, checked: !row.checked } }
    })
  }

  function setVariantQuantity(setState, key, quantity) {
    setState((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { checked: false }), quantity },
    }))
  }

  /** `checkTitleDuplicate` — the same probe, debounced on input and repeated on submit. */
  async function checkTitle(value) {
    const title = String(value ?? '').trim()
    if (!title) {
      setTitleError('')
      return true
    }

    try {
      const res = await api.admin.products.checkTitle(title, isEdit ? id : undefined)
      if (res.available) {
        setTitleError('')
        return true
      }
      const message = res.$message || 'This product title already exists. Duplicate name not allowed.'
      setTitleError(message)
      return false
    } catch {
      // A failed probe must not block a save — the server checks again on write.
      return true
    }
  }

  function onTitleChange(event) {
    const value = event.target.value
    setForm((prev) => ({ ...prev, title: value }))

    clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(() => checkTitle(value), 400)
  }

  function validate() {
    const next = {}
    const title = form.title.trim()

    if (!title) next.title = 'Product title is required.'
    else if (title.length < 2) next.title = 'Title must be at least 2 characters.'
    else if (title.length > 255) next.title = 'Title cannot exceed 255 characters.'

    if (!form.category_id) next.category_id = 'Please select a category.'
    if (form.mrp === '' || form.mrp === null) next.mrp = 'M.R.P is required.'
    else if (Number(form.mrp) < 0) next.mrp = 'M.R.P cannot be negative.'
    if (form.selling_price !== '' && Number(form.selling_price) < 0) {
      next.selling_price = 'Selling price cannot be negative.'
    }
    if (Number(form.max_unit_buy) < 1) next.max_unit_buy = 'Max unit buy must be at least 1.'
    if (Number(form.delivery_charge) < 0) next.delivery_charge = 'Delivery charge cannot be negative.'
    // Featured Image-1 is required on CREATE only.
    if (!isEdit && !files.featured_image) next.featured_image = 'Please select Featured Image-1.'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function onSubmit(event) {
    event.preventDefault()
    if (!validate()) {
      toast.error(Object.values(errors)[0] ?? 'Please check the highlighted fields.')
      return
    }
    if (!(await checkTitle(form.title))) {
      toast.error('This product title already exists. Duplicate name not allowed.')
      return
    }

    setSaving(true)

    const rows = (list, keys) =>
      list
        .filter((row) => keys.some((key) => String(row[key] ?? '').trim() !== ''))
        .map((row) => Object.fromEntries(keys.map((key) => [key, row[key] ?? ''])))

    const variants = (state) =>
      Object.entries(state)
        .filter(([, v]) => v.checked)
        .map(([key, v]) => ({ id: Number(key), quantity: Number(v.quantity) || 0 }))

    const upload = { ...files }
    // Each ticked colour's picker becomes its own field, since the name carries the colour.
    for (const colorId of selectedColorIds) {
      const picked = files[`color_gallery_${colorId}`]
      if (picked?.length) upload[`color_gallery_${colorId}`] = picked
    }

    try {
      const body = {
        title: form.title.trim(),
        category_id: form.category_id,
        sub_category_id: form.sub_category_id || null,
        offer_id: form.offer_id || null,
        short_description: form.short_description,
        features: form.features,
        mrp: Number(form.mrp) || 0,
        selling_price: form.selling_price === '' ? 0 : Number(form.selling_price),
        max_unit_buy: Number(form.max_unit_buy) || 1,
        delivery_charge: Number(form.delivery_charge) || 0,
        seo_title: form.seo_title,
        meta_description: form.meta_description,
        meta_keywords: form.meta_keywords,
        is_active: form.is_active,
        is_featured: form.is_featured,
        is_todays_deal: form.is_todays_deal,
        is_popular_accessory: form.is_popular_accessory,
        is_new_arrival: form.is_new_arrival,
        show_size_guide: form.show_size_guide,
        size_guide_content: form.size_guide_content,
        highlights_short_description: form.highlights_short_description,
        highlights_items: highlights
          .filter((row) => [row.title, row.subtitle, row.description].some((v) => String(v ?? '').trim()))
          // `existing_icon` rides along so a row whose icon was not re-picked keeps it.
          .map((row) => ({
            title: row.title ?? '',
            subtitle: row.subtitle ?? '',
            description: row.description ?? '',
            existing_icon: row.icon ?? '',
          })),
        information_items: rows(information, ['title', 'text']),
        specifications: rows(specifications, ['key', 'value']),
        // Packages are only sent when the category and the switch both allow them; the
        // server stores an empty list otherwise, which is what turns the feature off.
        accessory_packages: packagesOn ? rows(packages, ['label', 'mrp', 'price']) : [],
        colors: variants(colors),
        sizes: variants(sizes),
        remove_gallery: removeGallery.map(Number),
      }

      const res = isEdit
        ? await api.admin.products.update(id, body, upload)
        : await api.admin.products.create(body, upload)

      toast.success(res.$message)
      navigate('/admin/products')
    } catch (err) {
      if (err.errors) {
        setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])))
      }
      toast.error(err.message)
      setSaving(false)
    }
  }

  const invalid = (field) => (errors[field] ? 'border-[#e53935]' : '')
  const FieldError = ({ field }) =>
    errors[field] ? <p className="mt-1 text-[12px] text-[#e53935]">{errors[field]}</p> : null

  const sharedGallery = images.filter((image) => !image.colorId)
  const galleryFor = (colorId) => images.filter((image) => String(image.colorId) === String(colorId))

  const toggleRemove = (imageId) =>
    setRemoveGallery((prev) =>
      prev.includes(imageId) ? prev.filter((v) => v !== imageId) : [...prev, imageId],
    )

  /** `.gallery-thumb` — a 90px tile whose caption carries the Remove checkbox. */
  const GalleryThumb = ({ image, label }) => (
    <label className="w-[90px] overflow-hidden rounded-lg border border-[#eee] bg-[#fafafa] text-center">
      <img src={storageUrl(image.image)} alt="" className="h-[70px] w-full object-cover" />
      <span className="block p-1 text-[11px] text-[#e53935]">
        {label} ·{' '}
        <input
          type="checkbox"
          checked={removeGallery.includes(image.id)}
          onChange={() => toggleRemove(image.id)}
          className="accent-admin-primary"
        />{' '}
        Remove
      </span>
    </label>
  )

  return (
    <>
      {/* `.page-head` — back link above the title, Reviews on the right when editing */}
      <div className="mb-[18px] flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/admin/products"
            className="mb-1.5 inline-block text-[14px] font-semibold text-admin-primary hover:underline"
          >
            ← Back
          </Link>
          <h2 className="text-[22px] font-bold text-[#333]">{isEdit ? 'Edit' : 'Add'} Product</h2>
        </div>
        {isEdit ? (
          <Link
            to={`/admin/products/${id}/reviews`}
            className="inline-flex items-center justify-center rounded-md border border-[#ddd] bg-white px-4 py-[10px] text-[13px] font-semibold text-[#555] transition-colors hover:bg-[#f7f7f7]"
          >
            Reviews
          </Link>
        ) : null}
      </div>

      <form onSubmit={onSubmit} noValidate>
        <Panel title="Basic Details">
          <Row label="Title">
            <input
              type="text"
              value={form.title}
              onChange={onTitleChange}
              onBlur={() => checkTitle(form.title)}
              placeholder="Enter title"
              autoComplete="off"
              className={`${FORM_CONTROL} ${invalid('title')} ${titleError ? 'border-[#e53935]' : ''}`}
            />
            <FieldError field="title" />
            {titleError ? <p className="mt-1 text-[12px] text-[#e53935]">{titleError}</p> : null}
          </Row>

          <Row label="Category">
            {/* `.product-select-row` — three columns; Brands is hidden, so two are filled */}
            <div className="grid grid-cols-1 gap-2.5 min-[576px]:grid-cols-3">
              <select
                value={form.category_id}
                onChange={set('category_id')}
                className={`${FORM_CONTROL} ${invalid('category_id')}`}
              >
                <option value="">--Select Category--</option>
                {categories.map((category) => (
                  <option key={category.id} value={String(category.id)}>{category.title}</option>
                ))}
              </select>
              <select
                value={form.sub_category_id}
                onChange={set('sub_category_id')}
                className={FORM_CONTROL}
              >
                <option value="">--Select Sub-Category--</option>
                {visibleSubs.map((sub) => (
                  <option key={sub.id} value={String(sub.id)}>{sub.title}</option>
                ))}
              </select>
            </div>
            <FieldError field="category_id" />
          </Row>

          <Row label="Sort Description" top>
            <textarea
              rows={4}
              value={form.short_description}
              onChange={set('short_description')}
              placeholder="Enter short description"
              className={TEXTAREA}
            />
          </Row>

          <Row label="Products Features" top>
            <Hint className="!mb-2 !mt-0">
              One feature per line. Shown under DESCRIPTION as the “Product Highlights” bullet
              list (separate from the image highlights section below).
            </Hint>
            <textarea
              rows={8}
              value={form.features}
              onChange={set('features')}
              placeholder={'Premium Cotton-Tencel Blend\nTailored Semi-Fitted Silhouette'}
              className={`${TEXTAREA} min-h-[180px]`}
            />
          </Row>
        </Panel>

        {/* Accessories only — the card itself is hidden for every other category */}
        {isAccessory ? (
          <Panel title="Accessory Package Pricing">
            <Hint>
              Optional. Only for Accessories category. Turn this on only if the product sells in
              packs (1 piece / set / free extras). Leave it off to use the normal Selling Price.
            </Hint>

            <div className="mb-3.5">
              <ToggleRow
                label="Enable package pricing for this product"
                checked={form.enable_accessory_packages}
                onChange={flip('enable_accessory_packages')}
              />
            </div>

            {packagesOn ? (
              <>
                <Hint className="!mb-2.5">
                  Add only the packs you need (1, 2, or more). Empty rows are ignored on save.
                </Hint>

                {packages.map((row, index) => (
                  <RepeaterRow
                    key={index}
                    label="Package"
                    index={index}
                    onRemove={() => setPackages((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <div className="grid grid-cols-1 gap-3 min-[576px]:grid-cols-3">
                      <Field label="Package label">
                        <input
                          type="text"
                          value={row.label ?? ''}
                          onChange={(e) => setPackages(patch(index, 'label', e.target.value))}
                          placeholder="e.g. 1 piece / 2 pieces (1 set)"
                          className={FORM_CONTROL}
                        />
                      </Field>
                      <Field label="Package M.R.P. (₹)">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.mrp ?? ''}
                          onChange={(e) => setPackages(patch(index, 'mrp', e.target.value))}
                          placeholder="699"
                          className={FORM_CONTROL}
                        />
                      </Field>
                      <Field label="Package Selling Price (₹)">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.price ?? ''}
                          onChange={(e) => setPackages(patch(index, 'price', e.target.value))}
                          placeholder="549"
                          className={FORM_CONTROL}
                        />
                      </Field>
                    </div>
                  </RepeaterRow>
                ))}

                <div className="mt-2.5 flex flex-wrap gap-2.5">
                  <LightButton onClick={() => setPackages((prev) => [...prev, { label: '', mrp: '', price: '' }])}>
                    + Add Package
                  </LightButton>
                  {/* Replaces the list outright, as `fill-suggested-packages` did */}
                  <LightButton onClick={() => setPackages(SUGGESTED_PACKAGES.map((p) => ({ ...p })))}>
                    Load suggested 4 packs
                  </LightButton>
                </div>
              </>
            ) : null}
          </Panel>
        ) : null}

        <Panel title="Product Pricing">
          {/* `.product-pricing-row` — three equal columns */}
          <div className="grid grid-cols-1 gap-3 min-[576px]:grid-cols-3">
            <Field label="M.R.P :-">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.mrp}
                onChange={set('mrp')}
                className={`${FORM_CONTROL} ${invalid('mrp')}`}
              />
              <FieldError field="mrp" />
            </Field>
            <Field label="Selling Price :-">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.selling_price}
                onChange={set('selling_price')}
                className={`${FORM_CONTROL} ${invalid('selling_price')}`}
              />
              <FieldError field="selling_price" />
            </Field>
            <Field label="Select Offer :-">
              <select value={form.offer_id} onChange={set('offer_id')} className={FORM_CONTROL}>
                <option value="">--Select Offer--</option>
                {offers.map((offer) => (
                  <option key={offer.id} value={String(offer.id)}>
                    {offer.title} ({offer.discountPercent}%)
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 min-[576px]:grid-cols-3">
            <Field label="Max Unit Buy :-">
              <input
                type="number"
                min="1"
                value={form.max_unit_buy}
                onChange={set('max_unit_buy')}
                className={`${FORM_CONTROL} ${invalid('max_unit_buy')}`}
              />
              <FieldError field="max_unit_buy" />
            </Field>
            <Field label="Delivery Charge :-">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.delivery_charge}
                onChange={set('delivery_charge')}
                className={`${FORM_CONTROL} ${invalid('delivery_charge')}`}
              />
              <FieldError field="delivery_charge" />
            </Field>
          </div>
        </Panel>

        <Panel title="Display Options">
          <Hint className="!mb-3">Control where this product appears on the website.</Hint>
          <ToggleRow label="Enable / Active" checked={form.is_active} onChange={flip('is_active')} />
          <ToggleRow label="Featured Product" checked={form.is_featured} onChange={flip('is_featured')} />
          <ToggleRow label="Today's Deal" checked={form.is_todays_deal} onChange={flip('is_todays_deal')} />
          <ToggleRow label="Popular Accessories" checked={form.is_popular_accessory} onChange={flip('is_popular_accessory')} />
          <ToggleRow label="New Arrival" checked={form.is_new_arrival} onChange={flip('is_new_arrival')} />
          <ToggleRow label="Show Size Guide" checked={form.show_size_guide} onChange={flip('show_size_guide')} />
        </Panel>

        <Panel title="Size Guide Content (optional)">
          <Hint className="!mb-3">
            Shown in the size guide drawer when “Show Size Guide” is enabled. Leave empty to use
            the default chart.
          </Hint>
          <Field label="Custom Size Guide Text" className="mb-3.5">
            <textarea
              rows={5}
              value={form.size_guide_content}
              onChange={set('size_guide_content')}
              placeholder="Optional HTML or notes for size guide"
              className={TEXTAREA}
            />
          </Field>
          <Field label="Size Guide Image">
            {current.size_guide_image && !files.size_guide_image ? (
              <div className="mb-2">
                <img
                  src={storageUrl(current.size_guide_image)}
                  alt=""
                  className="max-h-[120px] rounded-lg"
                />
              </div>
            ) : null}
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/*"
              onChange={(e) => setFile('size_guide_image', e.target.files?.[0] ?? null)}
              className={`${FORM_CONTROL} !py-2`}
            />
          </Field>
        </Panel>

        <Panel title="Color & Size">
          <Hint className="!mb-3">
            Select available colors and sizes for this product. Manage master lists under
            Colors / Sizes.
          </Hint>

          {/* `.variant-grid` — two equal columns at an 18px gap */}
          <div className="grid grid-cols-1 gap-[18px] min-[768px]:grid-cols-2">
            <div>
              <label className="mb-2 block text-[14px] font-semibold text-[#555]">Colors</label>
              <div className="flex flex-wrap gap-2">
                {colorList.length === 0 ? (
                  <Hint>
                    No colors yet. <Link to="/admin/colors" className="text-admin-primary underline">Add colors</Link>
                  </Hint>
                ) : (
                  colorList.map((color) => {
                    const key = String(color.id)
                    const row = colors[key] ?? { checked: false, quantity: 0 }
                    return (
                      <label key={key} className="inline-flex items-center gap-1.5 rounded-md border border-[#eee] bg-[#fafafa] px-2.5 py-1.5 text-[13px]">
                        <input
                          type="checkbox"
                          checked={row.checked}
                          onChange={() => toggleVariant(setColors, key)}
                          className="accent-admin-primary"
                        />
                        <span
                          className="inline-block size-[22px] shrink-0 rounded-full border border-[#ddd]"
                          style={{ background: color.code }}
                        />
                        {color.name}
                        {/* The quantity is per-variant STOCK, not a form nicety */}
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.quantity}
                          onChange={(e) => setVariantQuantity(setColors, key, e.target.value)}
                          title="Quantity"
                          aria-label={`${color.name} quantity`}
                          className="ml-1.5 h-8 w-[70px] rounded border border-[#ddd] px-2 text-[13px] outline-none"
                        />
                      </label>
                    )
                  })
                )}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[14px] font-semibold text-[#555]">Sizes</label>
              <div className="flex flex-wrap gap-2">
                {sizeList.length === 0 ? (
                  <Hint>
                    No sizes yet. <Link to="/admin/sizes" className="text-admin-primary underline">Add sizes</Link>
                  </Hint>
                ) : (
                  sizeList.map((size) => {
                    const key = String(size.id)
                    const row = sizes[key] ?? { checked: false, quantity: 0 }
                    return (
                      <label key={key} className="inline-flex items-center gap-1.5 rounded-md border border-[#eee] bg-[#fafafa] px-2.5 py-1.5 text-[13px]">
                        <input
                          type="checkbox"
                          checked={row.checked}
                          onChange={() => toggleVariant(setSizes, key)}
                          className="accent-admin-primary"
                        />
                        {size.name}
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.quantity}
                          onChange={(e) => setVariantQuantity(setSizes, key, e.target.value)}
                          title="Quantity"
                          aria-label={`${size.name} quantity`}
                          className="ml-1.5 h-8 w-[70px] rounded border border-[#ddd] px-2 text-[13px] outline-none"
                        />
                      </label>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Product Image">
          <Hint className="!text-[#e53935]">
            (Recommended resolution: 600x600, 800x800) (Accept png, jpg, jpeg, PNG, JPG, JPEG
            image files)
          </Hint>
          <Hint className="mb-3.5 !text-[#e53935]">
            (Recommended jpg, jpeg, JPG, JPEG image files for best compression ratio)
          </Hint>

          {/* `.product-image-row` — two equal columns */}
          <div className="grid grid-cols-1 gap-3.5 min-[768px]:grid-cols-2">
            <Field label="Featured Image-1 :-">
              <ImageBox
                current={current.featured_image}
                file={files.featured_image}
                onPick={(file) => setFile('featured_image', file)}
              />
              <FieldError field="featured_image" />
            </Field>
            <Field label="Featured Image-2 :-">
              <ImageBox
                current={current.featured_image_2}
                file={files.featured_image_2}
                onPick={(file) => setFile('featured_image_2', file)}
              />
            </Field>
          </div>

          <Field label="Shared Product Gallery :-" className="mt-3.5">
            <Hint className="!mb-2 !mt-0">
              These images show for every colour (or when a colour has no own images).
            </Hint>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              multiple
              onChange={(e) => setFile('gallery', Array.from(e.target.files ?? []))}
              className={`${FORM_CONTROL} !py-2`}
            />
            {sharedGallery.length ? (
              <div className="mt-3 flex flex-wrap gap-2.5">
                {sharedGallery.map((image) => (
                  <GalleryThumb key={image.id} image={image} label="Shared" />
                ))}
              </div>
            ) : null}
          </Field>

          <div className="mt-[18px]">
            <label className="mb-1.5 block text-[13px] font-semibold text-[#666]">
              Colour Gallery Images :-
            </label>
            <Hint className="!mt-0">
              Tick a colour above, then upload images for that colour. Frontend gallery updates
              when the customer selects the colour.
            </Hint>

            {selectedColorIds.length === 0 ? (
              <Hint>Select at least one colour to add colour-specific images.</Hint>
            ) : (
              colorList
                .filter((color) => selectedColorIds.includes(String(color.id)))
                .map((color) => (
                  <div
                    key={color.id}
                    className="mt-3.5 rounded-lg border border-[#e5e0ea] p-3"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className="inline-block size-[22px] shrink-0 rounded-full border border-[#ddd]"
                        style={{ background: color.code }}
                      />
                      <strong className="text-[14px] font-bold text-[#333]">{color.name} images</strong>
                    </div>
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                      multiple
                      onChange={(e) =>
                        setFile(`color_gallery_${color.id}`, Array.from(e.target.files ?? []))
                      }
                      className={`${FORM_CONTROL} !py-2`}
                    />
                    {galleryFor(color.id).length ? (
                      <div className="mt-3 flex flex-wrap gap-2.5">
                        {galleryFor(color.id).map((image) => (
                          <GalleryThumb key={image.id} image={image} label={color.name} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
            )}
          </div>
        </Panel>

        <Panel title="Product Highlights">
          <Hint className="!mb-3">
            Shown on the product details page (image + short text + icon cards).
          </Hint>

          <Row label="Highlights Image" top>
            {current.highlights_image && !files.highlights_image ? (
              <div className="mb-2">
                <img
                  src={storageUrl(current.highlights_image)}
                  alt=""
                  className="max-h-[140px] rounded-lg"
                />
              </div>
            ) : null}
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/*"
              onChange={(e) => setFile('highlights_image', e.target.files?.[0] ?? null)}
              className={`${FORM_CONTROL} !py-2`}
            />
          </Row>

          <Row label="Short Description" top>
            <textarea
              rows={4}
              value={form.highlights_short_description}
              onChange={set('highlights_short_description')}
              placeholder="Short description for Product Highlights"
              className={TEXTAREA}
            />
          </Row>

          <div className="mt-3.5">
            {highlights.map((row, index) => (
              <RepeaterRow
                key={index}
                label="Highlight"
                index={index}
                onRemove={() => setHighlights((prev) => prev.filter((_, i) => i !== index))}
              >
                <div className="grid grid-cols-1 gap-3 min-[576px]:grid-cols-3">
                  <Field label="Title">
                    <input
                      type="text"
                      value={row.title ?? ''}
                      onChange={(e) => setHighlights(patch(index, 'title', e.target.value))}
                      placeholder="e.g. FABRIC"
                      className={FORM_CONTROL}
                    />
                  </Field>
                  <Field label="Sub Title">
                    <input
                      type="text"
                      value={row.subtitle ?? ''}
                      onChange={(e) => setHighlights(patch(index, 'subtitle', e.target.value))}
                      placeholder="e.g. PREMIUM COTTON"
                      className={FORM_CONTROL}
                    />
                  </Field>
                  <Field label="Icon">
                    {row.icon && !files[`highlight_icon_${index}`] ? (
                      <div className="mb-1.5">
                        <img src={storageUrl(row.icon)} alt="" className="h-9" />
                      </div>
                    ) : null}
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.svg,image/*"
                      onChange={(e) => setFile(`highlight_icon_${index}`, e.target.files?.[0] ?? null)}
                      className={`${FORM_CONTROL} !py-2`}
                    />
                  </Field>
                </div>
                <Field label="Description" className="mt-3">
                  <textarea
                    rows={2}
                    value={row.description ?? ''}
                    onChange={(e) => setHighlights(patch(index, 'description', e.target.value))}
                    placeholder="Highlight description"
                    className={`${TEXTAREA} min-h-[80px]`}
                  />
                </Field>
              </RepeaterRow>
            ))}
            <LightButton
              onClick={() =>
                setHighlights((prev) => [...prev, { title: '', subtitle: '', description: '', icon: '' }])
              }
            >
              + Add Highlight
            </LightButton>
          </div>
        </Panel>

        <Panel title="Information Section">
          <Hint className="!mb-3">
            Shown under INFORMATION on the product details page. Edit the “Sizing” row for fit
            advice shown to customers.
          </Hint>

          {information.map((row, index) => (
            <RepeaterRow
              key={index}
              label="Info"
              index={index}
              onRemove={() => setInformation((prev) => prev.filter((_, i) => i !== index))}
            >
              {/* This repeater's grid is 1fr 2fr, not three equal columns */}
              <div className="grid grid-cols-1 gap-3 min-[576px]:grid-cols-[1fr_2fr]">
                <Field label="Title">
                  <input
                    type="text"
                    value={row.title ?? ''}
                    onChange={(e) => setInformation(patch(index, 'title', e.target.value))}
                    placeholder="e.g. Shipping"
                    className={FORM_CONTROL}
                  />
                </Field>
                <Field label="Sub Text">
                  <textarea
                    rows={2}
                    value={row.text ?? ''}
                    onChange={(e) => setInformation(patch(index, 'text', e.target.value))}
                    placeholder="Information text"
                    className={`${TEXTAREA} min-h-[80px]`}
                  />
                </Field>
              </div>
            </RepeaterRow>
          ))}
          <LightButton onClick={() => setInformation((prev) => [...prev, { title: '', text: '' }])}>
            + Add Information
          </LightButton>
        </Panel>

        <Panel title="Specifications">
          <Hint className="!mb-3">
            Key / value rows for SPECIFICATIONS on the product details page. Only rows you add
            here will show (nothing is auto-added).
          </Hint>

          {specifications.map((row, index) => (
            <RepeaterRow
              key={index}
              label="Spec"
              index={index}
              onRemove={() => setSpecifications((prev) => prev.filter((_, i) => i !== index))}
            >
              <div className="grid grid-cols-1 gap-3 min-[576px]:grid-cols-2">
                <Field label="Key">
                  <input
                    type="text"
                    value={row.key ?? ''}
                    onChange={(e) => setSpecifications(patch(index, 'key', e.target.value))}
                    placeholder="e.g. MATERIAL"
                    className={FORM_CONTROL}
                  />
                </Field>
                <Field label="Value">
                  <input
                    type="text"
                    value={row.value ?? ''}
                    onChange={(e) => setSpecifications(patch(index, 'value', e.target.value))}
                    placeholder="e.g. Cotton"
                    className={FORM_CONTROL}
                  />
                </Field>
              </div>
            </RepeaterRow>
          ))}
          <LightButton onClick={() => setSpecifications((prev) => [...prev, { key: '', value: '' }])}>
            + Add Specification
          </LightButton>
        </Panel>

        <Panel title="SEO Content">
          <Row label="SEO Title">
            <input
              type="text"
              value={form.seo_title}
              onChange={set('seo_title')}
              placeholder="Enter SEO title"
              className={FORM_CONTROL}
            />
          </Row>
          <Row label="Meta Description" top>
            <textarea
              rows={4}
              value={form.meta_description}
              onChange={set('meta_description')}
              placeholder="Enter SEO meta description"
              className={TEXTAREA}
            />
          </Row>
          <Row label="Keywords">
            <input
              type="text"
              value={form.meta_keywords}
              onChange={set('meta_keywords')}
              placeholder="Enter SEO keywords"
              className={FORM_CONTROL}
            />
            <p className="mt-1 text-[12px] leading-[1.3] text-[#e53935]">
              (Use comma(,) to separate keyword.)
            </p>
          </Row>
        </Panel>

        {/* `.offer-form-actions` */}
        <div className="flex max-w-[980px] flex-wrap items-center gap-2 pt-[18px]">
          <Button type="submit" loading={saving} disabled={saving}>Save</Button>
          {isEdit ? (
            <Link
              to={`/admin/products/${id}/reviews`}
              className="inline-flex items-center justify-center rounded-md border border-[#ddd] bg-white px-4 py-[10px] text-[13px] font-semibold text-[#555] transition-colors hover:bg-[#f7f7f7]"
            >
              Manage Reviews
            </Link>
          ) : null}
        </div>
      </form>
    </>
  )
}

const TEXTAREA =
  'min-h-[140px] w-full resize-y rounded-md border border-[#ddd] bg-white px-3 py-[11px] text-[14px] outline-none transition-colors focus:border-admin-primary'

/** A setState updater that changes one key of one repeater row. */
const patch = (index, key, value) => (prev) =>
  prev.map((row, i) => (i === index ? { ...row, [key]: value } : row))

/**
 * The JSON-in-longtext columns come back as whatever the admin API read from MySQL — a
 * parsed array on some rows, the raw string on others. Both shapes have to load, or a
 * product's highlights silently reset to one empty row the first time it is edited.
 */
function parseRows(value) {
  if (Array.isArray(value)) return value.map((row) => ({ ...row }))
  if (typeof value !== 'string' || value === '') return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map((row) => ({ ...row })) : []
  } catch {
    return []
  }
}
