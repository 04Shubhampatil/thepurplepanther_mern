import { useState } from 'react'
import { Search, Trash2 } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import Loading from '../../components/common/Loading.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import Alert from '../../components/ui/Alert.jsx'
import { formatDate } from '../../utils/format.js'
import {
  AdminPage,
  AdminSection,
  Table,
  Th,
  Td,
  EmptyRow,
  AdminButton,
  CONTROL,
} from '../../components/admin/AdminUI.jsx'

/** Subscribers and contact messages — two lists on one screen, as in Laravel. */
export default function Contacts() {
  const [search, setSearch] = useState('')
  const [selectedSubs, setSelectedSubs] = useState([])
  const [selectedMsgs, setSelectedMsgs] = useState([])
  const [notice, setNotice] = useState(null)

  const { data, error, loading, refetch } = useApi(
    () => api.admin.contacts.list({ search: search || undefined }),
    [search],
  )

  if (loading && !data) return <Loading full />
  if (error) return <ErrorMessage error={error} onRetry={refetch} />

  const subscribers = data?.subscribers?.items ?? []
  const messages = data?.messages?.items ?? []

  const bulkSubscribers = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete ${selectedSubs.length} subscriber(s)?`)) return
    const result = await api.admin.contacts.bulkSubscribers(selectedSubs)
    setSelectedSubs([])
    refetch()
    setNotice(result?.message ?? 'Deleted.')
  }

  const bulkMessages = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete ${selectedMsgs.length} message(s)?`)) return
    const result = await api.admin.contacts.bulkMessages(selectedMsgs)
    setSelectedMsgs([])
    refetch()
    setNotice(result?.message ?? 'Deleted.')
  }

  const toggle = (list, setList, id) =>
    setList(list.includes(id) ? list.filter((v) => v !== id) : [...list, id])

  return (
    <AdminPage title="Contacts">
      {notice && (
        <Alert tone="info" className="mb-5">
          {notice}
        </Alert>
      )}

      <div className="relative mb-8 max-w-sm">
        <Search
          size={16}
          strokeWidth={1.5}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body"
        />
        <label htmlFor="contact-search" className="sr-only">
          Search contacts
        </label>
        <input
          id="contact-search"
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${CONTROL} w-full pl-9`}
        />
      </div>

      <AdminSection
        title={`Newsletter subscribers (${data?.subscribers?.pagination?.total ?? 0})`}
        actions={
          selectedSubs.length > 0 && (
            <AdminButton variant="danger" onClick={bulkSubscribers}>
              <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
              Delete {selectedSubs.length} selected
            </AdminButton>
          )
        }
      >
        <Table
          caption="Newsletter subscribers"
          head={
            <>
              <Th className="w-10">
                <span className="sr-only">Select</span>
              </Th>
              <Th>Email</Th>
              <Th>Subscribed</Th>
              <Th className="w-24 text-right">
                <span className="sr-only">Actions</span>
              </Th>
            </>
          }
        >
          {subscribers.map((sub) => (
            <tr key={sub.id}>
              <Td>
                <input
                  type="checkbox"
                  className="size-4 accent-brand"
                  checked={selectedSubs.includes(sub.id)}
                  onChange={() => toggle(selectedSubs, setSelectedSubs, sub.id)}
                  aria-label={`Select ${sub.email}`}
                />
              </Td>
              <Td className="break-all">{sub.email}</Td>
              <Td className="whitespace-nowrap">{formatDate(sub.createdAt)}</Td>
              <Td className="text-right">
                <AdminButton
                  variant="danger"
                  onClick={async () => {
                    await api.admin.contacts.deleteSubscriber(sub.id)
                    refetch()
                  }}
                >
                  <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                  Delete
                  <span className="sr-only"> subscriber {sub.email}</span>
                </AdminButton>
              </Td>
            </tr>
          ))}

          {subscribers.length === 0 && <EmptyRow colSpan={4}>No subscribers yet.</EmptyRow>}
        </Table>
      </AdminSection>

      <AdminSection
        title={`Messages (${data?.messages?.pagination?.total ?? 0})`}
        className="mt-10"
        actions={
          selectedMsgs.length > 0 && (
            <AdminButton variant="danger" onClick={bulkMessages}>
              <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
              Delete {selectedMsgs.length} selected
            </AdminButton>
          )
        }
      >
        <Table
          caption="Contact messages"
          head={
            <>
              <Th className="w-10">
                <span className="sr-only">Select</span>
              </Th>
              <Th>From</Th>
              <Th>Subject</Th>
              <Th>Message</Th>
              <Th>Received</Th>
              <Th className="w-24 text-right">
                <span className="sr-only">Actions</span>
              </Th>
            </>
          }
        >
          {messages.map((message) => (
            <tr key={message.id}>
              <Td>
                <input
                  type="checkbox"
                  className="size-4 accent-brand"
                  checked={selectedMsgs.includes(message.id)}
                  onChange={() => toggle(selectedMsgs, setSelectedMsgs, message.id)}
                  aria-label={`Select message from ${message.name}`}
                />
              </Td>
              <Td>
                {message.name}
                <span className="mt-0.5 block break-all text-[12px] text-body">
                  {message.email}
                </span>
              </Td>
              <Td>{message.subject ?? '—'}</Td>
              <Td className="max-w-[360px] whitespace-pre-line text-body">{message.message}</Td>
              <Td className="whitespace-nowrap">{formatDate(message.createdAt)}</Td>
              <Td className="text-right">
                <AdminButton
                  variant="danger"
                  onClick={async () => {
                    await api.admin.contacts.deleteMessage(message.id)
                    refetch()
                  }}
                >
                  <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                  Delete
                  <span className="sr-only"> message from {message.name}</span>
                </AdminButton>
              </Td>
            </tr>
          ))}

          {messages.length === 0 && <EmptyRow colSpan={6}>No messages yet.</EmptyRow>}
        </Table>
      </AdminSection>
    </AdminPage>
  )
}
