import { useState } from 'react'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import Loading from '../../components/common/Loading.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import { formatDate } from '../../utils/format.js'

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
    <div>
      <h1 style={{ fontSize: 24 }}>Contacts</h1>

      {notice && (
        <div className="alert alert-info" role="status">
          {notice}
        </div>
      )}

      <input
        className="form-control"
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ maxWidth: 320, margin: '16px 0' }}
        aria-label="Search contacts"
      />

      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18 }}>
            Newsletter subscribers ({data?.subscribers?.pagination?.total ?? 0})
          </h2>
          {selectedSubs.length > 0 && (
            <button type="button" onClick={bulkSubscribers}>
              Delete {selectedSubs.length} selected
            </button>
          )}
        </div>

        <table className="table">
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Select</span></th>
              <th scope="col">Email</th>
              <th scope="col">Subscribed</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((sub) => (
              <tr key={sub.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedSubs.includes(sub.id)}
                    onChange={() => toggle(selectedSubs, setSelectedSubs, sub.id)}
                    aria-label={`Select ${sub.email}`}
                  />
                </td>
                <td>{sub.email}</td>
                <td>{formatDate(sub.createdAt)}</td>
                <td>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.admin.contacts.deleteSubscriber(sub.id)
                      refetch()
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}

            {subscribers.length === 0 && (
              <tr>
                <td colSpan="4" style={{ opacity: 0.6 }}>No subscribers yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18 }}>
            Messages ({data?.messages?.pagination?.total ?? 0})
          </h2>
          {selectedMsgs.length > 0 && (
            <button type="button" onClick={bulkMessages}>
              Delete {selectedMsgs.length} selected
            </button>
          )}
        </div>

        <table className="table">
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Select</span></th>
              <th scope="col">From</th>
              <th scope="col">Subject</th>
              <th scope="col">Message</th>
              <th scope="col">Received</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {messages.map((message) => (
              <tr key={message.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedMsgs.includes(message.id)}
                    onChange={() => toggle(selectedMsgs, setSelectedMsgs, message.id)}
                    aria-label={`Select message from ${message.name}`}
                  />
                </td>
                <td>
                  {message.name}
                  <br />
                  <small style={{ opacity: 0.7 }}>{message.email}</small>
                </td>
                <td>{message.subject ?? '—'}</td>
                <td style={{ maxWidth: 360 }}>{message.message}</td>
                <td>{formatDate(message.createdAt)}</td>
                <td>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.admin.contacts.deleteMessage(message.id)
                      refetch()
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}

            {messages.length === 0 && (
              <tr>
                <td colSpan="6" style={{ opacity: 0.6 }}>No messages yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
