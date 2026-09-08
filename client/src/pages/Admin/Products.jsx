import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import Loading from '../../components/common/Loading.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import Pagination from '../../components/common/Pagination.jsx'

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 24 }}>Products</h1>
        <button type="button" className="btn btn-primary" onClick={startCreate}>
          Add product
        </button>
      </div>

      {notice && (
        <div className="alert alert-info" role="status">
          {notice}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, margin: '16px 0', flexWrap: 'wrap' }}>
        <input
          className="form-control"
          placeholder="Search products…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          style={{ maxWidth: 300 }}
          aria-label="Search products"
        />

        {selected.length > 0 && (
          <>
            <span style={{ alignSelf: 'center' }}>{selected.length} selected</span>
            <button type="button" onClick={() => bulk('enable')}>Enable</button>
            <button type="button" onClick={() => bulk('disable')}>Disable</button>
            <button type="button" onClick={() => bulk('set_todays_deal')}>Set deal</button>
            <button type="button" onClick={() => bulk('delete')}>Delete</button>
          </>
        )}
      </div>

      {editing && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          style={{ border: '1px solid #eee', padding: 20, marginBottom: 24 }}
        >
          <h2 style={{ fontSize: 18 }}>{editing === 'new' ? 'New product' : 'Edit product'}</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 14 }}>
            <div className="form-group">
              <label htmlFor="p-title">Title</label>
              <input
                id="p-title"
                className="form-control"
                {...register('title', { required: 'Please enter a product title.' })}
              />
              {/* products.title is UNIQUE, so a duplicate is reported here. */}
              {errors.title && <p style={{ color: '#b00', fontSize: 13 }}>{errors.title.message}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="p-category">Category</label>
              <select id="p-category" className="form-control" {...register('category_id', { required: true })}>
                <option value="">— choose —</option>
                {(formData?.categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="p-subcategory">Sub-category</label>
              <select id="p-subcategory" className="form-control" {...register('sub_category_id')}>
                <option value="">— none —</option>
                {(formData?.subCategories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="p-brand">Brand</label>
              <select id="p-brand" className="form-control" {...register('brand_id')}>
                <option value="">— none —</option>
                {(formData?.brands ?? []).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="p-offer">Offer</label>
              <select id="p-offer" className="form-control" {...register('offer_id')}>
                <option value="">— none —</option>
                {(formData?.offers ?? []).map((o) => (
                  <option key={o.id} value={o.id}>{o.title}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="p-mrp">MRP</label>
              <input id="p-mrp" type="number" step="0.01" className="form-control" {...register('mrp', { required: true })} />
            </div>

            <div className="form-group">
              <label htmlFor="p-selling">Selling price</label>
              <input id="p-selling" type="number" step="0.01" className="form-control" {...register('selling_price')} />
            </div>

            <div className="form-group">
              <label htmlFor="p-max">Max per order</label>
              <input id="p-max" type="number" className="form-control" {...register('max_unit_buy')} />
            </div>

            <div className="form-group">
              <label htmlFor="p-delivery">Delivery charge</label>
              <input id="p-delivery" type="number" step="0.01" className="form-control" {...register('delivery_charge')} />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="p-desc">Short description</label>
            <textarea id="p-desc" rows="3" className="form-control" {...register('short_description')} />
          </div>

          <fieldset style={{ border: '1px solid #eee', padding: 14, marginTop: 12 }}>
            <legend style={{ fontSize: 15 }}>Stock by colour</legend>
            <p style={{ fontSize: 12, opacity: 0.7 }}>
              Leave a quantity blank to remove that colour. These figures are the live stock the
              cart enforces.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 10 }}>
              {(formData?.colors ?? []).map((color) => {
                const current = variants.colors.find((v) => v.id === Number(color.id))
                return (
                  <div key={color.id}>
                    <label htmlFor={`c-${color.id}`}>{color.name}</label>
                    <input
                      id={`c-${color.id}`}
                      type="number"
                      min="0"
                      className="form-control"
                      value={current?.quantity ?? ''}
                      onChange={(e) => setVariantQuantity('colors', Number(color.id), e.target.value)}
                    />
                  </div>
                )
              })}
            </div>
          </fieldset>

          <fieldset style={{ border: '1px solid #eee', padding: 14, marginTop: 12 }}>
            <legend style={{ fontSize: 15 }}>Stock by size</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 10 }}>
              {(formData?.sizes ?? []).map((size) => {
                const current = variants.sizes.find((v) => v.id === Number(size.id))
                return (
                  <div key={size.id}>
                    <label htmlFor={`s-${size.id}`}>{size.name}</label>
                    <input
                      id={`s-${size.id}`}
                      type="number"
                      min="0"
                      className="form-control"
                      value={current?.quantity ?? ''}
                      onChange={(e) => setVariantQuantity('sizes', Number(size.id), e.target.value)}
                    />
                  </div>
                )
              })}
            </div>
          </fieldset>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 12, marginTop: 14 }}>
            <div>
              <label htmlFor="p-featured-image">Featured image</label>
              <input
                id="p-featured-image"
                type="file"
                accept="image/*"
                className="form-control"
                onChange={(e) => setFiles((f) => ({ ...f, featured_image: e.target.files?.[0] }))}
              />
            </div>
            <div>
              <label htmlFor="p-gallery">Gallery images</label>
              <input
                id="p-gallery"
                type="file"
                accept="image/*"
                multiple
                className="form-control"
                onChange={(e) => setFiles((f) => ({ ...f, gallery: e.target.files }))}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
            {[
              ['is_active', 'Active'],
              ['is_featured', 'Featured'],
              ['is_new_arrival', 'New arrival'],
              ['is_todays_deal', "Today's deal"],
              ['is_popular_accessory', 'Popular accessory'],
            ].map(([name, label]) => (
              <label key={name} htmlFor={`p-${name}`}>
                <input id={`p-${name}`} type="checkbox" {...register(name)} /> {label}
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save product'}
            </button>
            <button type="button" className="btn btn-link" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Select</span></th>
            <th scope="col">Title</th>
            <th scope="col">Category</th>
            <th scope="col">MRP</th>
            <th scope="col">Price</th>
            <th scope="col">Active</th>
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {(data?.items ?? []).map((item) => (
            <tr key={item.id}>
              <td>
                <input
                  type="checkbox"
                  checked={selected.includes(item.id)}
                  onChange={() => toggleSelected(item.id)}
                  aria-label={`Select ${item.title}`}
                />
              </td>
              <td>{item.title}</td>
              <td>{item.category?.title ?? '—'}</td>
              <td>{item.mrp}</td>
              <td>{item.sellingPrice}</td>
              <td>
                <button type="button" onClick={async () => { await api.admin.products.toggle(item.id); refetch() }}>
                  {item.isActive ? 'Yes' : 'No'}
                </button>
              </td>
              <td>
                <button type="button" onClick={() => startEdit(item)}>Edit</button>
              </td>
            </tr>
          ))}

          {data?.items?.length === 0 && (
            <tr>
              <td colSpan="7" style={{ opacity: 0.6 }}>No products found.</td>
            </tr>
          )}
        </tbody>
      </table>

      <Pagination pagination={data?.pagination} onPage={setPage} />
    </div>
  )
}
