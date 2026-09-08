import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import { Plus, Search, Pencil, Trash2, Check, X } from 'lucide-react'
import Loading from '../../components/common/Loading.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import Pagination from '../../components/common/Pagination.jsx'
import Alert from '../../components/ui/Alert.jsx'
import Button from '../../components/ui/Button.jsx'
import { Field, Input, Textarea, Select as SelectControl, Checkbox } from '../../components/ui/Field.jsx'
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
      <AdminPage title="Not found">
        <p className="text-body">No admin screen exists for “{resource}”.</p>
      </AdminPage>
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

  const singular = config.label.toLowerCase()

  /** One control per declared field, chosen by its `type`. */
  const renderField = (field) => {
    const id = `f-${field.name}`

    if (field.type === CHECK) {
      return (
        <div key={field.name} className="flex items-end pb-2">
          <Checkbox id={id} label={field.label} {...register(field.name)} />
        </div>
      )
    }

    return (
      <Field
        key={field.name}
        label={field.label}
        htmlFor={id}
        required={field.required}
        error={errors[field.name]?.message}
      >
        {field.type === TEXTAREA ? (
          <Textarea id={id} rows={4} error={errors[field.name]} {...register(field.name)} />
        ) : field.type === SELECT ? (
          <SelectControl id={id} error={errors[field.name]} {...register(field.name)}>
            <option value="">— none —</option>
            {(
              field.options ??
              (selectSource?.[field.source] ?? []).map((o) => [o.id, o.title ?? o.name])
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectControl>
        ) : (
          <Input
            id={id}
            type={field.type}
            error={errors[field.name]}
            {...register(
              field.name,
              field.required ? { required: `${field.label} is required.` } : {},
            )}
          />
        )}
      </Field>
    )
  }

  return (
    <AdminPage
      title={`${config.label}s`}
      actions={
        <Button type="button" size="sm" onClick={startCreate}>
          <Plus size={15} strokeWidth={1.5} aria-hidden="true" />
          Add {singular}
        </Button>
      }
    >
      {notice && (
        <Alert tone="info" className="mb-5">
          {notice}
        </Alert>
      )}

      <div className="relative mb-6 w-full max-w-xs">
        <Search
          size={16}
          strokeWidth={1.5}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body"
        />
        <label htmlFor="resource-search" className="sr-only">
          Search {singular}s
        </label>
        <input
          id="resource-search"
          type="search"
          placeholder="Search…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className={`${CONTROL} w-full pl-9`}
        />
      </div>

      {editing && (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mb-8 border border-line p-5">
          <h2 className="text-[17px] font-semibold text-ink">
            {editing === 'new' ? `New ${singular}` : `Edit ${singular}`}
          </h2>

          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {config.fields.map(renderField)}

            {config.image && (
              <Field label="Image" htmlFor="f-image">
                <input
                  id="f-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full border border-line bg-white p-2 text-[13px] text-ink file:mr-3 file:border-0 file:bg-sand file:px-3 file:py-1.5 file:text-[13px] file:text-ink"
                />
              </Field>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm" loading={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
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
        caption={`${config.label}s`}
        head={
          <>
            {config.columns.map(([key, label]) => (
              <Th key={key}>{label}</Th>
            ))}
            <Th>Active</Th>
            <Th className="text-right">
              <span className="sr-only">Actions</span>
            </Th>
          </>
        }
      >
        {(data?.items ?? []).map((item) => (
          <tr key={item.id}>
            {config.columns.map(([key], index) => (
              <Td key={key} className={index === 0 ? 'font-medium' : undefined}>
                {String(item[key] ?? '—')}
              </Td>
            ))}

            <Td>
              <button
                type="button"
                onClick={() => toggle(item)}
                aria-label={`${item.isActive ? 'Deactivate' : 'Activate'} this ${singular}`}
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
              <div className="flex justify-end gap-2">
                <AdminButton onClick={() => startEdit(item)}>
                  <Pencil size={14} strokeWidth={1.5} aria-hidden="true" />
                  Edit
                </AdminButton>
                <AdminButton variant="danger" onClick={() => remove(item)}>
                  <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                  Delete
                </AdminButton>
              </div>
            </Td>
          </tr>
        ))}

        {data?.items?.length === 0 && (
          <EmptyRow colSpan={config.columns.length + 2}>Nothing here yet.</EmptyRow>
        )}
      </Table>

      <Pagination pagination={data?.pagination} onPage={setPage} />
    </AdminPage>
  )
}
