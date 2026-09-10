import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import { Card, Button, ConfirmDialog, Pagination } from '../../components/admin/AdminUI.jsx'
import { Toggle, FormGroup, FormActions, FORM_CONTROL } from '../../components/admin/AdminControls.jsx'
import { DataTable, DataTh, DataTd } from '../../components/admin/AdminTable.jsx'
import { formatDate } from '../../utils/admin-date.js'
import { usePageTitle } from '../../theme/page.js'
import { toast } from '../../store/toast.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/products/reviews.blade.php.
 *
 * The `.inline-form` + table pair, with the Comment field spanning the whole grid
 * (`grid-column: 1/-1`) so it sits on its own row under the three short fields.
 *
 * A review is toggled rather than approved: `is_active` decides whether it shows on the
 * product page, and the column reads "Active" / "Hidden" — not a moderation queue.
 */
export default function ProductReviews() {
  const { id } = useParams()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [rating, setRating] = useState('5')
  const [comment, setComment] = useState('')
  const [page, setPage] = useState(1)
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState({})

  const { data: productData } = useApi(() => api.admin.products.show(id), [id])
  const { data, loading, refetch } = useApi(() => api.admin.products.reviews(id, { page }), [id, page])

  const product = productData?.item
  usePageTitle('Product Reviews - Purple Panther')

  const items = data?.items ?? []
  const pagination = data?.pagination ?? { page: 1, lastPage: 1, total: 0, perPage: 10 }

  async function onAdd(event) {
    event.preventDefault()

    const next = {}
    if (!name.trim()) next.reviewer_name = 'Reviewer name is required.'
    if (!rating) next.rating = 'Please select a rating.'
    setErrors(next)
    if (Object.keys(next).length) {
      toast.error(Object.values(next)[0])
      return
    }

    setSaving(true)
    try {
      const res = await api.admin.products.addReview(id, {
        reviewer_name: name.trim(),
        // The column is nullable and the field is optional, so a blank stays null.
        reviewer_email: email.trim() || null,
        rating: Number(rating),
        comment,
      })
      toast.success(res.$message)
      setName('')
      setEmail('')
      setRating('5')
      setComment('')
      refetch()
    } catch (err) {
      if (err.errors) {
        setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])))
      }
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onToggle(reviewId) {
    try {
      toast.success((await api.admin.products.toggleReview(id, reviewId)).$message)
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function onDelete() {
    setBusy(true)
    try {
      toast.success((await api.admin.products.deleteReview(id, confirmId)).$message)
      setConfirmId(null)
      refetch()
    } catch (err) {
      toast.error(err.message)
      setConfirmId(null)
    } finally {
      setBusy(false)
    }
  }

  const limit = (value, max = 80) => {
    const text = String(value ?? '')
    return text.length > max ? `${text.slice(0, max)}...` : text
  }

  return (
    <>
      <div className="mb-[18px]">
        <Link
          to={`/admin/products/${id}/edit`}
          className="mb-1.5 inline-block text-[14px] font-semibold text-admin-primary hover:underline"
        >
          ← Back to Product
        </Link>
        <h2 className="text-[22px] font-bold text-[#333]">Reviews — {product?.title ?? ''}</h2>
      </div>

      <Card className="mb-[18px]">
        <h3 className="mb-3 text-[18px] font-bold text-[#333]">Add Review</h3>

        {/* `.inline-form` — auto-fit minmax(160px, 1fr); Comment spans every column */}
        <form
          onSubmit={onAdd}
          noValidate
          className="grid grid-cols-1 items-start gap-3 min-[576px]:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]"
        >
          <FormGroup label="Name" error={errors.reviewer_name}>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Reviewer name"
              className={`${FORM_CONTROL} ${errors.reviewer_name ? 'border-[#e53935]' : ''}`}
            />
          </FormGroup>

          <FormGroup label="Email" error={errors.reviewer_email}>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Optional email"
              className={FORM_CONTROL}
            />
          </FormGroup>

          <FormGroup label="Rating (1–5)" error={errors.rating}>
            {/* Counted DOWN from 5, so the default sits at the top of the list */}
            <select
              value={rating}
              onChange={(event) => setRating(event.target.value)}
              className={FORM_CONTROL}
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={String(value)}>{value} ★</option>
              ))}
            </select>
          </FormGroup>

          <div className="col-span-full flex min-w-0 flex-col">
            <label className="mb-1.5 block min-h-4 text-[13px] font-semibold leading-[1.2] text-[#666]">
              Comment
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Review comment"
              className="min-h-[100px] w-full resize-y rounded-md border border-[#ddd] bg-white px-3 py-[11px] text-[14px] outline-none transition-colors focus:border-admin-primary"
            />
          </div>

          <FormActions>
            <Button type="submit" className="h-[42px]" loading={saving} disabled={saving}>
              Add Review
            </Button>
          </FormActions>
        </form>
      </Card>

      <Card>
        <h3 className="mb-3 text-[18px] font-bold text-[#333]">
          All Reviews ({pagination.total})
        </h3>

        <DataTable caption="Reviews">
          <thead>
            <tr>
              <DataTh>#</DataTh>
              <DataTh>Reviewer</DataTh>
              <DataTh>Rating</DataTh>
              <DataTh>Comment</DataTh>
              <DataTh>Status</DataTh>
              <DataTh>Date</DataTh>
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
                  No reviews yet for this product.
                </td>
              </tr>
            ) : (
              items.map((review, index) => (
                <tr key={review.id}>
                  <DataTd>{(pagination.page - 1) * pagination.perPage + index + 1}</DataTd>
                  <DataTd>
                    <strong className="font-bold">{review.reviewerName}</strong>
                    {review.reviewerEmail ? (
                      <>
                        <br />
                        <small className="text-[12px] text-[#777]">{review.reviewerEmail}</small>
                      </>
                    ) : null}
                  </DataTd>
                  <DataTd className="whitespace-nowrap">{review.rating} ★</DataTd>
                  <DataTd className="max-w-[320px]" title={review.comment}>
                    {limit(review.comment)}
                  </DataTd>
                  <DataTd>{review.isActive ? 'Active' : 'Hidden'}</DataTd>
                  <DataTd className="whitespace-nowrap">{formatDate(review.createdAt)}</DataTd>
                  <DataTd>
                    {/* `.table-actions` — the switch and the delete circle side by side */}
                    <div className="flex items-center gap-2.5">
                      <Toggle
                        checked={Boolean(review.isActive)}
                        onChange={() => onToggle(review.id)}
                        title="Show / Hide"
                      />
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => setConfirmId(review.id)}
                        className="inline-flex size-[34px] items-center justify-center rounded-full bg-white text-admin-primary transition-colors hover:bg-[#fafafa]"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </DataTd>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>

        <div className="mt-4 flex justify-end">
          <Pagination
            page={pagination.page}
            lastPage={pagination.lastPage}
            total={pagination.total}
            perPage={pagination.perPage}
            onChange={setPage}
          />
        </div>
      </Card>

      <ConfirmDialog
        open={confirmId !== null}
        title="Delete this review?"
        onCancel={() => setConfirmId(null)}
        onProceed={onDelete}
        busy={busy}
      />
    </>
  )
}
