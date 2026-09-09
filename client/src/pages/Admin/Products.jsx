import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Search, Pencil, Trash2, Eye, Star } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import { toast } from '../../store/toast.js'
import * as api from '../../services/endpoints.js'
import Loading from '../../components/common/Loading.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import Pagination from '../../components/common/Pagination.jsx'
import Alert from '../../components/ui/Alert.jsx'
import Button from '../../components/ui/Button.jsx'
import { Field, Input, Textarea, Select, Checkbox } from '../../components/ui/Field.jsx'
import { ConfirmDialog, CONTROL } from '../../components/admin/AdminUI.jsx'
import { Toggle } from '../../components/admin/AdminControls.jsx'
import { storageUrl, discountPercent } from '../../utils/admin-media.js'

/** Blade's placeholder when a product has no featured image. */
const PRODUCT_FALLBACK = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80'

const FLAGS = [
  ['is_active', 'Active'],
  ['is_featured', 'Featured'],
  ['is_new_arrival', 'New arrival'],
  ['is_todays_deal', "Today's deal"],
  ['is_popular_accessory', 'Popular accessory'],
]

/**
 * Product management.
 *
 * The variant editor sends `colors` / `sizes` as `{ id, quantity }` pairs. The server
 * syncs them with a delete-missing / upsert-present pass, so editing a description does
 * not disturb stock — and omitting the fields entirely leaves the pivots untouched.
 */
