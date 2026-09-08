import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Search, Pencil, Check, X } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import Loading from '../../components/common/Loading.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import Pagination from '../../components/common/Pagination.jsx'
import Alert from '../../components/ui/Alert.jsx'
import Button from '../../components/ui/Button.jsx'
import { Field, Input, Textarea, Select, Checkbox } from '../../components/ui/Field.jsx'
import {
  AdminPage,
  Table,
  Th,
  Td,
  EmptyRow,
  AdminButton,
  Pill,
  CONTROL,
} from '../../components/admin/AdminUI.jsx'

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
  const [notice, setNotice] = useState(null)

  const { data, error, loading, refetch } = useApi(
    () => api.admin.products.list({ page, search: search || undefined }),
    [page, search],
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
    setNotice(null)
    const payload = { ...values, colors: variants.colors, sizes: variants.sizes }

    try {
      if (editing === 'new') {
        await api.admin.products.create(payload, files)
      } else {
        await api.admin.products.update(editing, payload, files)
      }
      setEditing(null)
      refetch()
      setNotice('Product saved.')
    } catch (err) {
      if (err.errors) {
        Object.entries(err.errors).forEach(([field, messages]) =>
          setError(field, { type: 'server', message: messages[0] }),
        )
      }
      setNotice(err.message)
    }
  }

  const bulk = async (action) => {
    if (selected.length === 0) return
    if (action === 'delete') {
      // eslint-disable-next-line no-alert
      if (!window.confirm(`Delete ${selected.length} product(s)? This cannot be undone.`)) return
    }
    const result = await api.admin.products.bulk(action, selected)
    setSelected([])
    refetch()
    setNotice(result?.message ?? 'Done.')
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

  return (
    <AdminPage
      title="Products"
      actions={
        <Button type="button" size="sm" onClick={startCreate}>
          <Plus size={15} strokeWidth={1.5} aria-hidden="true" />
          Add product
        </Button>
      }
    >
      {notice && (
        <Alert tone="info" className="mb-5">
          {notice}
        </Alert>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search
            size={16}
            strokeWidth={1.5}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body"
          />
          <label htmlFor="product-search" className="sr-only">
            Search products
          </label>
          <input
            id="product-search"
            type="search"
            placeholder="Search products…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className={`${CONTROL} w-full pl-9`}
          />
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-body">{selected.length} selected</span>
            <AdminButton onClick={() => bulk('enable')}>Enable</AdminButton>
            <AdminButton onClick={() => bulk('disable')}>Disable</AdminButton>
            <AdminButton onClick={() => bulk('set_todays_deal')}>Set deal</AdminButton>
            <AdminButton variant="danger" onClick={() => bulk('delete')}>
              Delete
            </AdminButton>
          </div>
        )}
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

      <Table
        caption="Products"
        head={
          <>
            <Th className="w-10">
              <span className="sr-only">Select</span>
            </Th>
            <Th>Title</Th>
            <Th>Category</Th>
            <Th className="text-right">MRP</Th>
            <Th className="text-right">Price</Th>
            <Th>Active</Th>
            <Th className="text-right">
              <span className="sr-only">Actions</span>
            </Th>
          </>
        }
      >
        {(data?.items ?? []).map((item) => (
          <tr key={item.id}>
            <Td>
              <input
                type="checkbox"
                className="size-4 accent-brand"
                checked={selected.includes(item.id)}
                onChange={() => toggleSelected(item.id)}
                aria-label={`Select ${item.title}`}
              />
            </Td>
            <Td className="font-medium">{item.title}</Td>
            <Td>{item.category?.title ?? '—'}</Td>
            <Td className="whitespace-nowrap text-right">{item.mrp}</Td>
            <Td className="whitespace-nowrap text-right">{item.sellingPrice}</Td>
            <Td>
              <button
                type="button"
                onClick={async () => {
                  await api.admin.products.toggle(item.id)
                  refetch()
                }}
                aria-label={`${item.isActive ? 'Deactivate' : 'Activate'} ${item.title}`}
              >
                <Pill tone={item.isActive ? 'good' : 'neutral'}>
                  {item.isActive ? (
                    <Check size={13} strokeWidth={2} aria-hidden="true" className="mr-1" />
                  ) : (
                    <X size={13} strokeWidth={2} aria-hidden="true" className="mr-1" />
                  )}
                  {item.isActive ? 'Yes' : 'No'}
                </Pill>
              </button>
            </Td>
            <Td className="text-right">
              <AdminButton onClick={() => startEdit(item)}>
                <Pencil size={14} strokeWidth={1.5} aria-hidden="true" />
                Edit
                <span className="sr-only"> {item.title}</span>
              </AdminButton>
            </Td>
          </tr>
        ))}

        {data?.items?.length === 0 && <EmptyRow colSpan={7}>No products found.</EmptyRow>}
      </Table>

      <Pagination pagination={data?.pagination} onPage={setPage} />
    </AdminPage>
  )
}
