import { useState } from 'react'
import { useApi } from '../../hooks/useApi.js'
import { Card, Table, Th, Td, Button, Alert, Pagination, ConfirmDialog } from '../../components/admin/AdminUI.jsx'
import { AdminSearch, Toggle } from '../../components/admin/AdminControls.jsx'
import { usePageTitle } from '../../theme/page.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/sub-categories/index.blade.php + sub-categories/_items.blade.php.
 *
 * Two stacked cards: an "Add Sub-Category" form laid out as one horizontal row (Category,
 * Title, Image, Save) and, below it, the listing table with # / Title / Category / Status /
 * Actions. The page head carries the search box but NO "Add New" button — creating happens
 * in the form on the page, which is why this module has no separate create screen.
 *
 * `.inline-form` is a flex row that wraps, with each `.form-group` flexing to fill; the Save
 * button sits on the same baseline as the inputs rather than under them. That is the layout
 * in the screenshot and the reason the fields are not a stacked column.
 *
 * The empty state — "No sub-categories found." — is a `.empty-state` block BELOW the table,
 * not a row inside it, so the header row stays visible. That is what the Blade does and what
 * the screenshot shows.
 *
 * FORM SUBMISSION AND API ARE UNCHANGED: `api.admin.subCategories.create(body, files)` and
 * `.remove` / `.toggle`, the same client the generic resource screen used.
 */
export default function SubCategories() {
  usePageTitle('Sub-Categories - Purple Panther')

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [categoryId, setCategoryId] = useState('')
  const [title, setTitle] = useState('')
  const [image, setImage] = useState(null)
  const [imageKey, setImageKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const [busy, setBusy] = useState(false)

  const { data, loading, refetch } = useApi(
    () => api.admin.subCategories.list({ search, page }),
    [search, page],
  )

  // The Category select is populated from the categories endpoint, as the controller's
  // `compact('categories')` did.
  const { data: categoryData } = useApi(() => api.admin.categories.list({ per_page: 100 }), [])

  const items = data?.items ?? []
  const pagination = data?.pagination ?? { page: 1, lastPage: 1, total: 0, perPage: 25 }
  const categories = categoryData?.items ?? []

  async function onSave(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      await api.admin.subCategories.create(
        { category_id: categoryId, title },
        image ? { image } : null,
      )
      setCategoryId('')
      setTitle('')
      setImage(null)
      setImageKey((key) => key + 1)
      refetch()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onToggle(id) {
    setError('')
    try {
      await api.admin.subCategories.toggle(id)
      refetch()
    } catch (err) {
      setError(err.message)
    }
  }

  async function onDelete() {
    setBusy(true)
    setError('')
    try {
      await api.admin.subCategories.remove(confirmId)
      setConfirmId(null)
      refetch()
    } catch (err) {
      setError(err.message)
      setConfirmId(null)
    } finally {
      setBusy(false)
    }
  }

  const label = 'mb-1.5 block text-[14px] text-[#444]'
  const control =
    'h-[46px] w-full rounded-md border border-[#ddd] bg-white px-3 text-[14px] outline-none transition-colors focus:border-admin-primary'

  return (
    <>
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[26px] font-bold text-[#333]">Sub-Categories</h2>
        <div className="flex flex-wrap items-center gap-2.5 max-sm:w-full">
          <AdminSearch
            value={search}
            onChange={(value) => {
              setSearch(value)
              setPage(1)
            }}
          />
        </div>
      </div>

      <Alert onDismiss={() => setError('')}>{error}</Alert>

      <Card className="mb-[18px]">
        <h3 className="mb-3 text-[18px] font-bold text-[#333]">Add Sub-Category</h3>

        {/* .inline-form — one wrapping flex row, Save on the field baseline */}
        <form onSubmit={onSave} noValidate className="flex flex-wrap items-end gap-4">
          <div className="min-w-[220px] flex-1">
            <label className={label} htmlFor="sub-category">Category</label>
            <select
              id="sub-category"
              name="category_id"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className={control}
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.title}</option>
              ))}
            </select>
          </div>

          <div className="min-w-[220px] flex-1">
            <label className={label} htmlFor="sub-title">Title</label>
            <input
              id="sub-title"
              type="text"
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={control}
            />
          </div>

          <div className="min-w-[220px] flex-1">
            <label className={label} htmlFor="sub-image">Image</label>
            <input
              id="sub-image"
              key={imageKey}
              type="file"
              name="image"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              onChange={(event) => setImage(event.target.files?.[0] ?? null)}
              className={`${control} py-2 file:mr-3 file:rounded file:border file:border-[#ccc] file:bg-[#efefef] file:px-2 file:py-1 file:text-[13px]`}
            />
          </div>

          <div>
            <Button type="submit" loading={saving} disabled={saving} className="h-[46px] px-7">Save</Button>
          </div>
        </form>
      </Card>

      <Card className="p-0">
        <Table>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Title</Th>
              <Th>Category</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <Td>{String(item.id)}</Td>
                <Td>{item.title}</Td>
                <Td>{item.category?.title ?? '-'}</Td>
                <Td>
                  <Toggle checked={Boolean(item.isActive)} onChange={() => onToggle(item.id)} />
                </Td>
                <Td>
                  <Button size="sm" variant="danger" onClick={() => setConfirmId(item.id)}>Delete</Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>

        {/* .empty-state sits below the table, so the header row stays put */}
        {!loading && items.length === 0 ? (
          <div className="p-6 text-center text-[#888]">No sub-categories found.</div>
        ) : null}
        {loading ? <div className="p-6 text-center text-admin-muted">Loading…</div> : null}
      </Card>

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
