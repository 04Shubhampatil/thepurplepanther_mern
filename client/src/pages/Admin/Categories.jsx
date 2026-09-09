import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2, Home, Search } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import { ConfirmDialog, Pagination } from '../../components/admin/AdminUI.jsx'
import { AdminSearch, AddNewButton, Toggle } from '../../components/admin/AdminControls.jsx'
import { usePageTitle } from '../../theme/page.js'
import { storageUrl } from '../../utils/admin-media.js'
import { toast } from '../../store/toast.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/categories/index.blade.php + categories/_items.blade.php.
 *
 * Categories are image cards, not a table. From admin.css:
 *
 *   .category-grid   auto-fill minmax(220px, 1fr), 16px gap; 2 cols then 1 on mobile
 *   .category-card   radius 12px, min-height 160px, cover image, 0 6px 16px rgba(0,0,0,.12)
 *   ::before         linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.65))
 *   .inner           14px padding, column, space-between
 *   h3               18px, pushed to the bottom with margin-top:auto
 *   .icon-btn        34px circle, white ground, --primary glyph
 *   .switch/.slider  42×22 track, 16px knob, --primary when checked
 *
 * The overlay is a ::before in CSS; here it is a sibling div, which is the same paint order
 * and avoids needing a pseudo-element from a utility class.
 *
 * The house glyph in the corner is `show_on_home` — the Blade prints 🏠 only when the flag
 * is set, which is why it appears on Accessories and not Collection.
 *
 * DATA AND API ARE UNCHANGED. This uses the same `api.admin.categories` client the generic
 * resource screen used: list, remove, toggle. Only the presentation is new.
 */
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=80'

/** Blade: `asset('storage/'.$category->image)`. Category stores the path in `image`. */
const imageUrl = (image) => storageUrl(image, FALLBACK_IMAGE)

export default function Categories() {
  usePageTitle('Categories - Purple Panther')

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [confirmId, setConfirmId] = useState(null)
  const [busy, setBusy] = useState(false)

  const { data, loading, refetch } = useApi(
    () => api.admin.categories.list({ search, page }),
    [search, page],
  )

  const items = data?.items ?? []
  const pagination = data?.pagination ?? { page: 1, lastPage: 1, total: 0, perPage: 25 }

  async function onToggle(id) {
    try {
      toast.success((await api.admin.categories.toggle(id)).$message)
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function onDelete() {
    setBusy(true)
    try {
      toast.success((await api.admin.categories.remove(confirmId)).$message)
      setConfirmId(null)
      refetch()
    } catch (err) {
      toast.error(err.message)
      setConfirmId(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* .page-head + .page-head-actions */}
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[26px] font-bold text-[#333]">Categories</h2>
        <div className="flex flex-wrap items-center gap-2.5 max-sm:w-full">
          <AdminSearch
            value={search}
            onChange={(value) => {
              setSearch(value)
              setPage(1)
            }}
          />
          <AddNewButton to="/admin/categories/create">Add New</AddNewButton>
        </div>
      </div>
      {loading ? (
        <div className="rounded-[10px] bg-white p-6 text-center text-admin-muted">Loading…</div>
      ) : items.length === 0 ? (
        /* .empty-state — 24px, centred, #888 on white */
        <div className="rounded-[10px] bg-white p-6 text-center text-[#888]">
          No categories found. <Link to="/admin/categories/create" className="text-admin-primary">Add New</Link>
        </div>
      ) : (
        /* .category-grid — auto-fill minmax(220px,1fr) at 16px from 992px; 2 columns at 10px
           from 576px; one column below that. Written as arbitrary breakpoints because the
           original's media queries are 991px/575px, not Tailwind's 1024/640. */
        <div className="grid grid-cols-1 gap-2.5 min-[576px]:grid-cols-2 min-[992px]:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] min-[992px]:gap-4">
          {items.map((category) => (
            <article
              key={category.id}
              className="relative min-h-[160px] overflow-hidden rounded-xl bg-[#333] bg-cover bg-center bg-no-repeat text-white shadow-[0_6px_16px_rgba(0,0,0,0.12)]"
              style={{ backgroundImage: `url('${imageUrl(category.image)}')` }}
            >
              {/* .category-card::before */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/15 to-black/65" aria-hidden="true" />

              {/* .category-card .inner */}
              <div className="relative z-[1] flex min-h-[160px] flex-col justify-between p-3.5">
                <div className="flex justify-end gap-2">
                  {category.showOnHome ? <Home size={18} title="Show on home" /> : null}
                </div>

                <div>
                  <h3 className="mt-auto break-words text-[18px] font-bold">{category.title}</h3>

                  {/* .category-actions — 8px gap */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <Link
                      to={`/admin/categories/${category.id}/edit`}
                      title="Edit"
                      className="inline-flex size-[34px] items-center justify-center rounded-full bg-white text-admin-primary transition-colors hover:bg-white/90"
                    >
                      <Pencil size={16} />
                    </Link>

                    <button
                      type="button"
                      title="Delete"
                      onClick={() => setConfirmId(category.id)}
                      className="inline-flex size-[34px] items-center justify-center rounded-full bg-white text-admin-primary transition-colors hover:bg-white/90"
                    >
                      <Trash2 size={16} />
                    </button>

                    <Toggle
                      checked={Boolean(category.isActive)}
                      onChange={() => onToggle(category.id)}
                      title="Active status"
                    />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-[18px] flex flex-wrap justify-end gap-2">
        <Pagination
          page={pagination.page}
          lastPage={pagination.lastPage}
          total={pagination.total}
          perPage={pagination.perPage}
          onChange={setPage}
        />
      </div>

      <ConfirmDialog
        open={confirmId !== null}
        onCancel={() => setConfirmId(null)}
        onProceed={onDelete}
        busy={busy}
      />
    </>
  )
}
