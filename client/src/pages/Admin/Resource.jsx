import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import Loading from '../../components/common/Loading.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import Pagination from '../../components/common/Pagination.jsx'
import Contacts from './Contacts.jsx'

/**
 * Generic admin CRUD screen.
 *
 * The backend consolidated seven near-identical Laravel controllers behind one factory;
 * this is the matching front end. Each resource declares its fields, so behaviour stays
 * per-resource while the table, form and pagination are written once.
 */

const TEXT = 'text'
const CHECK = 'checkbox'
const NUMBER = 'number'
const TEXTAREA = 'textarea'
const SELECT = 'select'

const RESOURCES = {
  categories: {
    label: 'Category',
    client: api.admin.categories,
    image: 'image',
    fields: [
      { name: 'title', label: 'Title', type: TEXT, required: true },
      { name: 'short_description', label: 'Short description', type: TEXT },
      { name: 'has_color', label: 'Has colours', type: CHECK },
      { name: 'has_size', label: 'Has sizes', type: CHECK },
      { name: 'show_on_home', label: 'Show on home', type: CHECK },
      { name: 'sort_order', label: 'Sort order', type: NUMBER },
      { name: 'is_active', label: 'Active', type: CHECK },
    ],
    columns: [['title', 'Title'], ['slug', 'Slug'], ['sortOrder', 'Sort']],
  },
  'sub-categories': {
    label: 'Sub-category',
    client: api.admin.subCategories,
    image: 'image',
    fields: [
      { name: 'category_id', label: 'Category', type: SELECT, source: 'categories', required: true },
      { name: 'title', label: 'Title', type: TEXT, required: true },
      { name: 'sort_order', label: 'Sort order', type: NUMBER },
      { name: 'is_active', label: 'Active', type: CHECK },
    ],
    columns: [['title', 'Title'], ['slug', 'Slug']],
  },
  brands: {
    label: 'Brand',
    client: api.admin.brands,
    image: 'image',
    fields: [
      { name: 'name', label: 'Name', type: TEXT, required: true },
      { name: 'sort_order', label: 'Sort order', type: NUMBER },
      { name: 'is_active', label: 'Active', type: CHECK },
    ],
    columns: [['name', 'Name'], ['slug', 'Slug']],
  },
  colors: {
    label: 'Colour',
    client: api.admin.colors,
    fields: [
      { name: 'name', label: 'Name', type: TEXT, required: true },
      { name: 'code', label: 'Hex code', type: TEXT },
      { name: 'sort_order', label: 'Sort order', type: NUMBER },
      { name: 'is_active', label: 'Active', type: CHECK },
    ],
    columns: [['name', 'Name'], ['code', 'Code']],
  },
  sizes: {
    label: 'Size',
    client: api.admin.sizes,
    fields: [
      { name: 'name', label: 'Name', type: TEXT, required: true },
      { name: 'sort_order', label: 'Sort order', type: NUMBER },
      { name: 'is_active', label: 'Active', type: CHECK },
    ],
    columns: [['name', 'Name']],
  },
  offers: {
    label: 'Offer',
    client: api.admin.offers,
    image: 'image',
    fields: [
      { name: 'title', label: 'Title', type: TEXT, required: true },
      { name: 'description', label: 'Description', type: TEXTAREA },
      { name: 'discount_percent', label: 'Discount %', type: NUMBER },
      { name: 'sort_order', label: 'Sort order', type: NUMBER },
      { name: 'is_active', label: 'Active', type: CHECK },
    ],
    columns: [['title', 'Title'], ['discountPercent', 'Discount %']],
  },
  'news-types': {
    label: 'News type',
    client: api.admin.newsTypes,
    fields: [
      { name: 'title', label: 'Title', type: TEXT, required: true },
      { name: 'sort_order', label: 'Sort order', type: NUMBER },
      { name: 'is_active', label: 'Active', type: CHECK },
    ],
    columns: [['title', 'Title'], ['slug', 'Slug']],
  },
  'blog-posts': {
    label: 'Blog post',
    client: api.admin.blogPosts,
    image: 'image',
    fields: [
      { name: 'title', label: 'Title', type: TEXT, required: true },
      { name: 'news_type_id', label: 'News type', type: SELECT, source: 'news-types' },
      { name: 'author_name', label: 'Author', type: TEXT },
      { name: 'excerpt', label: 'Excerpt', type: TEXTAREA },
      { name: 'content', label: 'Content (HTML)', type: TEXTAREA },
      { name: 'published_at', label: 'Publish date', type: 'date' },
      { name: 'is_featured', label: 'Featured', type: CHECK },
      { name: 'is_active', label: 'Active', type: CHECK },
    ],
    columns: [['title', 'Title'], ['authorName', 'Author']],
  },
  coupons: {
    label: 'Coupon',
    client: api.admin.coupons,
    image: 'image',
    fields: [
      { name: 'code', label: 'Code', type: TEXT, required: true },
      {
        name: 'offer_type',
        label: 'Type',
        type: SELECT,
        options: [
          ['coupon', 'Standard'],
          ['bogo', 'Buy X Get Y'],
        ],
      },
      {
        name: 'discount_type',
        label: 'Discount type',
        type: SELECT,
        options: [
          ['percent', 'Percentage'],
          ['amount', 'Fixed amount'],
        ],
      },
      { name: 'discount_percent', label: 'Discount %', type: NUMBER },
      { name: 'discount_amount', label: 'Discount amount', type: NUMBER },
      { name: 'bogo_buy_quantity', label: 'BOGO buy qty', type: NUMBER },
      { name: 'bogo_get_quantity', label: 'BOGO get qty', type: NUMBER },
      { name: 'max_discount_status', label: 'Cap discount', type: CHECK },
      { name: 'max_discount_amount', label: 'Maximum discount', type: NUMBER },
      { name: 'min_cart_status', label: 'Minimum cart', type: CHECK },
      { name: 'min_cart_amount', label: 'Minimum cart amount', type: NUMBER },
      { name: 'min_quantity', label: 'Minimum quantity', type: NUMBER },
      { name: 'usage_limit', label: 'Total usage limit', type: NUMBER },
      { name: 'max_use_per_user', label: 'One use per customer', type: CHECK },
      { name: 'new_customers_only', label: 'New customers only', type: CHECK },
      { name: 'members_only', label: 'Members only', type: CHECK },
      { name: 'free_shipping', label: 'Free shipping', type: CHECK },
      { name: 'starts_at', label: 'Starts', type: 'date' },
      { name: 'ends_at', label: 'Ends', type: 'date' },
      { name: 'is_public', label: 'Publicly listed', type: CHECK },
      { name: 'is_active', label: 'Active', type: CHECK },
    ],
    columns: [
      ['code', 'Code'],
      ['offerType', 'Type'],
      ['usedCount', 'Used'],
      ['usageLimit', 'Limit'],
    ],
  },
  users: {
    label: 'User',
    client: api.admin.users,
    fields: [
      { name: 'name', label: 'Name', type: TEXT, required: true },
      { name: 'username', label: 'Username', type: TEXT },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: TEXT },
      {
        name: 'role',
        label: 'Role',
        type: SELECT,
        options: [
          ['customer', 'Customer'],
          ['admin', 'Admin'],
        ],
      },
      { name: 'password', label: 'Password (leave blank to keep)', type: 'password' },
      { name: 'is_active', label: 'Active', type: CHECK },
    ],
    columns: [['name', 'Name'], ['email', 'Email'], ['role', 'Role']],
  },
  banners: {
    label: 'Banner',
    client: api.admin.banners,
    fields: [
      { name: 'title', label: 'Title', type: TEXT, required: true },
      { name: 'section', label: 'Section', type: TEXT, required: true },
      { name: 'subtitle', label: 'Subtitle', type: TEXT },
      { name: 'description', label: 'Description', type: TEXTAREA },
      { name: 'button_text', label: 'Button text', type: TEXT },
      { name: 'button_link', label: 'Button link', type: TEXT },
      { name: 'sort_order', label: 'Sort order', type: NUMBER },
      { name: 'is_active', label: 'Active', type: CHECK },
    ],
    columns: [['title', 'Title'], ['section', 'Section']],
  },
}

