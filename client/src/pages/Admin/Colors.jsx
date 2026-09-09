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
  ColorDot,
} from '../../components/admin/AdminControls.jsx'
import { closestColorName, normalizeHex } from '../../utils/color-names.js'
import { usePageTitle } from '../../theme/page.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/colors/index.blade.php + colors/_items.blade.php.
 *
 * An inline add/edit form over the listing table. Editing is IN PLACE: the Edit button on a
 * row loads that row into the form above and swaps the card title to "Edit Color" — there is
 * no separate edit screen, which is why the table's Edit is a button rather than a link.
 *
 * The picker autofills the name from the nearest of ~90 named colours (utils/color-names.js,
 * ported from the Blade's inline script). Typing a hex does the same on change; leaving the
 * field only normalises it, without overwriting a name the user has since edited. That
 * asymmetry is deliberate in the original.
 *
 * Cancel is always visible, matching the live panel. The Blade marks it `hidden`, but
 * admin.css sets `.btn { display: inline-flex }`, which beats the browser's `[hidden]` rule —
 * so it has always shown. Reproduced rather than corrected.
 */
export default function Colors() {
  usePageTitle('Colors - Purple Panther')

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('#000000')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmId, setConfirmId] = useState(null)
  const [busy, setBusy] = useState(false)

  const { data, loading, refetch } = useApi(() => api.admin.colors.list({ search, page }), [search, page])

  const items = data?.items ?? []
  const pagination = data?.pagination ?? { page: 1, lastPage: 1, total: 0, perPage: 25 }

  function reset() {
    setEditing(null)
    setName('')
    setCode('#000000')
  }

  /** picker `input` — set the hex and autofill the name. */
  function onPick(value) {
    const hex = value.toUpperCase()
    setCode(hex)
    setName(closestColorName(hex))
  }

  /** text `change` — normalise, sync the picker, and autofill the name. */
  function onCodeCommit(value) {
    const hex = normalizeHex(value)
    if (/^#[0-9A-F]{6}$/.test(hex)) {
      setCode(hex)
      setName(closestColorName(hex))
    }
  }

  async function onSave(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      if (editing) await api.admin.colors.update(editing, { name, code })
      else await api.admin.colors.create({ name, code })
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
      await api.admin.colors.toggle(id)
      refetch()
    } catch (err) {
      setError(err.message)
    }
  }

  async function onDelete() {
    setBusy(true)
    try {
      await api.admin.colors.remove(confirmId)
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
        <h2 className="text-[26px] font-bold text-[#333]">Colors</h2>
        <div className="flex flex-wrap items-center gap-2.5 max-sm:w-full">
          <AdminSearch value={search} onChange={(v) => { setSearch(v); setPage(1) }} />
        </div>
      </div>

      <Alert onDismiss={() => setError('')}>{error}</Alert>

      <Card className="mb-[18px]">
        <h3 className="mb-1.5 text-[18px] font-bold text-[#333]">{editing ? 'Edit Color' : 'Add Color'}</h3>
        <p className="mb-3 text-[12px] leading-[1.3] text-[#888]">
          Pick a color — name fills automatically. You can still edit the name.
        </p>

        <FormGrid onSubmit={onSave} noValidate>
          <FormGroup label="Name">
            <input
              type="text"
              name="name"
              placeholder="Black"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={FORM_CONTROL}
            />
          </FormGroup>

          <FormGroup label="Color Code">
            {/* .color-code-row — 42px row, 10px gap, 42px swatch */}
            <div className="flex h-[42px] items-center gap-2.5">
              <input
                type="color"
                title="Pick a color"
                aria-label="Pick a color"
                value={code}
                onChange={(event) => onPick(event.target.value)}
                className="size-[42px] shrink-0 cursor-pointer rounded-md border border-[#ddd] bg-white p-0.5"
              />
              <input
                type="text"
                name="code"
                maxLength="7"
                placeholder="#000000"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                onBlur={(event) => setCode(normalizeHex(event.target.value) || event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onCodeCommit(event.currentTarget.value)
                }}
                className={`${FORM_CONTROL} min-w-0 flex-1`}
              />
            </div>
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
              <Th>Color</Th>
              <Th>Code</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((color) => (
              <tr key={color.id}>
                <Td>{String(color.id)}</Td>
                <Td>
                  <ColorDot code={color.code} />
                  {color.name}
                </Td>
                <Td>{color.code}</Td>
                <Td>
                  <Toggle checked={Boolean(color.isActive)} onChange={() => onToggle(color.id)} />
                </Td>
                <Td className="whitespace-nowrap">
                  <span className="mr-1.5 inline-block">
                    <EditButton
                      onClick={() => {
                        setEditing(color.id)
                        setName(color.name ?? '')
                        setCode(color.code || '#000000')
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                    />
                  </span>
                  <Button size="sm" variant="danger" onClick={() => setConfirmId(color.id)}>Delete</Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>

        {!loading && items.length === 0 ? (
          <div className="p-6 text-center text-[#888]">No colors found.</div>
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
