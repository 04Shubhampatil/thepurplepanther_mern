import { useEffect, useState } from 'react'
import { useApi } from '../../hooks/useApi.js'
import { Button } from '../../components/admin/AdminUI.jsx'
import { Toggle, FORM_CONTROL } from '../../components/admin/AdminControls.jsx'
import RichTextEditor from '../../components/admin/RichTextEditor.jsx'
import { usePageTitle } from '../../theme/page.js'
import { toast } from '../../store/toast.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/settings/pages.blade.php.
 *
 * A `.page-settings-card` — no padding, so the tab strip spans it — with one tab per CMS
 * page. The tab is the whole navigation: each opens the same form against a different row.
 *
 * The URL field is READ-ONLY and greyed: it is where the page already lives on the
 * storefront, not something the admin sets. Changing the slug would break every existing
 * link to it, which is why the Blade renders it disabled rather than as an input.
 *
 * `.page-settings-tab.active` marks the tab with a TOP border and a white ground, not the
 * bottom underline the Contact List and User Detail tabs use — three tab strips in this
 * panel, three different treatments.
 */
export default function PageSettings() {
  usePageTitle('Page Settings - Purple Panther')

  const [slug, setSlug] = useState(null)
  const [form, setForm] = useState({ title: '', content: '', is_active: true })
  const [saving, setSaving] = useState(false)

  const { data, refetch } = useApi(() => api.admin.settings.pages(), [])
  const pages = data?.pages ?? []

  const active = pages.find((page) => page.slug === slug) ?? pages[0] ?? null

  useEffect(() => {
    if (!active) return
    if (slug === null) setSlug(active.slug)

    setForm({
      title: active.title ?? '',
      content: active.content ?? '',
      // A page that has never been saved has no row yet; Laravel seeded it as active.
      is_active: active.isActive === undefined ? true : Boolean(active.isActive),
    })
  }, [active?.slug, data])

  async function onSubmit(event) {
    event.preventDefault()

    if (!form.title.trim()) {
      toast.error('Please enter a page title.')
      return
    }

    setSaving(true)
    try {
      const res = await api.admin.settings.updatePage(active.slug, {
        title: form.title.trim(),
        content: form.content,
        is_active: form.is_active,
      })
      toast.success(res.$message)
      refetch()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  /** `.offer-form-row` */
  const Row = ({ label, required, top = false, children }) => (
    <div
      className={`grid grid-cols-1 gap-2 border-b border-[#f0f0f0] py-3.5 min-[768px]:grid-cols-[220px_1fr] min-[768px]:gap-4 ${
        top ? 'items-start' : 'min-[768px]:items-center'
      }`}
    >
      <label className="text-[14px] font-semibold text-[#555]">
        {label}
        {required ? <span className="ml-0.5 text-[#e53935]">*</span> : null}{' '}
        <span className="text-[#888]">:-</span>
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  )

  return (
    <div className="overflow-hidden rounded-[10px] bg-white shadow-admin-card">
      {/* `.page-settings-head` */}
      <div className="px-5 pb-2 pt-[18px]">
        <h2 className="text-[20px] font-semibold text-[#444]">Page Settings</h2>
        <p className="mt-1 text-[13px] text-[#888]">Web Settings</p>
      </div>

      {/* `.page-settings-tabs` — a #fafafa strip; the active tab turns white with a TOP border */}
      <div className="flex flex-wrap border-b border-[#eee] bg-[#fafafa] px-3 max-[767px]:flex-nowrap max-[767px]:overflow-x-auto">
        {pages.map((page) => {
          const isActive = page.slug === active?.slug
          return (
            <button
              key={page.slug}
              type="button"
              onClick={() => setSlug(page.slug)}
              className={`-mb-px whitespace-nowrap border-b-2 border-t-2 px-4 py-3 text-[13px] font-semibold transition-colors ${
                isActive
                  ? 'border-b-transparent border-t-admin-primary bg-white text-admin-primary'
                  : 'border-transparent text-[#666] hover:text-admin-primary'
              }`}
            >
              {page.title}
            </button>
          )
        })}
      </div>

      {active ? (
        /* `.page-settings-form` — 8px above, 22px around */
        <form onSubmit={onSubmit} className="px-[22px] pb-[22px] pt-2">
          <Row label={`${active.title} URL`}>
            {/*
              `.readonly-input` — #f5f5f5 with a default cursor, not an editable field. The
              value is `getPublicUrlAttribute`, `url('/page/'.$slug)`: an accessor, so it is
              built here rather than read off the raw row.
            */}
            <input
              type="text"
              value={`${window.location.origin}/page/${active.slug}`}
              readOnly
              className={`${FORM_CONTROL} cursor-default !bg-[#f5f5f5] text-[#666]`}
            />
          </Row>

          <Row label="Page Title" required>
            <input
              type="text"
              maxLength={255}
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              className={FORM_CONTROL}
            />
          </Row>

          <Row label="Content" required top>
            <RichTextEditor
              id="page-content"
              rows={14}
              value={form.content}
              onChange={(html) => setForm((prev) => ({ ...prev, content: html }))}
            />
          </Row>

          <Row label="Page Status">
            <Toggle
              checked={form.is_active}
              onChange={() => setForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
              title="Page status"
            />
          </Row>

          {/* `.offer-form-actions` */}
          <div className="pt-[18px]">
            <Button type="submit" loading={saving} disabled={saving}>Save</Button>
          </div>
        </form>
      ) : (
        <div className="p-6 text-center text-admin-muted">Loading…</div>
      )}
    </div>
  )
}
