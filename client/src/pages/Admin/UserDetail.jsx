import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Mail, Smartphone, Eye, Printer } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import { Pagination } from '../../components/admin/AdminUI.jsx'
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
import { storageUrl } from '../../utils/admin-media.js'
import { formatDateDMY, formatDateTime } from '../../utils/admin-date.js'
import { usePageTitle } from '../../theme/page.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/users/show.blade.php.
 *
 * A `.user-profile-banner` — four white cards on a #455a64 strip — over a tabbed card. Five
 * tabs; four are searchable, sortable, paginated tables and Profile is a plain two-block
 * list, which is why the toolbar is hidden on that one.
 *
 * Only the ACTIVE tab is fetched, as UserController::show queried it. A customer with
 * hundreds of orders should not pay for their wishlist and reviews to render a page showing
 * neither, so the tab is part of the request rather than a filter over one big payload.
 */
const TABS = [
  { key: 'wishlist', label: 'Wishlist' },
  { key: 'cart', label: 'My Cart' },
  { key: 'orders', label: 'Orders' },
  { key: 'profile', label: 'Profile' },
  { key: 'reviews', label: 'Reviews' },
]

const BADGE_CLASSES = {
  'badge-placed': 'bg-[#eceff1] text-[#546e7a]',
  'badge-packed': 'bg-[#e3f2fd] text-[#1565c0]',
  'badge-shipped': 'bg-[#fff3e0] text-[#ef6c00]',
  'badge-delivered': 'bg-[#e8f5e9] text-[#2e7d32]',
  'badge-cancelled': 'bg-[#ffebee] text-[#c62828]',
}

/** `number_format($v, 2)` — grouped, always two decimals, no symbol in these columns. */
const amount = (value) =>
  Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const limit = (value, max = 60) => {
  const text = String(value ?? '')
  return text.length > max ? `${text.slice(0, max)}...` : text
}

/** `.table-thumb` — 48px at 6px radius, or an em dash when there is no image. */
function Thumb({ path }) {
  if (!path) return '—'
  return <img src={storageUrl(path)} alt="" className="size-12 rounded-md bg-[#eee] object-cover" />
}

/** `.profile-item-card` — one saved address or bank account. */
function ProfileCard({ title, lines, isDefault }) {
  return (
    <div className="mb-2.5 rounded-lg border border-[#eee] bg-[#fafafa] p-3">
      <strong className="block text-[14px] font-bold text-[#333]">{title}</strong>
      {lines.filter(Boolean).map((line) => (
        <p key={line} className="mt-0.5 text-[13px] text-[#666]">{line}</p>
      ))}
      {isDefault ? (
        <span className="mt-1.5 inline-block rounded-full bg-[#e8f5e9] px-2 py-0.5 text-[11px] font-bold text-[#2e7d32]">
          Default
        </span>
      ) : null}
    </div>
  )
}

