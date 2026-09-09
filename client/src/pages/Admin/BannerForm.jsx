import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import { Card, Button, Alert } from '../../components/admin/AdminUI.jsx'
import { Toggle, FORM_CONTROL } from '../../components/admin/AdminControls.jsx'
import { storageUrl, isVideoPath } from '../../utils/admin-media.js'
import { usePageTitle } from '../../theme/page.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/banners/create.blade.php + edit.blade.php + banners/_form.blade.php,
 * plus the behaviour that lived in public/js/banner-form.js.
 *
 * Two `.product-form-card` panels capped at 980px: the banner's own fields, then its media.
 * The layouts are three different grids and they are not interchangeable —
 *
 *   `.offer-form-row`      220px + 1fr, label on the left, one row per field
 *   `.product-pricing-row` three equal columns, so a two-field row leaves the third empty
 *   `.banner-existing-fields` auto-fit minmax(140px, 1fr), one row per existing slide
 *
 * — which is why Title reads as a labelled row while Button Text sits under its label.
 *
 * A banner holds MANY slides, and the two metadata shapes differ by necessity: slides that
 * already exist are addressed by id (`existing_titles[id]`), while slides being uploaded are
 * addressed by position (`image_titles[i]`), because they have no id yet. The server keeps
 * the same split.
 */
const HINT_FALLBACK = 'Choose where this banner appears on the website.'

const ACCEPT =
  '.png,.jpg,.jpeg,.mp4,.webm,.ogg,.mov,image/png,image/jpeg,video/mp4,video/webm,video/ogg,video/quicktime'

/** `.form-group label` — 13px/600 #666, 6px gap, 16px floor so unlabelled fields still line up. */
function FieldLabel({ children, suffix = true }) {
  return (
    <label className="mb-1.5 block min-h-4 text-[13px] font-semibold leading-[1.2] text-[#666]">
      {children} {suffix ? <span className="text-[#888]">:-</span> : null}
    </label>
  )
}

