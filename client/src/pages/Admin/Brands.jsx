import { useState } from 'react'
import { useApi } from '../../hooks/useApi.js'
import {
  Card,
  Button,
  Table,
  Th,
  Td,
  ConfirmDialog,
  Pagination,
} from '../../components/admin/AdminUI.jsx'
import {
  AdminSearch,
  Toggle,
  FormGrid,
  FormGroup,
  FormActions,
  EditButton,
  FORM_CONTROL,
} from '../../components/admin/AdminControls.jsx'
import { usePageTitle } from '../../theme/page.js'
import { toast } from '../../store/toast.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/brands/index.blade.php + brands/_items.blade.php.
 *
 * The `.inline-form` + table pair, with the inline-edit behaviour from
 * public/js/inline-edit.js — Edit lifts the row into the form above, the card title becomes
 * "Edit Brand" and the submit reads "Update" with Cancel revealed.
 *
 * Two things differ from the News Types screen, which otherwise looks identical:
 *
 *   - the table is `.table` (14px cells on #eee) rather than `.admin-table` (13px on #f0f0f0)
 *   - the actions are `.btn-edit` (blue) and `.btn-danger` (white with a pink border), not
 *     two `.btn-light`s
 *
 * The form carries an IMAGE, so a save is multipart. The file input is deliberately not
 * re-populated on edit: a file input cannot be given a value, and the existing image is kept
 * by simply not sending a new one.
 */
export default function Brands() {
  usePageTitle('Brands - Purple Panther')

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')
  const [image, setImage] = useState(null)
  // Bumped on reset so the file input clears — it cannot be cleared by state alone.
  const [imageKey, setImageKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [busy, setBusy] = useState(false)

  const { data, loading, refetch } = useApi(
    () => api.admin.brands.list({ search, page }),
    [search, page],
  )

  const items = data?.items ?? []
  const pagination = data?.pagination ?? { page: 1, lastPage: 1, total: 0, perPage: 25 }

  function reset() {
    setEditing(null)
    setName('')
    setImage(null)
    setImageKey((key) => key + 1)
  }

  async function onSave(event) {
    event.preventDefault()

    if (!name.trim()) {
      toast.error('Please enter a name.')
      return
    }

    setSaving(true)
    try {
      const body = { name: name.trim() }
      const files = image ? { image } : null

      const res = editing
        ? await api.admin.brands.update(editing, body, files)
        : await api.admin.brands.create(body, files)

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
      toast.success((await api.admin.brands.toggle(id)).$message)
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function onDelete() {
    setBusy(true)
    try {
      toast.success((await api.admin.brands.remove(confirmId)).$message)
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
      {/* `.page-head` — the square `.search-box`, not the 40px pill */}
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[26px] font-bold text-[#333]">Brands</h2>
        <div className="flex flex-wrap items-center gap-2.5 max-sm:w-full">
          <AdminSearch value={search} onChange={(v) => { setSearch(v); setPage(1) }} />
        </div>
      </div>

      <Card className="mb-[18px]">
        <h3 className="mb-3 text-[18px] font-bold text-[#333]">
          {editing ? 'Edit Brand' : 'Add Brand'}
        </h3>

        <FormGrid onSubmit={onSave} noValidate>
          <FormGroup label="Name">
            <input
              type="text"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={FORM_CONTROL}
            />
          </FormGroup>

          <FormGroup label="Image">
            <input
              key={imageKey}
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              onChange={(event) => setImage(event.target.files?.[0] ?? null)}
              className={`${FORM_CONTROL} !py-2`}
            />
          </FormGroup>

          <FormActions>
            <Button type="submit" className="h-[42px]" loading={saving} disabled={saving}>
              {editing ? 'Update' : 'Save'}
            </Button>
            {/*
              `.js-edit-cancel` is `hidden` until an edit starts, but `.btn{display:inline-flex}`
              beats the attribute in the Laravel panel, so it was in fact always visible there.
              The screenshot shows it beside Save on the Add form for that reason — reproduced.
            */}
            <Button type="button" variant="light" className="h-[42px]" onClick={reset}>Cancel</Button>
          </FormActions>
        </FormGrid>
      </Card>

      <Card className="p-0">
        <Table>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Name</Th>
              <Th>Slug</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((brand) => (
              <tr key={brand.id}>
                <Td>{String(brand.id)}</Td>
                <Td>{brand.name}</Td>
                <Td>{brand.slug}</Td>
                <Td>
                  <Toggle checked={Boolean(brand.isActive)} onChange={() => onToggle(brand.id)} />
                </Td>
                {/* `.actions-cell` — 6px to the right of each button, 4px below */}
                <Td className="whitespace-nowrap">
                  <span className="mr-1.5 inline-block">
                    <EditButton
                      onClick={() => {
                        setEditing(brand.id)
                        setName(brand.name ?? '')
                        setImage(null)
                        setImageKey((key) => key + 1)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                    />
                  </span>
                  <Button size="sm" variant="danger" onClick={() => setConfirmId(brand.id)}>
                    Delete
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>

        {/* `.empty-state` sits OUTSIDE the table, not in a spanning row. */}
        {!loading && items.length === 0 ? (
          <div className="rounded-[10px] bg-white p-6 text-center text-[#888]">No brands found.</div>
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
        onCancel={() => setConfirmId(null)}
        onProceed={onDelete}
        busy={busy}
      />
    </>
  )
}
