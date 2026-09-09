import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2, Search } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import { ConfirmDialog, Alert } from '../../components/admin/AdminUI.jsx'
import { Toggle } from '../../components/admin/AdminControls.jsx'
import { storageUrl, isVideoPath } from '../../utils/admin-media.js'
import { usePageTitle } from '../../theme/page.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/banners/index.blade.php + banners/_items.blade.php.
 *
 * Three stacked pieces: the `.product-panel` (shared with Products, so the search is the
 * 40px pill again, not `.search-box`), a "Home & Page Sections" legend of chips, then the
 * banner cards.
 *
 * The chips are BOTH a legend and the section filter — clicking one sets `?section=`, and
 * the active chip turns `--primary` on #fce4ec. They and the dropdown are two routes to the
 * same state, which is why selecting in one updates the other.
 *
 * A banner whose first media item is a VIDEO renders a muted autoplaying `<video>` instead
 * of a background image. Falling back to the cover image would show a black frame for those
 * sections, which is what the Blade avoids with the same branch.
 */
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80'

export default function Banners() {
  usePageTitle('Banners - Purple Panther')

  const [search, setSearch] = useState('')
  const [section, setSection] = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const { data, loading, refetch } = useApi(
    () => api.admin.banners.list({ section: section || undefined }),
    [section],
  )

  const sections = data?.sections ?? []
  const all = data?.banners ?? []

  // The endpoint filters by section; the free-text box narrows the result client-side, as
  // the Blade's `search` did over the same page of rows.
  const term = search.trim().toLowerCase()
  const banners = term
    ? all.filter((banner) => String(banner.title ?? '').toLowerCase().includes(term))
    : all

  const meta = (key) => sections.find((entry) => entry.key === key)

  async function onToggle(id) {
    setError('')
    try {
      await api.admin.banners.toggle(id)
      refetch()
    } catch (err) {
      setError(err.message)
    }
  }

  async function onDelete() {
    setBusy(true)
    try {
      await api.admin.banners.remove(confirmId)
      setConfirmId(null)
      refetch()
    } catch (err) {
      setError(err.message)
      setConfirmId(null)
    } finally {
      setBusy(false)
    }
  }

  const panelButton =
    'inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md bg-admin-primary px-[18px] text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-dark'

  const iconButton =
    'inline-flex size-[34px] items-center justify-center rounded-full bg-white text-admin-primary transition-colors hover:bg-white/90'

  /* .banner-page-tag / .banner-count-tag — 10px/700 on rgba(0,0,0,.45), fully rounded */
  const tag = 'rounded-full bg-black/45 px-2 py-[3px] text-[10px] font-bold text-white'

  return (
    <>
      {/* .product-panel — shared with Products */}
      <div className="mb-[18px] rounded-[10px] bg-white px-5 py-[18px] shadow-[0_1px_4px_rgba(0,0,0,0.04)] max-sm:p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 max-sm:flex-col max-sm:items-stretch">
          <h2 className="text-[22px] font-semibold text-[#444]">Banners</h2>

          <div className="flex flex-wrap items-center gap-3 max-sm:w-full">
            <div className="flex h-10 min-w-[220px] items-center rounded-full border border-[#e0e0e0] bg-white pl-4 pr-1 max-sm:w-full">
              <input
                type="text"
                placeholder="Search here..."
                autoComplete="off"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-w-0 flex-1 border-none bg-transparent text-[14px] text-[#555] outline-none placeholder:text-[#bdbdbd]"
              />
              <button type="button" aria-label="Search" className="inline-flex size-9 items-center justify-center rounded-full text-[#bdbdbd]">
                <Search size={16} />
              </button>
            </div>

            <Link to="/admin/banners/create" className={panelButton}>Add New</Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-1">
          <select
            value={section}
            onChange={(event) => setSection(event.target.value)}
            className="h-10 min-w-[280px] rounded-md border border-[#e0e0e0] bg-white px-3 text-[14px] text-[#555] outline-none max-sm:w-full max-sm:min-w-0"
          >
            <option value="">---All Sections---</option>
            {sections.map((entry) => (
              <option key={entry.key} value={entry.key}>{entry.label} ({entry.page})</option>
            ))}
          </select>
        </div>
      </div>

      <Alert onDismiss={() => setError('')}>{error}</Alert>

      {/* .section-legend — the chips double as the section filter */}
      <div className="mb-4 rounded-[10px] bg-white p-[18px] shadow-admin-card">
        <h3 className="mb-2.5 text-[18px] font-bold text-[#333]">Home &amp; Page Sections</h3>
        <div className="flex flex-wrap gap-2">
          {sections.map((entry) => {
            const active = section === entry.key
            return (
              <button
                key={entry.key}
                type="button"
                title={entry.hint}
                onClick={() => setSection(active ? '' : entry.key)}
                className={`inline-flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                  active
                    ? 'border-admin-primary bg-[#fce4ec] text-[#333]'
                    : 'border-admin-line bg-[#fafafa] text-[#555] hover:border-admin-primary hover:bg-[#fce4ec] hover:text-[#333]'
                }`}
              >
                <strong className="text-[12px] font-bold">{entry.label}</strong>
                <small className="text-[11px] text-[#999]">{entry.page}</small>
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="rounded-[10px] bg-white p-6 text-center text-admin-muted">Loading…</div>
      ) : banners.length === 0 ? (
        <div className="rounded-[10px] bg-white p-6 text-center text-[#888]">
          No banners found. <Link to="/admin/banners/create" className="text-admin-primary">Add New</Link>
        </div>
      ) : (
        /* .category-grid — banners share it with Categories and Offers */
        <div className="grid grid-cols-1 gap-2.5 min-[576px]:grid-cols-2 min-[992px]:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] min-[992px]:gap-4">
          {banners.map((banner) => {
            // `cover_image`, `section_label`, `section_page` and `is_video` are all Laravel
            // ACCESSORS — none of them exist on the raw rows the admin API returns. The cover
            // is the first image's path, the labels come from the sections list, and video is
            // decided by file extension.
            const first = banner.images?.[0]
            const count = banner.images?.length ?? 0
            const info = meta(banner.section)
            const firstIsVideo = isVideoPath(first?.image)

            return (
              <article
                key={banner.id}
                className="relative min-h-[160px] overflow-hidden rounded-xl bg-[#333] bg-cover bg-center bg-no-repeat text-white shadow-[0_6px_16px_rgba(0,0,0,0.12)]"
                style={
                  firstIsVideo
                    ? undefined
                    : { backgroundImage: `url('${storageUrl(first?.image, FALLBACK_IMAGE)}')` }
                }
              >
                {firstIsVideo ? (
                  <video
                    src={storageUrl(first.image)}
                    muted
                    loop
                    autoPlay
                    playsInline
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : null}

                <div className="absolute inset-0 bg-gradient-to-b from-black/15 to-black/65" aria-hidden="true" />

                <div className="relative z-[1] flex min-h-[160px] flex-col justify-between p-3.5">
                  {/* .banner-card-meta — page tag left, media count right */}
                  <div className="flex justify-between gap-2">
                    <span className={tag}>{info?.page ?? '—'}</span>
                    <span className={tag}>{count} media item{count === 1 ? '' : 's'}</span>
                  </div>

                  <div>
                    {/* .banner-section-name — 11px/600, uppercase, .03em */}
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.03em] opacity-90">
                      {info?.label ?? banner.section}
                    </p>
                    <h3 className="break-words text-[18px] font-bold">{banner.title}</h3>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <Link to={`/admin/banners/${banner.id}/edit`} title="Edit" className={iconButton}>
                        <Pencil size={16} />
                      </Link>
                      <button type="button" title="Delete" onClick={() => setConfirmId(banner.id)} className={iconButton}>
                        <Trash2 size={16} />
                      </button>
                      <Toggle
                        checked={Boolean(banner.isActive)}
                        onChange={() => onToggle(banner.id)}
                        title="Active status"
                      />
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <ConfirmDialog open={confirmId !== null} onCancel={() => setConfirmId(null)} onProceed={onDelete} busy={busy} />
    </>
  )
}