/** `.offer-form-row` — 220px label column beside the field, divided by a 1px #f0f0f0 rule. */
function Row({ label, top = false, children }) {
  return (
    <div
      className={`grid grid-cols-1 gap-2 border-b border-[#f0f0f0] py-3.5 min-[768px]:grid-cols-[220px_1fr] min-[768px]:gap-4 ${
        top ? 'items-start' : 'min-[768px]:items-center'
      }`}
    >
      <label className="text-[14px] font-semibold text-[#555]">
        {label} <span className="text-[#888]">:-</span>
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** `.hint` — 12px #888. The banner form recolours several of them to #e53935 inline. */
function Hint({ children, className = '' }) {
  return <p className={`mt-1 text-[12px] leading-[1.3] text-[#888] ${className}`}>{children}</p>
}

const TEXTAREA_CONTROL =
  'min-h-[140px] w-full resize-y rounded-md border border-[#ddd] bg-white px-3 py-[11px] text-[14px] outline-none transition-colors focus:border-admin-primary'

const emptyForm = {
  title: '',
  section: '',
  subtitle: '',
  description: '',
  button_text: '',
  button_link: '',
  button_text_2: '',
  button_link_2: '',
  sort_order: 0,
  is_active: true,
}

export default function BannerForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  usePageTitle(`${isEdit ? 'Edit' : 'Add'} Banner - Purple Panther`)

  const [form, setForm] = useState(emptyForm)
  const [slides, setSlides] = useState([])
  const [removeIds, setRemoveIds] = useState([])
  const [files, setFiles] = useState([])
  const [newMeta, setNewMeta] = useState([])
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  // The section list travels with the index payload, which is also what fills the dropdown
  // and the hint line under it.
  const { data: listData } = useApi(() => api.admin.banners.list(), [])
  const { data: bannerData } = useApi(
    () => (isEdit ? api.admin.banners.show(id) : Promise.resolve(null)),
    [id],
  )

  const sections = listData?.sections ?? []

  useEffect(() => {
    const banner = bannerData?.item
    if (!banner) return

    setForm({
      title: banner.title ?? '',
      section: banner.section ?? '',
      subtitle: banner.subtitle ?? '',
      description: banner.description ?? '',
      button_text: banner.buttonText ?? '',
      button_link: banner.buttonLink ?? '',
      button_text_2: banner.buttonText2 ?? '',
      button_link_2: banner.buttonLink2 ?? '',
      sort_order: banner.sortOrder ?? 0,
      is_active: Boolean(banner.isActive),
    })

    setSlides(
      (banner.images ?? []).map((image) => ({
        id: String(image.id),
        image: image.image,
        title: image.title ?? '',
        subtitle: image.subtitle ?? '',
        button_text: image.buttonText ?? '',
        button_link: image.buttonLink ?? '',
        sort_order: image.sortOrder ?? 0,
      })),
    )
  }, [bannerData])

  // Object URLs are revoked on replacement so repeatedly re-picking files does not leak.
  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  )

  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews])

  const set = (key) => (event) => {
    const value = event.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const setSlide = (slideId, key, value) =>
    setSlides((prev) =>
      prev.map((slide) => (slide.id === slideId ? { ...slide, [key]: value } : slide)),
    )

  const setMeta = (index, key, value) =>
    setNewMeta((prev) => {
      const next = [...prev]
      next[index] = { ...(next[index] ?? {}), [key]: value }
      return next
    })

  function onPick(event) {
    setFiles(Array.from(event.target.files ?? []))
    setNewMeta([])
  }

  function toggleRemove(slideId) {
    setRemoveIds((prev) =>
      prev.includes(slideId) ? prev.filter((v) => v !== slideId) : [...prev, slideId],
    )
  }

  const hint = sections.find((entry) => entry.key === form.section)?.hint ?? HINT_FALLBACK

  /** banner-form.js validated title and section client-side; the server validates both again. */
  function validate() {
    const next = {}
    const title = form.title.trim()

    if (!title) next.title = 'Banner title is required.'
    else if (title.length < 2) next.title = 'Title must be at least 2 characters.'

    if (!form.section) next.section = 'Please select a section / placement.'

    // A banner with no media renders nothing, so create demands at least one file and edit
    // demands that not every existing slide is being removed.
    const remaining = slides.filter((slide) => !removeIds.includes(slide.id)).length
    if (!remaining && !files.length) {
      next.images = 'Please upload at least one banner image or video.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function onSubmit(event) {
    event.preventDefault()
    setError('')
    if (!validate()) return

    setSaving(true)

    const kept = slides.filter((slide) => !removeIds.includes(slide.id))
    const byId = (key) =>
      Object.fromEntries(kept.map((slide) => [slide.id, slide[key]]))

    try {
      await api.admin.banners.save(
        id,
        {
          ...form,
          sort_order: Number(form.sort_order) || 0,
          remove_images: removeIds.map(Number),
          existing_titles: byId('title'),
          existing_subtitles: byId('subtitle'),
          existing_button_texts: byId('button_text'),
          existing_button_links: byId('button_link'),
          existing_sort: byId('sort_order'),
          image_titles: files.map((_, i) => newMeta[i]?.title ?? ''),
          image_subtitles: files.map((_, i) => newMeta[i]?.subtitle ?? ''),
          image_button_texts: files.map((_, i) => newMeta[i]?.button_text ?? ''),
          image_button_links: files.map((_, i) => newMeta[i]?.button_link ?? ''),
        },
        { images: files },
      )

      navigate('/admin/banners')
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <>
      {/* .page-head — back link stacked above the title */}
      <div className="mb-[18px]">
        <Link
          to="/admin/banners"
          className="mb-1.5 inline-block text-[14px] font-semibold text-admin-primary hover:underline"
        >
          ← Back
        </Link>
        <h2 className="text-[22px] font-bold text-[#333]">{isEdit ? 'Edit' : 'Add'} Banner</h2>
      </div>

      <Alert onDismiss={() => setError('')}>{error}</Alert>

      <form onSubmit={onSubmit} noValidate>
        {/* .product-form-card — 980px cap, 16px below */}
        <Card className="mb-4 max-w-[980px]">
          <h3 className="text-[18px] font-bold text-[#333]">Banner Details</h3>

          <Row label="Title">
            <input
              type="text"
              value={form.title}
              onChange={set('title')}
              placeholder="Enter banner title"
              className={`${FORM_CONTROL} ${errors.title ? 'border-[#e53935]' : ''}`}
            />
            {errors.title ? <p className="mt-1 text-[12px] text-[#e53935]">{errors.title}</p> : null}
          </Row>

          <Row label="Section / Placement">
            <select
              value={form.section}
              onChange={set('section')}
              className={`${FORM_CONTROL} ${errors.section ? 'border-[#e53935]' : ''}`}
            >
              <option value="">--Select Section--</option>
              {sections.map((entry) => (
                <option key={entry.key} value={entry.key}>{entry.label}</option>
              ))}
            </select>
            {/* #section-hint — recoloured to #e53935 inline in the Blade, 6px below */}
            <p className="mt-1.5 text-[12px] leading-[1.3] text-[#e53935]">
              {errors.section || hint}
            </p>
          </Row>

          <Row label="Subtitle">
            <input
              type="text"
              value={form.subtitle}
              onChange={set('subtitle')}
              placeholder="Optional subtitle / eyebrow"
              className={FORM_CONTROL}
            />
          </Row>

          {/* .offer-form-row-top — the textarea aligns to the top of its label */}
          <Row label="Description" top>
            <textarea
              rows={4}
              value={form.description}
              onChange={set('description')}
              placeholder="Optional description"
              className={TEXTAREA_CONTROL}
            />
          </Row>

          {/* .product-pricing-row — three columns; two fields leave the third empty */}
          <div className="mt-3.5 grid grid-cols-1 gap-3 min-[576px]:grid-cols-3">
            <div className="flex min-w-0 flex-col">
              <FieldLabel>Button Text</FieldLabel>
              <input
                type="text"
                value={form.button_text}
                onChange={set('button_text')}
                placeholder="e.g. Shop Now"
                className={FORM_CONTROL}
              />
            </div>
            <div className="flex min-w-0 flex-col">
              <FieldLabel>Button Link</FieldLabel>
              <input
                type="text"
                value={form.button_link}
                onChange={set('button_link')}
                placeholder="e.g. /shop or full URL"
                className={FORM_CONTROL}
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 min-[576px]:grid-cols-3">
            <div className="flex min-w-0 flex-col">
              <FieldLabel>Button Text 2</FieldLabel>
              <input
                type="text"
                value={form.button_text_2}
                onChange={set('button_text_2')}
                placeholder="e.g. Discover More"
                className={FORM_CONTROL}
              />
            </div>
            <div className="flex min-w-0 flex-col">
              <FieldLabel>Button Link 2</FieldLabel>
              <input
                type="text"
                value={form.button_link_2}
                onChange={set('button_link_2')}
                placeholder="Optional second CTA link"
                className={FORM_CONTROL}
              />
            </div>
            <div className="flex min-w-0 flex-col">
              <FieldLabel>Sort Order</FieldLabel>
              <input
                type="number"
                min="0"
                value={form.sort_order}
                onChange={set('sort_order')}
                className={FORM_CONTROL}
              />
            </div>
          </div>

          {/* .toggle-row */}
          <div className="mt-3 flex items-center justify-between gap-3 border-b border-[#f0f0f0] py-3">
            <span className="text-[14px]">Enable / Active</span>
            <Toggle
              checked={form.is_active}
              onChange={() => setForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
            />
          </div>
        </Card>

        <Card className="mb-4 max-w-[980px]">
          <h3 className="text-[18px] font-bold text-[#333]">Banner Media (Multiple)</h3>
          <Hint className="!text-[#e53935]">
            (Recommended: home hero 1920x800+, collection tiles 800x1000, fabric 1200x700)
          </Hint>
          <Hint className="mb-3.5 !text-[#e53935]">
            (Accept png, jpg, jpeg. Home — Main Hero also accepts mp4, webm, ogg and mov videos
            up to 50 MB.)
          </Hint>

          {slides.length ? (
            /* .banner-existing-list */
            <div className="mb-2 flex flex-col gap-3.5">
              {slides.map((slide) => {
                const removing = removeIds.includes(slide.id)
                const video = isVideoPath(slide.image)

                return (
                  /* .banner-existing-item — 140px preview beside its fields */
                  <div
                    key={slide.id}
                    className="grid grid-cols-1 gap-3.5 rounded-lg border border-[#eee] bg-[#fafafa] p-3 min-[768px]:grid-cols-[140px_1fr]"
                  >
                    <div>
                      {video ? (
                        <video
                          src={storageUrl(slide.image)}
                          controls
                          muted
                          preload="metadata"
                          className="max-h-[180px] w-full rounded-md object-cover"
                        />
                      ) : (
                        <img
                          src={storageUrl(slide.image)}
                          alt=""
                          className="h-[90px] w-full rounded-md object-cover"
                        />
                      )}
                      {/* .remove-check — 12px #e53935 under the thumbnail */}
                      <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-[12px] text-[#e53935]">
                        <input
                          type="checkbox"
                          checked={removing}
                          onChange={() => toggleRemove(slide.id)}
                          className="accent-admin-primary"
                        />
                        Remove
                      </label>
                    </div>

                    {/* .banner-existing-fields — auto-fit minmax(140px, 1fr) */}
                    <div className="grid grid-cols-1 gap-2.5 min-[576px]:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
                      <div className="flex min-w-0 flex-col">
                        <FieldLabel suffix={false}>Image Title</FieldLabel>
                        <input
                          type="text"
                          value={slide.title}
                          onChange={(e) => setSlide(slide.id, 'title', e.target.value)}
                          placeholder="Overlay title"
                          className={FORM_CONTROL}
                        />
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <FieldLabel suffix={false}>Subtitle / Description</FieldLabel>
                        <textarea
                          rows={5}
                          maxLength={5000}
                          value={slide.subtitle}
                          onChange={(e) => setSlide(slide.id, 'subtitle', e.target.value)}
                          placeholder="Long text OK (Fabric Library)"
                          className={TEXTAREA_CONTROL}
                        />
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <FieldLabel suffix={false}>Button Text</FieldLabel>
                        <input
                          type="text"
                          value={slide.button_text}
                          onChange={(e) => setSlide(slide.id, 'button_text', e.target.value)}
                          className={FORM_CONTROL}
                        />
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <FieldLabel suffix={false}>Button Link</FieldLabel>
                        <input
                          type="text"
                          value={slide.button_link}
                          onChange={(e) => setSlide(slide.id, 'button_link', e.target.value)}
                          className={FORM_CONTROL}
                        />
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <FieldLabel suffix={false}>Sort</FieldLabel>
                        <input
                          type="number"
                          min="0"
                          value={slide.sort_order}
                          onChange={(e) => setSlide(slide.id, 'sort_order', e.target.value)}
                          className={FORM_CONTROL}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}

          <div className="mt-3.5 flex min-w-0 flex-col">
            <FieldLabel>Add Images / Videos</FieldLabel>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              multiple
              onChange={onPick}
              className={`${FORM_CONTROL} !py-2 ${errors.images ? 'border-[#e53935]' : ''}`}
            />
            <Hint>
              You can select multiple files. Videos are supported only for Home — Main Hero.
            </Hint>
            {errors.images ? (
              <p className="mt-1 text-[12px] text-[#e53935]">{errors.images}</p>
            ) : null}

            {/* .gallery-existing / .gallery-thumb — 90px tiles */}
            {previews.length ? (
              <div className="mt-2.5 flex flex-wrap gap-2.5">
                {previews.map(({ file, url }) => (
                  <div
                    key={url}
                    className="w-[90px] overflow-hidden rounded-lg border border-[#eee] bg-[#fafafa] text-center"
                  >
                    {file.type.startsWith('video/') ? (
                      <video src={url} controls muted preload="metadata" className="h-[70px] w-full object-cover" />
                    ) : (
                      <img src={url} alt="" className="h-[70px] w-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* #banner-image-meta — one .banner-meta-row per file the admin just picked */}
          {previews.length ? (
            <div className="mt-3.5">
              {previews.map(({ url }, index) => (
                <div
                  key={url}
                  className="mb-2.5 grid grid-cols-1 gap-2.5 rounded-lg border border-dashed border-[#ddd] bg-white p-3 min-[576px]:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]"
                >
                  <div className="flex min-w-0 flex-col">
                    <FieldLabel suffix={false}>Image {index + 1} Title</FieldLabel>
                    <input
                      type="text"
                      maxLength={255}
                      value={newMeta[index]?.title ?? ''}
                      onChange={(e) => setMeta(index, 'title', e.target.value)}
                      placeholder="Overlay title"
                      className={FORM_CONTROL}
                    />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <FieldLabel suffix={false}>Subtitle / Description</FieldLabel>
                    <textarea
                      rows={5}
                      maxLength={5000}
                      value={newMeta[index]?.subtitle ?? ''}
                      onChange={(e) => setMeta(index, 'subtitle', e.target.value)}
                      placeholder="Long text OK (Fabric Library)"
                      className={TEXTAREA_CONTROL}
                    />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <FieldLabel suffix={false}>Button Text</FieldLabel>
                    <input
                      type="text"
                      maxLength={100}
                      value={newMeta[index]?.button_text ?? ''}
                      onChange={(e) => setMeta(index, 'button_text', e.target.value)}
                      placeholder="e.g. Shop Now"
                      className={FORM_CONTROL}
                    />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <FieldLabel suffix={false}>Button Link</FieldLabel>
                    <input
                      type="text"
                      maxLength={500}
                      value={newMeta[index]?.button_link ?? ''}
                      onChange={(e) => setMeta(index, 'button_link', e.target.value)}
                      placeholder="/shop"
                      className={FORM_CONTROL}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        {/* .offer-form-actions — 18px above the pair */}
        <div className="flex flex-wrap items-center gap-2 pt-[18px]">
          <Button type="submit" loading={saving} disabled={saving}>Save</Button>
          <Link
            to="/admin/banners"
            className="inline-flex items-center justify-center rounded-md border border-[#ddd] bg-white px-4 py-[10px] text-[13px] font-semibold text-[#555] transition-colors hover:bg-[#f7f7f7]"
          >
            Cancel
          </Link>
        </div>
      </form>
    </>
  )
}
