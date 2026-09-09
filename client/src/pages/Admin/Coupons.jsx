import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Pencil, Trash2, Search } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import { ConfirmDialog, Pagination } from '../../components/admin/AdminUI.jsx'
import { Toggle } from '../../components/admin/AdminControls.jsx'
import { discountLabel, couponImageUrl } from '../../utils/coupon.js'
import { usePageTitle } from '../../theme/page.js'
import { toast } from '../../store/toast.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/coupons/index.blade.php + coupons/_items.blade.php.
 *
 * The `.product-panel` head that Products and Banners share — 40px pill search with the
 * icon on the RIGHT, and Add New beside it — over `.coupon-grid`.
 *
 * `.coupon-card` is its own card, not the `.category-card` the other grids reuse: 280px
 * minimum instead of 220px, 18px gutters instead of 16, a 150px floor, and a gradient that
 * runs LEFT to RIGHT (`90deg, rgba(0,0,0,.55), rgba(0,0,0,.2)`) rather than top to bottom —
 * which is why the text stays legible against the left edge while the art shows through on
 * the right.
 *
 * Four controls per card, and the first is a View that the other grids do not have.
 */
export default function Coupons() {
  usePageTitle('Coupons - Purple Panther')

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [confirmId, setConfirmId] = useState(null)
  const [busy, setBusy] = useState(false)

  const { data, loading, refetch } = useApi(
    () => api.admin.coupons.list({ search, page }),
    [search, page],
  )

  const items = data?.items ?? []
  const pagination = data?.pagination ?? { page: 1, lastPage: 1, total: 0, perPage: 9 }

  async function onToggle(id) {
    try {
      toast.success((await api.admin.coupons.toggle(id)).$message)
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function onDelete() {
    setBusy(true)
    try {
      toast.success((await api.admin.coupons.remove(confirmId)).$message)
      setConfirmId(null)
      refetch()
    } catch (err) {
      toast.error(err.message)
      setConfirmId(null)
    } finally {
      setBusy(false)
    }
  }

  /* `.icon-btn` — 34px white circle with a `--primary` glyph */
  const iconButton =
    'inline-flex size-[34px] items-center justify-center rounded-full bg-white text-admin-primary transition-colors hover:bg-white/90'

  return (
    <>
      {/* `.product-panel` */}
      <div className="mb-[18px] rounded-[10px] bg-white px-5 py-[18px] shadow-[0_1px_4px_rgba(0,0,0,0.04)] max-sm:p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 max-sm:flex-col max-sm:items-stretch">
          <h2 className="text-[22px] font-semibold text-[#444]">Coupons</h2>

          <div className="flex flex-wrap items-center gap-3 max-sm:w-full">
            {/* `.product-search` — 40px pill, icon on the right */}
            <div className="flex h-10 min-w-[220px] items-center rounded-full border border-[#e0e0e0] bg-white pl-4 pr-1 max-sm:w-full">
              <input
                type="text"
                placeholder="Search here..."
                autoComplete="off"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1) }}
                className="min-w-0 flex-1 border-none bg-transparent text-[14px] text-[#555] outline-none placeholder:text-[#bdbdbd]"
              />
              <button type="button" aria-label="Search" className="inline-flex size-9 items-center justify-center rounded-full text-[#bdbdbd]">
                <Search size={16} />
              </button>
            </div>

            <Link
              to="/admin/coupons/create"
              className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md bg-admin-primary px-[18px] text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-dark"
            >
              Add New
            </Link>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[10px] bg-white p-6 text-center text-admin-muted">Loading…</div>
      ) : items.length === 0 ? (
        /* `.empty-state`, with Add New inside the sentence */
        <div className="rounded-[10px] bg-white p-6 text-center text-[#888]">
          No coupons found. <Link to="/admin/coupons/create" className="text-admin-primary underline">Add New</Link>
        </div>
      ) : (
        /* `.coupon-grid` — auto-fill minmax(280px, 1fr) at an 18px gap */
        <div className="mt-2 grid grid-cols-1 gap-[18px] min-[576px]:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
          {items.map((coupon) => (
            <article
              key={coupon.id}
              className="relative min-h-[150px] overflow-hidden rounded-[10px] bg-[#333] bg-cover bg-center bg-no-repeat text-white shadow-[0_6px_16px_rgba(0,0,0,0.12)]"
              style={{ backgroundImage: `url('${couponImageUrl(coupon)}')` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-black/55 to-black/20" aria-hidden="true" />

              <div className="relative z-[1] flex min-h-[150px] flex-col justify-between p-4">
                <div>
                  {/* `.coupon-card-label` — 20px/700 with a .2px track and a soft shadow */}
                  <div className="text-[20px] font-bold tracking-[0.2px] [text-shadow:0_1px_3px_rgba(0,0,0,0.35)]">
                    {discountLabel(coupon)}
                  </div>
                  {/* `.coupon-card-code` — 13px/600 at 90% opacity */}
                  <div className="mt-1.5 text-[13px] font-semibold opacity-90">{coupon.code}</div>

                  {/* A private coupon works only when the code is typed, so it is called out */}
                  {!coupon.isPublic ? (
                    <div className="mt-1.5 inline-block rounded-xl bg-admin-primary px-2 py-[3px] text-[11px] font-bold text-white">
                      PRIVATE
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/admin/coupons/${coupon.id}`} title="View" className={iconButton}>
                    <Eye size={16} />
                  </Link>
                  <Link to={`/admin/coupons/${coupon.id}/edit`} title="Edit" className={iconButton}>
                    <Pencil size={16} />
                  </Link>
                  <button type="button" title="Delete" onClick={() => setConfirmId(coupon.id)} className={iconButton}>
                    <Trash2 size={16} />
                  </button>
                  <Toggle
                    checked={Boolean(coupon.isActive)}
                    onChange={() => onToggle(coupon.id)}
                    title="Active status"
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Pagination
          page={pagination.page}
          lastPage={pagination.lastPage}
          total={pagination.total}
          perPage={pagination.perPage}
          onChange={setPage}
        />
      </div>

      <ConfirmDialog open={confirmId !== null} onCancel={() => setConfirmId(null)} onProceed={onDelete} busy={busy} />
    </>
  )
}
