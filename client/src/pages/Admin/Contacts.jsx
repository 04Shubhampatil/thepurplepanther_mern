import { useMemo, useState } from 'react'
import { Mail, MailOpen, Trash2 } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import { ConfirmDialog, Pagination } from '../../components/admin/AdminUI.jsx'
import {
  DataTable,
  DataTh,
  DataTd,
  SortTh,
  ActionSquare,
  PanelSearch,
  PerPageSelect,
  PaginationInfo,
} from '../../components/admin/AdminTable.jsx'
import { formatDateDMY } from '../../utils/admin-date.js'
import { usePageTitle } from '../../theme/page.js'
import { toast } from '../../store/toast.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/contacts/index.blade.php + _subscribe.blade.php + _contact-form.blade.php.
 *
 * ONE card holding a title, two tabs and whichever table the tab selects — the card has no
 * padding of its own, so the tab strip's rule runs its full width.
 *
 * Both tables are fetched together, as ContactController fetched them: the tab is a view
 * concern, and switching it should not cost a round trip. Search, per-page and sorting are
 * per-tab, which is why the state below is keyed by tab rather than shared.
 *
 * Delete All is disabled until something is checked — `#subscribe-bulk-btn[disabled]` at
 * 0.45 opacity — because the Blade's button submitted whatever was selected and an empty
 * selection would have deleted nothing while looking like it did something.
 */
const TABS = [
  { key: 'subscribe', label: 'Subscribe', Icon: Mail },
  { key: 'contact', label: 'Contact Form', Icon: MailOpen },
]

/** `Str::limit($message, 80)` — 80 characters then an ellipsis, not a CSS clamp. */
function limit(value, max = 80) {
  const text = String(value ?? '')
  return text.length > max ? `${text.slice(0, max)}...` : text
}

