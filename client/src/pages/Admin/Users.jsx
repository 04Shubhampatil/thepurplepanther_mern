import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import { ConfirmDialog, Pagination } from '../../components/admin/AdminUI.jsx'
import { Toggle } from '../../components/admin/AdminControls.jsx'
import {
  DataTable,
  DataTh,
  DataTd,
  SortTh,
  ActionSquare,
  PanelSearch,
  PerPageSelect,
  SelectAll,
  BulkActions,
  PaginationInfo,
} from '../../components/admin/AdminTable.jsx'
import { storageUrl } from '../../utils/admin-media.js'
import { formatDateDMY } from '../../utils/admin-date.js'
import { usePageTitle } from '../../theme/page.js'
import { toast } from '../../store/toast.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/users/index.blade.php.
 *
 * A `.product-panel` in two rows — search, per-page and Add New on top, Select All and the
 * bulk Action menu right-aligned below — over `.admin-table.users-table`.
 *
 * Every header except the first and last sorts, and sorting is SERVER-side: the list is
 * paginated, so ordering the ten rows on screen would order the wrong ten.
 *
 * `avatar_url` and `is_google_login` are accessors. The first falls back to a ui-avatars.com
 * URL built from the name; the second is `login_provider === 'google'`, which is why the row
 * shows a badge rather than a column.
 */
const BULK_ITEMS = [
  { value: 'enable', label: 'Enable' },
  { value: 'disable', label: 'Disable', confirm: 'Action: Disable' },
  { value: 'delete', label: 'Delete', confirm: 'Action: Delete' },
]

