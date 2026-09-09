import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import { ConfirmDialog, Alert, Pagination } from '../../components/admin/AdminUI.jsx'
import { AdminSearch, AddNewButton, Toggle } from '../../components/admin/AdminControls.jsx'
import { usePageTitle } from '../../theme/page.js'
import { storageUrl } from '../../utils/admin-media.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/offers/index.blade.php + offers/_items.blade.php.
 *
 * Offers reuse `.category-grid` and `.category-card` — the same image cards as Categories —
 * with `.offer-card` adding the discount line under the title. Sharing the grid is the
 * original's decision, so the geometry here is deliberately identical to the Categories page
 * rather than a second, slightly different card.
 *
 * The empty state carries an "Add New" link inside the sentence, which is what the current
 * screenshot shows.
 */
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80'

const imageUrl = (image) => storageUrl(image, FALLBACK_IMAGE)

export default function Offers() {
  usePageTitle('Offers - Purple Panther')

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [confirmId, setConfirmId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const { data, loading, refetch } = useApi(() => api.admin.offers.list({ search, page }), [search, page])

  const items = data?.items ?? []
  const pagination = data?.pagination ?? { page: 1, lastPage: 1, total: 0, perPage: 25 }

  async function onToggle(id) {
    setError('')
    try {
      await api.admin.offers.toggle(id)
      refetch()
    } catch (err) {
      setError(err.message)
    }
  }

  async function onDelete() {
    setBusy(true)
    try {
      await api.admin.offers.remove(confirmId)
      setConfirmId(null)
      refetch()
    } catch (err) {
      setError(err.message)
      setConfirmId(null)
    } finally {
      setBusy(false)
    }
  }

  const iconButton =
    'inline-flex size-[34px] items-center justify-center rounded-full bg-white text-admin-primary transition-colors hover:bg-white/90'

  return (
    <>
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[26px] font-bold text-[#333]">Offers</h2>
        <div className="flex flex-wrap items-center gap-2.5 max-sm:w-full">
          <AdminSearch value={search} onChange={(v) => { setSearch(v); setPage(1) }} />
          <AddNewButton to="/admin/offers/create">Add New</AddNewButton>
        </div>
      </div>

      <Alert onDismiss={() => setError('')}>{error}</Alert>

      {loading ? (
        <div className="rounded-[10px] bg-white p-6 text-center text-admin-muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-[10px] bg-white p-6 text-center text-[#888]">
          No offers found. <Link to="/admin/offers/create" className="text-admin-primary underline">Add New</Link>
        </div>
      ) : (
        /* .category-grid — shared with Categories, same breakpoints */
        <div className="grid grid-cols-1 gap-2.5 min-[576px]:grid-cols-2 min-[992px]:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] min-[992px]:gap-4">
          {items.map((offer) => (
            <article
              key={offer.id}
              className="relative min-h-[160px] overflow-hidden rounded-xl bg-[#333] bg-cover bg-center bg-no-repeat text-white shadow-[0_6px_16px_rgba(0,0,0,0.12)]"
              style={{ backgroundImage: `url('${imageUrl(offer.image)}')` }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-black/15 to-black/65" aria-hidden="true" />

              <div className="relative z-[1] flex min-h-[160px] flex-col justify-between p-3.5">
                <div />
                <div>
                  <div className="mb-2.5">
                    <h3 className="break-words text-[18px] font-bold">{offer.title}</h3>
                    <p className="text-[14px] opacity-95">{offer.discountPercent}% OFF</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/admin/offers/${offer.id}/edit`} title="Edit" className={iconButton}>
                      <Pencil size={16} />
                    </Link>
                    <button type="button" title="Delete" onClick={() => setConfirmId(offer.id)} className={iconButton}>
                      <Trash2 size={16} />
                    </button>
                    <Toggle
                      checked={Boolean(offer.isActive)}
                      onChange={() => onToggle(offer.id)}
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

      <ConfirmDialog open={confirmId !== null} onCancel={() => setConfirmId(null)} onProceed={onDelete} busy={busy} />
    </>
  )
}
