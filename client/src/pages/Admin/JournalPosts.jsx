import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import { Card, Button, Table, Th, Td, ConfirmDialog, Alert, Pagination } from '../../components/admin/AdminUI.jsx'
import { AdminSearch, AddNewButton, Toggle } from '../../components/admin/AdminControls.jsx'
import { storageUrl } from '../../utils/admin-media.js'
import { formatDate } from '../../utils/admin-date.js'
import { usePageTitle } from '../../theme/page.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/blog-posts/index.blade.php.
 *
 * Search and Add Post in the page head, a `.product-filters` card holding only the news-type
 * dropdown, then the table. The Type filter is its own card and its own GET form in the
 * Blade — it is not part of the search box — which is why it sits on a separate white strip
 * rather than beside the search field.
 *
 * `image_url` is a Laravel ACCESSOR that falls back to a placeholder; the admin API returns
 * the raw `image` column, so the fallback belongs here.
 */
const FALLBACK_IMAGE = '/frontend/images/blogs/blog-1.jpg'

export default function JournalPosts() {
  usePageTitle('Journal Posts - Purple Panther')

  const [search, setSearch] = useState('')
  const [typeId, setTypeId] = useState('')
  const [page, setPage] = useState(1)
  const [confirmId, setConfirmId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const { data, loading, refetch } = useApi(
    () => api.admin.blogPosts.list({ search, news_type_id: typeId || undefined, page }),
    [search, typeId, page],
  )
  const { data: typeData } = useApi(() => api.admin.newsTypes.list({ per_page: 100 }), [])

  const posts = data?.items ?? []
  const pagination = data?.pagination ?? { page: 1, lastPage: 1, total: 0, perPage: 25 }
  const newsTypes = typeData?.items ?? []

  async function onToggle(id, featured) {
    setError('')
    try {
      if (featured) await api.admin.blogPosts.toggleFeatured(id)
      else await api.admin.blogPosts.toggle(id)
      refetch()
    } catch (err) {
      setError(err.message)
    }
  }

  async function onDelete() {
    setBusy(true)
    try {
      await api.admin.blogPosts.remove(confirmId)
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
        <h2 className="text-[26px] font-bold text-[#333]">Journal Posts</h2>
        <div className="flex flex-wrap items-center gap-2.5 max-sm:w-full">
          <AdminSearch
            value={search}
            onChange={(v) => { setSearch(v); setPage(1) }}
            placeholder="Search posts..."
          />
          <AddNewButton to="/admin/blog-posts/create">Add Post</AddNewButton>
        </div>
      </div>

      <Alert onDismiss={() => setError('')}>{error}</Alert>

      {/* `.product-filters` — a 38px select at 4px radius with its own caret, not 42px */}
      <Card className="mb-4">
        <div className="flex flex-wrap gap-3.5">
          <select
            value={typeId}
            onChange={(event) => { setTypeId(event.target.value); setPage(1) }}
            className="h-[38px] min-w-[170px] rounded border border-[#ddd] bg-white pl-3 pr-7 text-[13px] text-[#555] outline-none max-sm:w-full max-sm:min-w-0"
          >
            <option value="">---All News Types---</option>
            {newsTypes.map((type) => (
              <option key={type.id} value={String(type.id)}>{type.title}</option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="p-0">
        <Table>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Image</Th>
              <Th>Title</Th>
              <Th>Type</Th>
              <Th>Featured</Th>
              <Th>Status</Th>
              <Th>Published</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td colSpan={8} className="py-6 text-center text-admin-muted">Loading…</Td>
              </tr>
            ) : posts.length === 0 ? (
              <tr>
                <Td colSpan={8}>
                  <div className="p-6 text-center text-[#888]">No journal posts found.</div>
                </Td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id}>
                  <Td>{String(post.id)}</Td>
                  <Td>
                    <img
                      src={storageUrl(post.image, FALLBACK_IMAGE)}
                      alt=""
                      className="size-14 rounded-md object-cover"
                    />
                  </Td>
                  <Td>
                    <strong className="font-bold">{post.title}</strong>
                    <br />
                    <small className="text-[13px] text-[#777]">{post.slug}</small>
                  </Td>
                  <Td>{post.newsType?.title ?? '—'}</Td>
                  <Td>
                    <Toggle
                      checked={Boolean(post.isFeatured)}
                      onChange={() => onToggle(post.id, true)}
                    />
                  </Td>
                  <Td>
                    <Toggle
                      checked={Boolean(post.isActive)}
                      onChange={() => onToggle(post.id, false)}
                    />
                  </Td>
                  <Td>{formatDate(post.publishedAt)}</Td>
                  <Td className="whitespace-nowrap">
                    <Link
                      to={`/admin/blog-posts/${post.id}/edit`}
                      className="mr-1.5 inline-flex items-center justify-center rounded-md border border-[#ddd] bg-white px-[10px] py-1.5 text-[12px] font-semibold text-[#555] transition-colors hover:bg-[#f7f7f7]"
                    >
                      Edit
                    </Link>
                    <Button size="sm" variant="light" onClick={() => setConfirmId(post.id)}>Delete</Button>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
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
        title="Delete this post?"
        onCancel={() => setConfirmId(null)}
        onProceed={onDelete}
        busy={busy}
      />
    </>
  )
}
