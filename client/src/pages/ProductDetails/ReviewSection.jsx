import { useState } from 'react'
import { useForm } from 'react-hook-form'
import * as api from '../../services/endpoints.js'
import { useAuthStore } from '../../store/index.js'

/** Star rating display. */
function Stars({ rating }) {
  return (
    <span aria-label={`${rating} out of 5`} style={{ color: '#e0a800' }}>
      {'★'.repeat(Math.round(rating))}
      {'☆'.repeat(5 - Math.round(rating))}
    </span>
  )
}

/**
 * Reviews and the submission form.
 *
 * Guests may review, matching Laravel — a purchase is not required. The server links a
 * guest review to a matching customer account by email, so a signed-in customer's details
 * are pre-filled but never trusted from the client.
 */
export default function ReviewSection({ product, slug, onSubmitted }) {
  const user = useAuthStore((s) => s.user)
  const [status, setStatus] = useState(null)
  const reviews = product.reviews ?? { count: 0, average: 0, breakdown: {}, items: [] }

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      rating: 5,
      comment: '',
      reviewer_name: user ? `${user.firstName} ${user.lastName}`.trim() : '',
      reviewer_email: user?.email ?? '',
    },
  })

  const onSubmit = async (values) => {
    setStatus(null)
    try {
      await api.catalog.submitReview(slug, values)
      setStatus({ ok: true, message: 'Thank you! Your review has been submitted.' })
      reset({ rating: 5, comment: '', reviewer_name: values.reviewer_name, reviewer_email: values.reviewer_email })
      onSubmitted?.()
    } catch (error) {
      // Surface per-field messages from the server rather than a single banner.
      if (error.errors) {
        Object.entries(error.errors).forEach(([field, messages]) => {
          setError(field, { type: 'server', message: messages[0] })
        })
      }
      setStatus({ ok: false, message: error.message })
    }
  }

  return (
    <section className="pp-section pp-reviews" id="write-review">
      <h2>Reviews</h2>

      <div className="row">
        <div className="col-md-4">
          <div className="pp-reviews__summary">
            <p style={{ fontSize: 40, margin: 0 }}>{reviews.average || 0}</p>
            <Stars rating={reviews.average || 0} />
            <p style={{ opacity: 0.7 }}>
              {reviews.count} review{reviews.count === 1 ? '' : 's'}
            </p>

            {[5, 4, 3, 2, 1].map((star) => (
              <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 42 }}>{star} star</span>
                <div style={{ flex: 1, height: 8, background: '#eee' }}>
                  <div
                    style={{
                      width: `${reviews.breakdown?.[star]?.percent ?? 0}%`,
                      height: '100%',
                      background: '#3a1651',
                    }}
                  />
                </div>
                <span style={{ width: 28, textAlign: 'right' }}>
                  {reviews.breakdown?.[star]?.count ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="col-md-8">
          {reviews.items?.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {reviews.items.map((review) => (
                <li key={review.id} style={{ padding: '16px 0', borderBottom: '1px solid #eee' }}>
                  <Stars rating={review.rating} />
                  <strong style={{ marginLeft: 10 }}>{review.reviewerName}</strong>
                  {review.comment && <p style={{ marginTop: 6 }}>{review.comment}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ opacity: 0.7 }}>No reviews yet. Be the first to write one.</p>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ marginTop: 24 }}>
            <h3>Write a review</h3>

            <div className="form-group">
              <label htmlFor="review-rating">Rating</label>
              <select
                id="review-rating"
                className="form-control"
                {...register('rating', { valueAsNumber: true })}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} star{n === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="review-name">Your name</label>
              <input
                id="review-name"
                className="form-control"
                {...register('reviewer_name', { required: 'Please enter your name.' })}
                aria-invalid={Boolean(errors.reviewer_name)}
              />
              {errors.reviewer_name && (
                <p style={{ color: '#b00' }}>{errors.reviewer_name.message}</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="review-email">Your email</label>
              <input
                id="review-email"
                type="email"
                className="form-control"
                {...register('reviewer_email', { required: 'Please enter a valid email address.' })}
                aria-invalid={Boolean(errors.reviewer_email)}
              />
              {errors.reviewer_email && (
                <p style={{ color: '#b00' }}>{errors.reviewer_email.message}</p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="review-comment">Your review</label>
              <textarea
                id="review-comment"
                rows="4"
                className="form-control"
                {...register('comment', {
                  required: 'Please write a review.',
                  minLength: { value: 10, message: 'Please write at least 10 characters.' },
                })}
                aria-invalid={Boolean(errors.comment)}
              />
              {errors.comment && <p style={{ color: '#b00' }}>{errors.comment.message}</p>}
            </div>

            {status && (
              <p role="status" style={{ color: status.ok ? '#146c43' : '#b00' }}>
                {status.message}
              </p>
            )}

            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting…' : 'Submit review'}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
