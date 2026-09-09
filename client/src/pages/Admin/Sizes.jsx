import { useState } from 'react'
import { useApi } from '../../hooks/useApi.js'
import { Card, Table, Th, Td, Button, Alert, Pagination, ConfirmDialog } from '../../components/admin/AdminUI.jsx'
import {
  AdminSearch,
  Toggle,
  FormGrid,
  FormGroup,
  FormActions,
  FORM_CONTROL,
  EditButton,
} from '../../components/admin/AdminControls.jsx'
import { usePageTitle } from '../../theme/page.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/sizes/index.blade.php + sizes/_items.blade.php.
 *
 * The same shape as Colors with one field instead of two: an inline add/edit form over the
 * table, editing in place rather than on a separate screen. The placeholder is "M / L / XL",
 * which is the original's and reads as a format hint rather than an example value.
 *
 * Kept as its own component rather than folded into a shared "master data" screen with
 * Colors. They look alike today, but the Blade views are separate files with their own
 * fields and their own inline scripts, and collapsing them would make the next difference
 * between them expensive to express.
 */
export default function Sizes() {
  usePageTitle('Sizes - Purple Panther')

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const [busy, setBusy] = useState(false)

  const { data, loading, refetch } = useApi(() => api.admin.sizes.list({ search, page }), [search, page])

  const items = data?.items ?? []
  const pagination = data?.pagination ?? { page: 1, lastPage: 1, total: 0, perPage: 25 }

  function reset() {
    setEditing(null)
    setName('')
  }

  async function onSave(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      if (editing) await api.admin.sizes.update(editing, { name })
      else await api.admin.sizes.create({ name })
      reset()
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
      await api.admin.sizes.toggle(id)
      refetch()
    } catch (err) {
      setError(err.message)
    }
  }

  async function onDelete() {
    setBusy(true)
    try {
      await api.admin.sizes.remove(confirmId)
      setConfirmId(null)
      refetch()
    } catch (err) {
      setError(err.message)
      setConfirmId(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[26px] font-bold text-[#333]">Sizes</h2>
        <div className="flex flex-wrap items-center gap-2.5 max-sm:w-full">
          <AdminSearch value={search} onChange={(v) => { setSearch(v); setPage(1) }} />
        </div>
      </div>

      <Alert onDismiss={() => setError('')}>{error}</Alert>

      <Card className="mb-[18px]">
        <h3 className="mb-3 text-[18px] font-bold text-[#333]">{editing ? 'Edit Size' : 'Add Size'}</h3>

        <FormGrid onSubmit={onSave} noValidate>
          <FormGroup label="Name">
            <input
              type="text"
              name="name"
              placeholder="M / L / XL"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={FORM_CONTROL}
            />
          </FormGroup>

          <FormActions>
            <Button type="submit" className="h-[42px]" loading={saving} disabled={saving}>Save</Button>
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
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((size) => (
              <tr key={size.id}>
                <Td>{String(size.id)}</Td>
                <Td>{size.name}</Td>
                <Td>
                  <Toggle checked={Boolean(size.isActive)} onChange={() => onToggle(size.id)} />
                </Td>
                <Td className="whitespace-nowrap">
                  <span className="mr-1.5 inline-block">
                    <EditButton
                      onClick={() => {
                        setEditing(size.id)
                        setName(size.name ?? '')
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                    />
                  </span>
                  <Button size="sm" variant="danger" onClick={() => setConfirmId(size.id)}>Delete</Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>

        {!loading && items.length === 0 ? (
          <div className="p-6 text-center text-[#888]">No sizes found.</div>
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

      <ConfirmDialog open={confirmId !== null} onCancel={() => setConfirmId(null)} onProceed={onDelete} busy={busy} />
    </>
  )
}