export default function Resource() {
  const { resource } = useParams()
  const config = RESOURCES[resource]

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [file, setFile] = useState(null)
  const [notice, setNotice] = useState(null)

  const { data, error, loading, refetch } = useApi(
    () => (config ? config.client.list({ page, search: search || undefined }) : Promise.resolve(null)),
    [resource, page, search],
  )

  // Select options are loaded from their own resource so the lists stay in sync.
  const { data: selectSource } = useApi(async () => {
    const sources = (config?.fields ?? []).filter((f) => f.source).map((f) => f.source)
    const entries = await Promise.all(
      sources.map(async (name) => [name, (await RESOURCES[name].client.list({ per_page: 100 })).items]),
    )
    return Object.fromEntries(entries)
  }, [resource])

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm()

  // Contacts has two lists rather than one, so it has its own screen.
  if (resource === 'contacts') return <Contacts />

  if (!config) {
    return (
      <div>
        <h1 style={{ fontSize: 24 }}>Not found</h1>
        <p style={{ opacity: 0.7 }}>No admin screen exists for “{resource}”.</p>
      </div>
    )
  }

  if (loading && !data) return <Loading full />
  if (error) return <ErrorMessage error={error} onRetry={refetch} />

  const startCreate = () => {
    setEditing('new')
    setFile(null)
    reset(Object.fromEntries(config.fields.map((f) => [f.name, f.type === CHECK ? true : ''])))
  }

  const startEdit = (item) => {
    setEditing(item.id)
    setFile(null)
    reset(
      Object.fromEntries(
        config.fields.map((field) => {
          const camel = field.name.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
          const value = item[camel] ?? item[field.name] ?? ''
          if (field.type === 'date' && value) return [field.name, String(value).slice(0, 10)]
          if (field.name === 'password') return [field.name, '']
          return [field.name, value ?? '']
        }),
      ),
    )
  }

  const onSubmit = async (values) => {
    setNotice(null)
    const files = config.image && file ? { [config.image]: file } : null

    try {
      if (editing === 'new') {
        await config.client.create(values, files)
      } else {
        await config.client.update(editing, values, files)
      }
      setEditing(null)
      refetch()
      setNotice(`${config.label} saved.`)
    } catch (err) {
      if (err.errors) {
        Object.entries(err.errors).forEach(([field, messages]) =>
          setError(field, { type: 'server', message: messages[0] }),
        )
      }
      setNotice(err.message)
    }
  }

  const remove = async (item) => {
    // Deleting a taxonomy row can cascade to products, so confirm first.
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete this ${config.label.toLowerCase()}? This cannot be undone.`)) return
    try {
      await config.client.remove(item.id)
      refetch()
    } catch (err) {
      setNotice(err.message)
    }
  }

  const toggle = async (item) => {
    await config.client.toggle(item.id)
    refetch()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 24 }}>{config.label}s</h1>
        <button type="button" className="btn btn-primary" onClick={startCreate}>
          Add {config.label.toLowerCase()}
        </button>
      </div>

      {notice && (
        <div className="alert alert-info" role="status">
          {notice}
        </div>
      )}

      <input
        className="form-control"
        placeholder="Search…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(1)
        }}
        style={{ maxWidth: 320, margin: '16px 0' }}
        aria-label={`Search ${config.label.toLowerCase()}s`}
      />

      {editing && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          style={{ border: '1px solid #eee', padding: 20, marginBottom: 20 }}
        >
          <h2 style={{ fontSize: 18 }}>
            {editing === 'new' ? `New ${config.label.toLowerCase()}` : `Edit ${config.label.toLowerCase()}`}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {config.fields.map((field) => (
              <div key={field.name} className="form-group">
                <label htmlFor={`f-${field.name}`}>{field.label}</label>

                {field.type === CHECK && (
                  <input id={`f-${field.name}`} type="checkbox" {...register(field.name)} />
                )}

                {field.type === TEXTAREA && (
                  <textarea id={`f-${field.name}`} rows="4" className="form-control" {...register(field.name)} />
                )}

                {field.type === SELECT && (
                  <select id={`f-${field.name}`} className="form-control" {...register(field.name)}>
                    <option value="">— none —</option>
                    {(field.options ?? (selectSource?.[field.source] ?? []).map((o) => [o.id, o.title ?? o.name])).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                )}

                {![CHECK, TEXTAREA, SELECT].includes(field.type) && (
                  <input
                    id={`f-${field.name}`}
                    type={field.type}
                    className="form-control"
                    {...register(field.name, field.required ? { required: `${field.label} is required.` } : {})}
                  />
                )}

                {errors[field.name] && (
                  <p style={{ color: '#b00', fontSize: 13 }}>{errors[field.name].message}</p>
                )}
              </div>
            ))}

            {config.image && (
              <div className="form-group">
                <label htmlFor="f-image">Image</label>
                <input
                  id="f-image"
                  type="file"
                  accept="image/*"
                  className="form-control"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
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
            {config.columns.map(([key, label]) => (
              <th scope="col" key={key}>
                {label}
              </th>
            ))}
            <th scope="col">Active</th>
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {(data?.items ?? []).map((item) => (
            <tr key={item.id}>
              {config.columns.map(([key]) => (
                <td key={key}>{String(item[key] ?? '—')}</td>
              ))}
              <td>
                <button type="button" onClick={() => toggle(item)}>
                  {item.isActive ? 'Yes' : 'No'}
                </button>
              </td>
              <td>
                <button type="button" onClick={() => startEdit(item)}>
                  Edit
                </button>{' '}
                <button type="button" onClick={() => remove(item)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}

          {data?.items?.length === 0 && (
            <tr>
              <td colSpan={config.columns.length + 2} style={{ opacity: 0.6 }}>
                Nothing here yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Pagination pagination={data?.pagination} onPage={setPage} />
    </div>
  )
}