export default function UserDetail() {
  const { id } = useParams()
  const [tab, setTab] = useState('wishlist')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' })

  const { data, loading } = useApi(
    () => api.admin.userDetail(id, { tab, q, page, per_page: perPage, sort: sort.key, dir: sort.dir }),
    [id, tab, q, page, perPage, sort],
  )

  const user = data?.user
  usePageTitle(`${user?.name ?? 'User'} - Users - Purple Panther`)

  const source = data?.[tab === 'cart' ? 'cart' : tab]
  const items = source?.items ?? []
  const pagination = source?.pagination ?? { page: 1, lastPage: 1, total: 0, perPage }

  /** Switching tabs resets the tab-local state, since the columns differ per tab. */
  function selectTab(key) {
    setTab(key)
    setQ('')
    setPage(1)
    setSort({ key: 'created_at', dir: 'desc' })
  }

  const onSort = (key, dir) => {
    setSort({ key, dir })
    setPage(1)
  }

  const rowNumber = (index) => (pagination.page - 1) * pagination.perPage + index + 1
  const th = (column, label) => (
    <SortTh column={column} label={label} sort={sort.key} dir={sort.dir} onSort={onSort} />
  )

  const columnCount = { wishlist: 6, cart: 8, orders: 8, reviews: 7 }[tab] ?? 6

  const avatar = user?.avatar
    ? storageUrl(user.avatar)
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? '')}&background=e91e63&color=fff`

  return (
    <>
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/users" className="text-[14px] font-semibold text-admin-primary hover:underline">
          ← Back
        </Link>
        <Link
          to={`/admin/users/${id}/edit`}
          className="inline-flex items-center justify-center rounded-md bg-admin-primary px-4 py-[10px] text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-dark"
        >
          Edit
        </Link>
      </div>

      {/* `.user-profile-banner` — four cards on #455a64, one column each */}
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-[10px] bg-[#455a64] p-4 min-[576px]:grid-cols-2 min-[992px]:grid-cols-4">
        <div className="flex min-h-[72px] items-center gap-3 rounded-lg bg-white px-4 py-3.5 text-[13px] font-semibold text-[#444]">
          <div className="relative size-12 shrink-0">
            <img src={avatar} alt={user?.name} className="size-full rounded-full bg-[#eee] object-cover" />
            {user?.loginProvider === 'google' ? (
              <span
                title="Google login"
                className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full border border-[#ddd] bg-white text-[9px] font-extrabold leading-none text-[#4285f4]"
              >
                G
              </span>
            ) : null}
          </div>
          <strong className="break-words">{String(user?.name ?? '').toUpperCase()}</strong>
        </div>

        <div className="flex min-h-[72px] items-center gap-3 rounded-lg bg-white px-4 py-3.5 text-[13px] font-semibold text-[#444]">
          <Mail size={18} className="shrink-0 text-[#666]" />
          <span className="break-all">{user?.email}</span>
        </div>

        <div className="flex min-h-[72px] items-center gap-3 rounded-lg bg-white px-4 py-3.5 text-[13px] font-semibold text-[#444]">
          <Smartphone size={18} className="shrink-0 text-[#666]" />
          <span>{user?.phone || '—'}</span>
        </div>

        <div className="flex min-h-[72px] items-center gap-3 rounded-lg bg-white px-4 py-3.5 text-[13px] font-semibold text-[#444]">
          <span>REGISTER ON: {formatDateTime(user?.createdAt)}</span>
        </div>
      </div>

      {/* `.user-tabs-wrap` — a card with no padding, so the tab strip spans it */}
      <div className="overflow-hidden rounded-[10px] bg-white shadow-admin-card">
        {/* `.user-tabs` — a #f5f5f5 strip; the active tab turns white with a blue underline */}
        <div className="flex flex-wrap border-b border-[#eee] bg-[#f5f5f5]">
          {TABS.map(({ key, label }) => {
            const active = tab === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectTab(key)}
                className={`border-b-2 px-[18px] py-3 text-[13px] font-semibold transition-colors ${
                  active
                    ? 'border-[#1e88e5] bg-white text-[#1e88e5]'
                    : 'border-transparent text-[#666] hover:text-[#1e88e5]'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* `.user-tab-body` */}
        <div className="p-4">
          {/* `.user-tab-toolbar` — right-aligned, and absent on the Profile tab */}
          {tab !== 'profile' ? (
            <div className="mb-3 flex flex-wrap items-center justify-end gap-2.5">
              <PanelSearch value={q} onChange={(v) => { setQ(v); setPage(1) }} />
              <PerPageSelect value={perPage} onChange={(n) => { setPerPage(n); setPage(1) }} />
            </div>
          ) : null}

          {tab === 'profile' ? (
            <div className="grid grid-cols-1 gap-6 min-[768px]:grid-cols-2">
              <div>
                <h4 className="mb-2.5 flex items-center gap-2 text-[15px] font-bold text-[#333]">
                  <span>📍</span> Manage Address
                </h4>
                {(data?.addresses ?? []).length === 0 ? (
                  <p className="text-[12px] text-[#888]">No addresses saved.</p>
                ) : (
                  data.addresses.map((address) => (
                    <ProfileCard
                      key={address.id}
                      title={address.label || 'Address'}
                      isDefault={address.isDefault}
                      lines={[
                        [address.name, address.phone].filter(Boolean).join(' · '),
                        [address.addressLine1, address.addressLine2].filter(Boolean).join(', '),
                        [address.city, address.state, address.pincode, address.country]
                          .filter(Boolean)
                          .join(', '),
                      ]}
                    />
                  ))
                )}
              </div>

              <div>
                <h4 className="mb-2.5 flex items-center gap-2 text-[15px] font-bold text-[#333]">
                  <span>💳</span> Saved Bank Account
                </h4>
                {(data?.bankAccounts ?? []).length === 0 ? (
                  <p className="text-[12px] text-[#888]">No bank accounts saved.</p>
                ) : (
                  data.bankAccounts.map((bank) => (
                    <ProfileCard
                      key={bank.id}
                      title={bank.accountHolder}
                      isDefault={bank.isDefault}
                      lines={[
                        bank.bankName,
                        `A/C: ${bank.accountNumber}${bank.ifsc ? ` · IFSC: ${bank.ifsc}` : ''}`,
                      ]}
                    />
                  ))
                )}
              </div>
            </div>
          ) : (
            <>
              <DataTable caption={TABS.find((t) => t.key === tab)?.label}>
                <thead>
                  <tr>
                    <DataTh>#</DataTh>
                    {tab === 'wishlist' ? (
                      <>
                        <DataTh>Image</DataTh>
                        {th('product', 'Product')}
                        {th('price', 'Price')}
                        {th('created_at', 'Created On')}
                        <DataTh>Action</DataTh>
                      </>
                    ) : null}
                    {tab === 'cart' ? (
                      <>
                        <DataTh>Image</DataTh>
                        {th('product', 'Product')}
                        {th('quantity', 'Qty')}
                        {th('price', 'Price')}
                        {th('total', 'Total Price')}
                        {th('created_at', 'Created On')}
                        <DataTh>Action</DataTh>
                      </>
                    ) : null}
                    {tab === 'orders' ? (
                      <>
                        {th('order_number', 'Order ID')}
                        {th('user_name', 'User Name')}
                        {th('user_phone', 'User Phone')}
                        {th('payable_amount', 'Payable Amount')}
                        {th('ordered_at', 'Ordered On')}
                        {th('status', 'Status')}
                        <DataTh>Action</DataTh>
                      </>
                    ) : null}
                    {tab === 'reviews' ? (
                      <>
                        {th('product', 'Product')}
                        {th('rating', 'Ratings')}
                        {th('comment', 'Reviews')}
                        <DataTh>Image</DataTh>
                        {th('created_at', 'Review On')}
                        <DataTh>Action</DataTh>
                      </>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <DataTd colSpan={columnCount} className="py-6 text-center text-admin-muted">
                        Loading…
                      </DataTd>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      {/* The Blade's own wording, left-aligned as `.empty-state` renders it here */}
                      <td colSpan={columnCount} className="p-6 text-[#888]">
                        No data available in table
                      </td>
                    </tr>
                  ) : (
                    items.map((row, index) => (
                      <tr key={row.id}>
                        <DataTd>{rowNumber(index)}</DataTd>

                        {tab === 'wishlist' ? (
                          <>
                            <DataTd><Thumb path={row.product?.featuredImage} /></DataTd>
                            <DataTd>{row.product?.title ?? '—'}</DataTd>
                            <DataTd>{row.product ? amount(row.product.sellingPrice) : '—'}</DataTd>
                            <DataTd className="whitespace-nowrap">{formatDateDMY(row.createdAt)}</DataTd>
                            <DataTd>—</DataTd>
                          </>
                        ) : null}

                        {tab === 'cart' ? (
                          <>
                            <DataTd><Thumb path={row.product?.featuredImage} /></DataTd>
                            <DataTd>{row.product?.title ?? '—'}</DataTd>
                            <DataTd>{row.quantity}</DataTd>
                            <DataTd>{amount(row.product?.sellingPrice)}</DataTd>
                            {/* The line total is COMPUTED — cart_items stores no price column */}
                            <DataTd>{amount(Number(row.product?.sellingPrice ?? 0) * Number(row.quantity))}</DataTd>
                            <DataTd className="whitespace-nowrap">{formatDateDMY(row.createdAt)}</DataTd>
                            <DataTd>—</DataTd>
                          </>
                        ) : null}

                        {tab === 'orders' ? (
                          <>
                            <DataTd>
                              <Link
                                to={`/admin/orders/${row.id}`}
                                className="font-semibold text-[#1e88e5] hover:underline"
                              >
                                {row.orderNumber}
                              </Link>
                            </DataTd>
                            <DataTd>{row.userName || user?.name}</DataTd>
                            <DataTd className="whitespace-nowrap">{row.userPhone || user?.phone || '—'}</DataTd>
                            <DataTd>{amount(row.payableAmount)}</DataTd>
                            <DataTd className="whitespace-nowrap">{formatDateDMY(row.orderedAt)}</DataTd>
                            <DataTd>
                              <span
                                className={`inline-block rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.02em] ${
                                  BADGE_CLASSES[row.statusBadgeClass] ?? BADGE_CLASSES['badge-placed']
                                }`}
                              >
                                {String(row.statusLabel ?? row.status).toUpperCase()}
                              </span>
                            </DataTd>
                            <DataTd>
                              <div className="flex items-center gap-1.5">
                                <ActionSquare as={Link} to={`/admin/orders/${row.id}`} tone="view" title="View">
                                  <Eye size={15} />
                                </ActionSquare>
                                <ActionSquare
                                  as="a"
                                  href={`/admin/orders/${row.id}/print`}
                                  target="_blank"
                                  rel="noreferrer"
                                  tone="view"
                                  title="Print"
                                  className="!bg-[#4fc3f7] hover:!bg-[#29b6f6]"
                                >
                                  <Printer size={15} />
                                </ActionSquare>
                              </div>
                            </DataTd>
                          </>
                        ) : null}

                        {tab === 'reviews' ? (
                          <>
                            <DataTd>{row.product?.title ?? '—'}</DataTd>
                            <DataTd className="whitespace-nowrap">{row.rating} ★</DataTd>
                            <DataTd className="max-w-[320px] truncate" title={row.comment}>
                              {limit(row.comment)}
                            </DataTd>
                            <DataTd><Thumb path={row.image} /></DataTd>
                            <DataTd className="whitespace-nowrap">{formatDateDMY(row.createdAt)}</DataTd>
                            <DataTd>—</DataTd>
                          </>
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </DataTable>

              {/* `_tab-pagination` — the count shows even when the tab is empty */}
              <div className="mt-3.5 flex w-full flex-wrap items-center justify-between gap-3">
                <PaginationInfo pagination={pagination} />
                <Pagination
                  page={pagination.page}
                  lastPage={pagination.lastPage}
                  total={pagination.total}
                  perPage={pagination.perPage}
                  onChange={setPage}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
