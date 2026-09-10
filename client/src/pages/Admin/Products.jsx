import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Pencil, Trash2, Eye, Star } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import { toast } from '../../store/toast.js'
import * as api from '../../services/endpoints.js'
import Loading from '../../components/common/Loading.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import Pagination from '../../components/common/Pagination.jsx'
import { ConfirmDialog } from '../../components/admin/AdminUI.jsx'
import { Toggle } from '../../components/admin/AdminControls.jsx'
import { storageUrl, discountPercent } from '../../utils/admin-media.js'

/** Blade's placeholder when a product has no featured image. */
const PRODUCT_FALLBACK = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80'

/**
 * admin/products/index.blade.php — the LIST only.
 *
 * Add New and Edit navigate to ProductForm, View to ProductDetail; this page used to carry
 * its own inline editor, which is why the full form was unreachable from the UI even once it
 * existed. The Blade has the same split: index.blade.php links to create/edit/show rather
 * than editing in place.
 */
export default function Products() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
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

  if (loading && !data) return <Loading full />
  if (error) return <ErrorMessage error={error} onRetry={refetch} />

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

            <Link to="/admin/products/create" className={panelButton}>Add New</Link>
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
              {/* `_items.blade.php` sends the eye to `products.show`, NOT to the edit form —
                  they are different screens and this one was pointing at the wrong route. */}
              <Link to={`/admin/products/${item.id}`} title="View" className={cardIcon(false)}>
                <Eye size={15} />
              </Link>

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

              <Link to={`/admin/products/${item.id}/edit`} title="Edit" className={cardIcon(false)}>
                <Pencil size={15} />
              </Link>

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