export default function Products() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [files, setFiles] = useState({})
  const [variants, setVariants] = useState({ colors: [], sizes: [] })
  const [selected, setSelected] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [offerId, setOfferId] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [confirmId, setConfirmId] = useState(null)

  // The category and offer filters are query parameters, as they are in Laravel — the
  // controller reads `category_id` and `offer_id` off the request.
  const { data, error, loading, refetch } = useApi(
    () =>
      api.admin.products.list({
        page,
        search: search || undefined,
        category_id: categoryId || undefined,
        offer_id: offerId || undefined,
      }),
    [page, search, categoryId, offerId],
  )

  const { data: formData } = useApi(() => api.admin.products.formData(), [])

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm()

  if (loading && !data) return <Loading full />
  if (error) return <ErrorMessage error={error} onRetry={refetch} />

  const startCreate = () => {
    setEditing('new')
    setFiles({})
    setVariants({ colors: [], sizes: [] })
    reset({
      title: '',
      category_id: '',
      sub_category_id: '',
      brand_id: '',
      offer_id: '',
      short_description: '',
      mrp: '',
      selling_price: '',
      max_unit_buy: 1,
      delivery_charge: 0,
      is_active: true,
    })
  }

  const startEdit = async (row) => {
    const { item } = await api.admin.products.show(row.id)
    setEditing(item.id)
    setFiles({})
    setVariants({
      colors: (item.colors ?? []).map((c) => ({ id: Number(c.color.id), quantity: c.quantity })),
      sizes: (item.sizes ?? []).map((s) => ({ id: Number(s.size.id), quantity: s.quantity })),
    })
    reset({
      title: item.title,
      category_id: item.categoryId ?? item.category?.id ?? '',
      sub_category_id: item.subCategoryId ?? item.subCategory?.id ?? '',
      brand_id: item.brandId ?? item.brand?.id ?? '',
      offer_id: item.offerId ?? item.offer?.id ?? '',
      short_description: item.shortDescription ?? '',
      mrp: item.mrp,
      selling_price: item.sellingPrice,
      max_unit_buy: item.maxUnitBuy,
      delivery_charge: item.deliveryCharge,
      is_active: item.isActive,
      is_featured: item.isFeatured,
      is_new_arrival: item.isNewArrival,
      is_todays_deal: item.isTodaysDeal,
      is_popular_accessory: item.isPopularAccessory,
    })
  }

  const setVariantQuantity = (kind, id, quantity) => {
    setVariants((current) => {
      const list = current[kind].filter((v) => v.id !== id)
      // A blank quantity removes the variant entirely.
      if (quantity === '' || quantity === null) return { ...current, [kind]: list }
      return { ...current, [kind]: [...list, { id, quantity: Math.max(0, Number(quantity)) }] }
    })
  }

  const onSubmit = async (values) => {
    const payload = { ...values, colors: variants.colors, sizes: variants.sizes }

    try {
      const res = editing === 'new'
        ? await api.admin.products.create(payload, files)
        : await api.admin.products.update(editing, payload, files)
      setEditing(null)
      refetch()
      toast.success(res.$message)
    } catch (err) {
      if (err.errors) {
        Object.entries(err.errors).forEach(([field, messages]) =>
          setError(field, { type: 'server', message: messages[0] }),
        )
      }
      toast.error(err.message)
    }
  }

  const bulk = async (action) => {
    if (selected.length === 0) return
    if (action === 'delete') {
      // eslint-disable-next-line no-alert
      if (!window.confirm(`Delete ${selected.length} product(s)? This cannot be undone.`)) return
    }
    try {
      const result = await api.admin.products.bulk(action, selected)
      setSelected([])
      refetch()
      toast.success(result?.$message ?? 'Done.')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const toggleSelected = (id) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
    )

  /** One stock input per colour or size. */
  const variantGrid = (kind, options, prefix) => (
    <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {options.map((option) => {
        const current = variants[kind].find((v) => v.id === Number(option.id))
        const id = `${prefix}-${option.id}`

        return (
          <div key={option.id}>
            <label htmlFor={id} className="mb-1 block text-[13px] text-ink">
              {option.name}
            </label>
            <input
              id={id}
              type="number"
              min="0"
              value={current?.quantity ?? ''}
              onChange={(e) => setVariantQuantity(kind, Number(option.id), e.target.value)}
              className={`${CONTROL} w-full`}
            />
          </div>
        )
      })}
    </div>
  )

  const categoryOptions = formData?.categories ?? []
  const offerOptions = formData?.offers ?? []
  const items = data?.items ?? []
  const allSelected = items.length > 0 && items.every((item) => selected.includes(item.id))

  /* .product-add-btn / .product-action-btn — 40px tall, 0 18px, 6px radius */
  const panelButton =
    'inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md bg-admin-primary px-[18px] text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-dark'

  /*
   * `.product-card-actions .icon-btn` — 34px, 1px #eee, white; `.active` turns the border
   * #ffe082 and the glyph #f9a825.
   *
   * Written as one branch rather than a base plus an override: `border-[#ffe082]` and
   * `border-admin-line` carry identical specificity, so stacking them leaves the winner to
   * whichever Tailwind happens to emit last — which is how the amber border silently went
   * missing while the amber glyph applied.
   */
  const cardIcon = (featured) =>
    `inline-flex size-[34px] items-center justify-center rounded-full border bg-white transition-colors ${
      featured ? 'border-[#ffe082] text-[#f9a825]' : 'border-admin-line text-[#555] hover:bg-[#fafafa]'
    }`

  return (
    <>
      {/* .product-panel — white, 10px radius, 18px 20px, 0 1px 4px rgba(0,0,0,.04) */}
      <div className="mb-[18px] rounded-[10px] bg-white px-5 py-[18px] shadow-[0_1px_4px_rgba(0,0,0,0.04)] max-sm:p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 max-sm:flex-col max-sm:items-stretch">
          <h2 className="text-[22px] font-semibold text-[#444]">Products</h2>

          <div className="flex flex-wrap items-center gap-3 max-sm:w-full">
            {/* .product-search is a 40px PILL with the icon on the RIGHT — not the square
                .search-box the other modules use. */}
            <div className="flex h-10 min-w-[220px] items-center rounded-full border border-[#e0e0e0] bg-white pl-4 pr-1 max-sm:w-full">
              <input
                type="text"
                placeholder="Search here..."
                autoComplete="off"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                className="min-w-0 flex-1 border-none bg-transparent text-[14px] text-[#555] outline-none placeholder:text-[#bdbdbd]"
              />
              <button type="button" aria-label="Search" className="inline-flex size-9 items-center justify-center rounded-full text-[#bdbdbd]">
                <Search size={16} />
              </button>
            </div>

            <button type="button" className={panelButton} onClick={startCreate}>Add New</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1 max-sm:flex-col max-sm:items-stretch">
          {/* .product-filters — 14px gap. Brands is withheld here for the same reason it is
              withheld from the sidebar: the Blade gates it behind $showBrands = false. */}
          <div className="flex flex-wrap gap-3.5 max-sm:w-full">
            <select
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value)
                setPage(1)
              }}
              className="h-10 rounded-md border border-[#e0e0e0] bg-white px-3 text-[14px] text-[#555] outline-none max-sm:w-full"
            >
              <option value="">---All Category---</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>{category.title}</option>
              ))}
            </select>

            <select
              value={offerId}
              onChange={(event) => {
                setOfferId(event.target.value)
                setPage(1)
              }}
              className="h-10 rounded-md border border-[#e0e0e0] bg-white px-3 text-[14px] text-[#555] outline-none max-sm:w-full"
            >
              <option value="">---All Offers---</option>
              {offerOptions.map((offer) => (
                <option key={offer.id} value={offer.id}>{offer.title}</option>
              ))}
            </select>
          </div>

          {/* .product-bulk — Select All beside the Action dropdown */}
          <div className="flex items-center gap-3.5 max-sm:w-full max-sm:justify-end">
            <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[13px] font-medium text-[#555]">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? [] : items.map((item) => item.id))}
                className="size-[15px] accent-admin-primary"
              />
              Select All
            </label>

            <div className="relative">
              <button type="button" className={panelButton} onClick={() => setBulkOpen((v) => !v)}>
                Action <span className="ml-1 text-[10px]">&#9662;</span>
              </button>

              {bulkOpen ? (
                /* .bulk-action-menu — the five actions, in the original's order and wording,
                   including "Set to todays Deal" as written. */
                <div className="absolute right-0 top-[calc(100%+4px)] z-20 min-w-[190px] overflow-hidden rounded-lg border border-admin-line bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                  {[
                    ['enable', 'Enable'],
                    ['disable', 'Disable'],
                    ['delete', 'Delete'],
                    ['set_todays_deal', 'Set to todays Deal'],
                    ['remove_todays_deal', 'Remove to todays Deal'],
                  ].map(([action, label]) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => {
                        setBulkOpen(false)
                        bulk(action)
                      }}
                      className="block w-full bg-white px-3.5 py-2.5 text-left text-[13px] text-[#333] hover:bg-[#f7f7f7]"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mb-8 border border-line p-5">
          <h2 className="text-[17px] font-semibold text-ink">
            {editing === 'new' ? 'New product' : 'Edit product'}
          </h2>

          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Title" htmlFor="p-title" required error={errors.title?.message}>
              {/* products.title is UNIQUE, so a duplicate is reported here. */}
              <Input
                id="p-title"
                error={errors.title}
                {...register('title', { required: 'Please enter a product title.' })}
              />
            </Field>

            <Field label="Category" htmlFor="p-category" required>
              <Select id="p-category" {...register('category_id', { required: true })}>
                <option value="">— choose —</option>
                {(formData?.categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Sub-category" htmlFor="p-subcategory">
              <Select id="p-subcategory" {...register('sub_category_id')}>
                <option value="">— none —</option>
                {(formData?.subCategories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Brand" htmlFor="p-brand">
              <Select id="p-brand" {...register('brand_id')}>
                <option value="">— none —</option>
                {(formData?.brands ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Offer" htmlFor="p-offer">
              <Select id="p-offer" {...register('offer_id')}>
                <option value="">— none —</option>
                {(formData?.offers ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="MRP" htmlFor="p-mrp" required>
              <Input id="p-mrp" type="number" step="0.01" {...register('mrp', { required: true })} />
            </Field>

            <Field label="Selling price" htmlFor="p-selling">
              <Input id="p-selling" type="number" step="0.01" {...register('selling_price')} />
            </Field>

            <Field label="Max per order" htmlFor="p-max">
              <Input id="p-max" type="number" {...register('max_unit_buy')} />
            </Field>

            <Field label="Delivery charge" htmlFor="p-delivery">
              <Input id="p-delivery" type="number" step="0.01" {...register('delivery_charge')} />
            </Field>
          </div>

          <Field label="Short description" htmlFor="p-desc" className="mt-5">
            <Textarea id="p-desc" rows={3} {...register('short_description')} />
          </Field>

          <fieldset className="mt-6 border border-line p-4">
            <legend className="px-2 text-[14px] font-semibold text-ink">Stock by colour</legend>
            <p className="text-[12px] text-body">
              Leave a quantity blank to remove that colour. These figures are the live stock the
              cart enforces.
            </p>
            {variantGrid('colors', formData?.colors ?? [], 'c')}
          </fieldset>

          <fieldset className="mt-5 border border-line p-4">
            <legend className="px-2 text-[14px] font-semibold text-ink">Stock by size</legend>
            {variantGrid('sizes', formData?.sizes ?? [], 's')}
          </fieldset>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field label="Featured image" htmlFor="p-featured-image">
              <input
                id="p-featured-image"
                type="file"
                accept="image/*"
                onChange={(e) => setFiles((f) => ({ ...f, featured_image: e.target.files?.[0] }))}
                className="w-full border border-line bg-white p-2 text-[13px] text-ink file:mr-3 file:border-0 file:bg-sand file:px-3 file:py-1.5 file:text-[13px] file:text-ink"
              />
            </Field>

            <Field label="Gallery images" htmlFor="p-gallery">
              <input
                id="p-gallery"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles((f) => ({ ...f, gallery: e.target.files }))}
                className="w-full border border-line bg-white p-2 text-[13px] text-ink file:mr-3 file:border-0 file:bg-sand file:px-3 file:py-1.5 file:text-[13px] file:text-ink"
              />
            </Field>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
            {FLAGS.map(([name, label]) => (
              <Checkbox key={name} id={`p-${name}`} label={label} {...register(name)} />
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm" loading={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save product'}
            </Button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-[13px] text-body underline underline-offset-2 transition-colors hover:text-brand"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* .product-grid — auto-fill minmax(260px, 1fr), 16px gap */}
      <div className="grid grid-cols-1 gap-4 min-[576px]:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
        {items.map((item) => (
          <div key={item.id} className="flex flex-col overflow-hidden rounded-[10px] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
              <span className="text-[12px] font-bold text-[#666]">{item.category?.title ?? '\u2014'}</span>
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => toggleSelected(item.id)}
                aria-label={`Select ${item.title}`}
                className="size-[15px] accent-admin-primary"
              />
            </div>

            {/* .product-card-media — a fixed 200px band, cover, #f0f0f0 behind it */}
            <div
              className="relative h-[200px] bg-[#f0f0f0] bg-cover bg-center"
              style={{ backgroundImage: `url('${storageUrl(item.featuredImage, PRODUCT_FALLBACK)}')` }}
            >
              {discountPercent(item) > 0 ? (
                <span className="absolute left-0 top-2.5 rounded-r bg-admin-primary px-2.5 py-1 text-[11px] font-bold text-white">
                  {discountPercent(item)}% OFF
                </span>
              ) : null}

              {/* .product-card-info — gradient plate over the foot of the image. The title is
                  cut at 36 characters, which is Str::limit's length in the Blade. */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-7 text-white">
                <h3 title={item.title} className="text-[14px] font-bold leading-[1.3]">
                  {item.title && item.title.length > 36 ? `${item.title.slice(0, 36)}...` : item.title}
                </h3>
                <p className="mt-0.5 text-[12px] opacity-90">
                  {item.subCategory?.title ?? item.category?.title ?? ''}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-1.5 border-t border-[#f0f0f0] px-3 py-2.5">
              <button type="button" title="View" className={cardIcon(false)} onClick={() => startEdit(item)}>
                <Eye size={15} />
              </button>

              <button
                type="button"
                title="Featured"
                className={cardIcon(item.isFeatured)}
                onClick={async () => {
                  try {
                    toast.success((await api.admin.products.toggleFeatured(item.id)).$message)
                    refetch()
                  } catch (err) {
                    toast.error(err.message)
                  }
                }}
              >
                <Star size={15} fill={item.isFeatured ? 'currentColor' : 'none'} />
              </button>

              <button type="button" title="Edit" className={cardIcon(false)} onClick={() => startEdit(item)}>
                <Pencil size={15} />
              </button>

              <button type="button" title="Delete" className={cardIcon(false)} onClick={() => setConfirmId(item.id)}>
                <Trash2 size={15} />
              </button>

              <Toggle
                checked={Boolean(item.isActive)}
                title="Enable / Disable"
                onChange={async () => {
                  try {
                    toast.success((await api.admin.products.toggle(item.id)).$message)
                    refetch()
                  } catch (err) {
                    toast.error(err.message)
                  }
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {!loading && items.length === 0 ? (
        <div className="rounded-[10px] bg-white p-6 text-center text-[#888]">No products found.</div>
      ) : null}

      <Pagination pagination={data?.pagination} onPage={setPage} />

      <ConfirmDialog
        open={confirmId !== null}
        onCancel={() => setConfirmId(null)}
        onProceed={async () => {
          try {
            toast.success((await api.admin.products.remove(confirmId)).$message)
            refetch()
          } catch (err) {
            toast.error(err.message)
          }
          setConfirmId(null)
        }}
      />
    </>
  )
}