/** `getAvatarUrlAttribute` — the fallback is generated from the name, not a static file. */
function avatarUrl(user) {
  if (user.avatar) return storageUrl(user.avatar)
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name ?? '')}&background=e91e63&color=fff`
}

export default function Users() {
  usePageTitle('Users - Purple Panther')

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' })
  const [checked, setChecked] = useState([])
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  const { data, loading, refetch } = useApi(
    () =>
      api.admin.users.list({
        search,
        page,
        per_page: perPage,
        sort: sort.key,
        dir: sort.dir,
      }),
    [search, page, perPage, sort],
  )

  const items = data?.items ?? []
  const pagination = data?.pagination ?? { page: 1, lastPage: 1, total: 0, perPage }

  const ids = useMemo(() => items.map((user) => String(user.id)), [items])
  const allChecked = ids.length > 0 && ids.every((id) => checked.includes(id))
  const someChecked = checked.length > 0

  const toggleAll = () => setChecked(allChecked ? [] : ids)
  const toggleOne = (id) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))

  function onSort(key, dir) {
    setSort({ key, dir })
    setPage(1)
  }

  async function onToggle(id) {
    try {
      toast.success((await api.admin.users.toggle(id)).$message)
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  /** Enable applies straight away; Disable and Delete go through the confirm, as in Blade. */
  function onBulk(item) {
    if (checked.length === 0) {
      toast.error('Please select at least one user.')
      return
    }
    if (item.confirm) setConfirm({ kind: 'bulk', action: item.value, title: item.confirm })
    else runBulk(item.value)
  }

  async function runBulk(action) {
    setBusy(true)
    try {
      const res = await api.admin.usersBulk(action, checked.map(Number))
      toast.success(res.$message)
      setChecked([])
      refetch()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  async function runDelete(id) {
    setBusy(true)
    try {
      toast.success((await api.admin.users.remove(id)).$message)
      setChecked((prev) => prev.filter((v) => v !== String(id)))
      refetch()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  return (
    <>
      {/* `.product-panel` — two rows inside one white card */}
      <div className="mb-[18px] rounded-[10px] bg-white px-5 py-[18px] shadow-[0_1px_4px_rgba(0,0,0,0.04)] max-sm:p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 max-sm:flex-col max-sm:items-stretch">
          <h2 className="text-[22px] font-semibold text-[#444]">Users</h2>

          <div className="flex flex-wrap items-center gap-3 max-sm:w-full">
            <PanelSearch value={search} onChange={(v) => { setSearch(v); setPage(1) }} />
            <PerPageSelect value={perPage} onChange={(n) => { setPerPage(n); setPage(1) }} />
            <Link
              to="/admin/users/create"
              className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md bg-admin-primary px-[18px] text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-dark"
            >
              Add New
            </Link>
          </div>
        </div>

        {/* `.product-panel-bottom` — right-aligned on this screen */}
        <div className="flex flex-wrap items-center justify-end gap-4 pt-1">
          <SelectAll checked={allChecked} indeterminate={someChecked} onChange={toggleAll} />
          <BulkActions items={BULK_ITEMS} onSelect={onBulk} />
        </div>
      </div>

      <div className="rounded-[10px] bg-white p-[18px] shadow-admin-card">
        <DataTable caption="Users">
          <thead>
            <tr>
              <DataTh className="w-10">
                <span className="sr-only">Select</span>
              </DataTh>
              <SortTh column="platform" label="Platform" sort={sort.key} dir={sort.dir} onSort={onSort} />
              <SortTh column="name" label="Name" sort={sort.key} dir={sort.dir} onSort={onSort} />
              <SortTh column="email" label="Email" sort={sort.key} dir={sort.dir} onSort={onSort} />
              <SortTh column="created_at" label="Register On" sort={sort.key} dir={sort.dir} onSort={onSort} />
              <SortTh column="is_active" label="Status" sort={sort.key} dir={sort.dir} onSort={onSort} />
              <DataTh>Action</DataTh>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <DataTd colSpan={7} className="py-6 text-center text-admin-muted">Loading…</DataTd>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[#888]">
                  No users found. <Link to="/admin/users/create" className="text-admin-primary underline">Add New</Link>
                </td>
              </tr>
            ) : (
              items.map((user) => {
                const id = String(user.id)
                return (
                  <tr key={id}>
                    <DataTd>
                      <input
                        type="checkbox"
                        checked={checked.includes(id)}
                        onChange={() => toggleOne(id)}
                        aria-label={`Select ${user.name}`}
                        className="size-[15px] accent-admin-primary"
                      />
                    </DataTd>
                    {/* `$user->platform ?: 'Web'` */}
                    <DataTd>{user.platform || 'Web'}</DataTd>
                    <DataTd>
                      {/* `.user-name-cell` — 40px avatar, 10px gap, blue name link */}
                      <div className="flex items-center gap-2.5">
                        <div className="relative size-10 shrink-0">
                          <img
                            src={avatarUrl(user)}
                            alt={user.name}
                            className="size-full rounded-full bg-[#eee] object-cover"
                          />
                          {user.loginProvider === 'google' ? (
                            <span
                              title="Google login"
                              className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full border border-[#ddd] bg-white text-[9px] font-extrabold leading-none text-[#4285f4]"
                            >
                              G
                            </span>
                          ) : null}
                        </div>
                        <Link
                          to={`/admin/users/${id}`}
                          className="font-semibold text-[#1e88e5] hover:underline"
                        >
                          {user.name}
                        </Link>
                      </div>
                    </DataTd>
                    <DataTd>{user.email}</DataTd>
                    <DataTd className="whitespace-nowrap">{formatDateDMY(user.createdAt)}</DataTd>
                    <DataTd>
                      <Toggle
                        checked={Boolean(user.isActive)}
                        onChange={() => onToggle(user.id)}
                        title="Enable / Disable"
                      />
                    </DataTd>
                    <DataTd>
                      {/* `.user-row-actions` — 32px squares at a 6px gap */}
                      <div className="flex items-center gap-1.5">
                        <ActionSquare as={Link} to={`/admin/users/${id}`} tone="view" title="View">
                          <Eye size={15} />
                        </ActionSquare>
                        <ActionSquare as={Link} to={`/admin/users/${id}/edit`} tone="edit" title="Edit">
                          <Pencil size={15} />
                        </ActionSquare>
                        <ActionSquare
                          tone="delete"
                          title="Delete"
                          onClick={() => setConfirm({ kind: 'row', id: user.id, title: 'Are you sure?' })}
                        >
                          <Trash2 size={15} />
                        </ActionSquare>
                      </div>
                    </DataTd>
                  </tr>
                )
              })
            )}
          </tbody>
        </DataTable>
      </div>

      {/* `.users-pagination` — the count on the left, the links on the right */}
      <div className="mt-[18px] flex w-full flex-wrap items-center justify-between gap-3">
        <PaginationInfo pagination={pagination} />
        <Pagination
          page={pagination.page}
          lastPage={pagination.lastPage}
          total={pagination.total}
          perPage={pagination.perPage}
          onChange={setPage}
        />
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title}
        onCancel={() => setConfirm(null)}
        onProceed={() => (confirm.kind === 'bulk' ? runBulk(confirm.action) : runDelete(confirm.id))}
        busy={busy}
      />
    </>
  )
}