export default function Contacts() {
  usePageTitle('Contact List - Purple Panther')

  const [tab, setTab] = useState('subscribe')
  const [state, setState] = useState({
    subscribe: { search: '', page: 1, perPage: 10, sort: 'created_at', dir: 'desc', checked: [] },
    contact: { search: '', page: 1, perPage: 10, sort: 'created_at', dir: 'desc', checked: [] },
  })
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  const s = state[tab]
  const patch = (changes) => setState((prev) => ({ ...prev, [tab]: { ...prev[tab], ...changes } }))

  const { subscribe, contact } = state

  const { data, loading, refetch } = useApi(
    () =>
      api.admin.contacts.list({
        subscribers_search: subscribe.search,
        subscribers_page: subscribe.page,
        subscribers_per_page: subscribe.perPage,
        subscribers_sort: subscribe.sort,
        subscribers_dir: subscribe.dir,
        messages_search: contact.search,
        messages_page: contact.page,
        messages_per_page: contact.perPage,
        messages_sort: contact.sort,
        messages_dir: contact.dir,
      }),
    [subscribe, contact],
  )

  const source = tab === 'subscribe' ? data?.subscribers : data?.messages
  const items = source?.items ?? []
  const pagination = source?.pagination ?? { page: 1, lastPage: 1, total: 0, perPage: s.perPage }

  const ids = useMemo(() => items.map((row) => String(row.id)), [items])
  const allChecked = ids.length > 0 && ids.every((id) => s.checked.includes(id))

  const toggleAll = () => patch({ checked: allChecked ? [] : ids })
  const toggleOne = (id) =>
    patch({ checked: s.checked.includes(id) ? s.checked.filter((v) => v !== id) : [...s.checked, id] })

  const onSort = (sort, dir) => patch({ sort, dir, page: 1 })

  async function runDelete() {
    setBusy(true)
    const { kind, id } = confirm

    try {
      const call =
        kind === 'bulk'
          ? tab === 'subscribe'
            ? api.admin.contacts.bulkSubscribers(s.checked.map(Number))
            : api.admin.contacts.bulkMessages(s.checked.map(Number))
          : tab === 'subscribe'
            ? api.admin.contacts.deleteSubscriber(id)
            : api.admin.contacts.deleteMessage(id)

      toast.success((await call).$message)
      patch({ checked: [] })
      refetch()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  /* `.action-sq.action-del` — the only per-row control on both tables. */
  const deleteButton = (id) => (
    <ActionSquare
      tone="delete"
      title="Delete"
      onClick={() => setConfirm({ kind: 'row', id, title: 'Are you sure?' })}
    >
      <Trash2 size={15} />
    </ActionSquare>
  )

  const headerCheckbox = (
    <input
      type="checkbox"
      checked={allChecked}
      onChange={toggleAll}
      title="Select all"
      aria-label="Select all"
      className="size-[15px] accent-admin-primary"
    />
  )

  return (
    <>
      {/* `.contact-list-card` — no padding, so the tab rule spans the card */}
      <div className="overflow-hidden rounded-[10px] bg-white shadow-admin-card">
        <div className="px-5 pt-[18px]">
          <h2 className="text-[20px] font-semibold text-[#444]">Contact List</h2>
        </div>

        {/* `.contact-tabs` — the active tab is --primary with a 2px underline */}
        <div className="mt-3.5 flex border-b border-[#eee] px-3">
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`-mb-px inline-flex items-center gap-2 border-b-2 px-[18px] py-3 text-[14px] font-semibold transition-colors ${
                  active
                    ? 'border-admin-primary text-admin-primary'
                    : 'border-transparent text-[#888] hover:text-admin-primary'
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            )
          })}
        </div>

        {/* `.contact-tab-body` */}
        <div className="px-5 pb-5 pt-4">
          {/* `.contact-toolbar` — Delete All left, search and per-page right */}
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={s.checked.length === 0}
              onClick={() =>
                setConfirm({
                  kind: 'bulk',
                  title: tab === 'subscribe' ? 'Delete selected subscribers?' : 'Delete selected messages?',
                })
              }
              className="inline-flex items-center justify-center gap-1.5 rounded-md border-none bg-[#e53935] px-4 py-[10px] text-[13px] font-semibold text-white transition-opacity hover:bg-[#c62828] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[#e53935]"
            >
              <Trash2 size={14} />
              Delete All
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              <PanelSearch value={s.search} onChange={(v) => patch({ search: v, page: 1 })} />
              <PerPageSelect value={s.perPage} onChange={(n) => patch({ perPage: n, page: 1 })} />
            </div>
          </div>

          <DataTable caption={tab === 'subscribe' ? 'Subscribers' : 'Contact messages'}>
            <thead>
              {tab === 'subscribe' ? (
                <tr>
                  <DataTh className="w-10">{headerCheckbox}</DataTh>
                  <DataTh className="w-[60px]">#</DataTh>
                  <SortTh column="email" label="Email" sort={s.sort} dir={s.dir} onSort={onSort} />
                  <SortTh column="created_at" label="Date" sort={s.sort} dir={s.dir} onSort={onSort} />
                  <DataTh className="w-[90px]">Action</DataTh>
                </tr>
              ) : (
                <tr>
                  <DataTh className="w-10">{headerCheckbox}</DataTh>
                  <SortTh column="name" label="Name" sort={s.sort} dir={s.dir} onSort={onSort} />
                  <SortTh column="email" label="Email" sort={s.sort} dir={s.dir} onSort={onSort} />
                  <SortTh column="subject" label="Subject" sort={s.sort} dir={s.dir} onSort={onSort} />
                  <SortTh column="message" label="Message" sort={s.sort} dir={s.dir} onSort={onSort} />
                  <SortTh column="created_at" label="Date" sort={s.sort} dir={s.dir} onSort={onSort} />
                  <DataTh className="w-[90px]">Action</DataTh>
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <DataTd colSpan={tab === 'subscribe' ? 5 : 7} className="py-6 text-center text-admin-muted">
                    Loading…
                  </DataTd>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={tab === 'subscribe' ? 5 : 7} className="p-6 text-[#888]">
                    {tab === 'subscribe' ? 'No subscribers found' : 'No contact messages found'}
                  </td>
                </tr>
              ) : (
                items.map((row, index) => {
                  const id = String(row.id)
                  const check = (
                    <input
                      type="checkbox"
                      checked={s.checked.includes(id)}
                      onChange={() => toggleOne(id)}
                      aria-label={`Select ${row.email}`}
                      className="size-[15px] accent-admin-primary"
                    />
                  )

                  return tab === 'subscribe' ? (
                    <tr key={id}>
                      <DataTd>{check}</DataTd>
                      {/* `$paginator->firstItem() + $loop->index` — a running number, not the id */}
                      <DataTd>{(pagination.page - 1) * pagination.perPage + index + 1}</DataTd>
                      <DataTd>{row.email}</DataTd>
                      <DataTd className="whitespace-nowrap">{formatDateDMY(row.createdAt)}</DataTd>
                      <DataTd>{deleteButton(row.id)}</DataTd>
                    </tr>
                  ) : (
                    <tr key={id}>
                      <DataTd>{check}</DataTd>
                      <DataTd>{row.name}</DataTd>
                      <DataTd>{row.email}</DataTd>
                      <DataTd>{row.subject || '—'}</DataTd>
                      {/* `.contact-message-cell` — capped at 320px and clipped */}
                      <DataTd className="max-w-[320px] truncate" title={row.message}>
                        {limit(row.message)}
                      </DataTd>
                      <DataTd className="whitespace-nowrap">{formatDateDMY(row.createdAt)}</DataTd>
                      <DataTd>{deleteButton(row.id)}</DataTd>
                    </tr>
                  )
                })
              )}
            </tbody>
          </DataTable>

          {/* `.contact-pagination` — rendered only when there is something to page through */}
          {pagination.total > 0 ? (
            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5">
              <PaginationInfo pagination={pagination} />
              <Pagination
                page={pagination.page}
                lastPage={pagination.lastPage}
                total={pagination.total}
                perPage={pagination.perPage}
                onChange={(page) => patch({ page })}
              />
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title}
        onCancel={() => setConfirm(null)}
        onProceed={runDelete}
        busy={busy}
      />
    </>
  )
}
