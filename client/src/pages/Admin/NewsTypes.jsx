import { useState } from 'react'
import { useApi } from '../../hooks/useApi.js'
import { Card, Button, Table, Th, Td, ConfirmDialog, Pagination } from '../../components/admin/AdminUI.jsx'
import {
  AdminSearch,
  Toggle,
  FormGrid,
  FormGroup,
  FormActions,
  FORM_CONTROL,
} from '../../components/admin/AdminControls.jsx'
import { usePageTitle } from '../../theme/page.js'
import { toast } from '../../store/toast.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/news-types/index.blade.php + news-types/_items.blade.php.
 *
 * The `.inline-form` + table pair Colors and Sizes use, with the inline-edit behaviour from
 * public/js/inline-edit.js: pressing Edit lifts the row into the form above the table, and
 * while editing the card title reads "Edit News Type" and the submit button reads "Update"
 * (`data-edit-title` / the `submitBtn.textContent = 'Update'` line) with Cancel revealed.
 * Both are `data-*` swaps in the original, so they are state here rather than two forms.
 *
 * Actions are BOTH `.btn-light.btn-sm` — this screen predates `.btn-edit`, so Edit is not
 * the blue control other tables use. Reproduced rather than harmonised.
 */
export default function NewsTypes() {
  usePageTitle('News Types - Purple Panther')

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null)
  const [title, setTitle] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [busy, setBusy] = useState(false)

  const { data, loading, refetch } = useApi(
    () => api.admin.newsTypes.list({ search, page }),
    [search, page],
  )

  const items = data?.items ?? []
  const pagination = data?.pagination ?? { page: 1, lastPage: 1, total: 0, perPage: 25 }

  function reset() {
    setEditing(null)
    setTitle('')
    setSortOrder('0')
  }

  async function onSave(event) {
    event.preventDefault()
    setSaving(true)

    const body = { title: title.trim(), sort_order: Number(sortOrder) || 0 }

    try {
      const res = editing
        ? await api.admin.newsTypes.update(editing, body)
        : await api.admin.newsTypes.create(body)
      toast.success(res.$message)
      reset()
      refetch()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onToggle(id) {
    try {
      toast.success((await api.admin.newsTypes.toggle(id)).$message)
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function onDelete() {
    setBusy(true)
    try {
      toast.success((await api.admin.newsTypes.remove(confirmId)).$message)
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
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[26px] font-bold text-[#333]">News Types</h2>
        <div className="flex flex-wrap items-center gap-2.5 max-sm:w-full">
          <AdminSearch value={search} onChange={(v) => { setSearch(v); setPage(1) }} />
        </div>
      </div>
      <Card className="mb-[18px]">
        <h3 className="mb-3 text-[18px] font-bold text-[#333]">
          {editing ? 'Edit News Type' : 'Add News Type'}
        </h3>

        <FormGrid onSubmit={onSave} noValidate>
          <FormGroup label="Title">
            <input
              type="text"
              name="title"
              placeholder="Fashion, Luxury, Style..."
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={FORM_CONTROL}
            />
          </FormGroup>

          <FormGroup label="Sort Order">
            <input
              type="number"
              name="sort_order"
              min="0"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              className={FORM_CONTROL}
            />
          </FormGroup>

          <FormActions>
            <Button type="submit" className="h-[42px]" loading={saving} disabled={saving}>
              {editing ? 'Update' : 'Save'}
            </Button>
            {/*
              `.js-edit-cancel` is `hidden` until an edit starts. `.btn { display:inline-flex }`
              beats the `[hidden]` attribute in the Laravel panel, so the button was in fact
              always visible there; here it is genuinely conditional.
            */}
            {editing ? (
              <Button type="button" variant="light" className="h-[42px]" onClick={reset}>Cancel</Button>
            ) : null}
          </FormActions>
        </FormGrid>
      </Card>

      <Card className="p-0">
        <Table>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Title</Th>
              <Th>Slug</Th>
              <Th>Sort</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((type) => (
              <tr key={type.id}>
                <Td>{String(type.id)}</Td>
                <Td>{type.title}</Td>
                <Td>{type.slug}</Td>
                <Td>{type.sortOrder}</Td>
                <Td>
                  <Toggle checked={Boolean(type.isActive)} onChange={() => onToggle(type.id)} />
                </Td>
                <Td className="whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="light"
                    className="mr-1.5"
                    onClick={() => {
                      setEditing(type.id)
                      setTitle(type.title ?? '')
                      setSortOrder(String(type.sortOrder ?? 0))
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="light" onClick={() => setConfirmId(type.id)}>Delete</Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>

        {/* `.empty-state` sits OUTSIDE the table here, not in a spanning row. */}
        {!loading && items.length === 0 ? (
          <div className="rounded-[10px] bg-white p-6 text-center text-[#888]">No news types found.</div>
        ) : null}
      </Card>

      <div className="mt-5 flex justify-end">
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
        title="Delete this news type?"
        onCancel={() => setConfirmId(null)}
        onProceed={onDelete}
        busy={busy}
      />
    </>
  )
}
