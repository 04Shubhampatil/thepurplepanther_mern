import { useState } from 'react'
import { useForm } from 'react-hook-form'
import * as api from '../../services/endpoints.js'
import { useAuthStore } from '../../store/index.js'
import Rating from '../../components/product/Rating.jsx'
import Button from '../../components/ui/Button.jsx'
import Alert from '../../components/ui/Alert.jsx'
import { Field, Input, Textarea, Select } from '../../components/ui/Field.jsx'

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
      reset({
        rating: 5,
        comment: '',
        reviewer_name: values.reviewer_name,
        reviewer_email: values.reviewer_email,
      })
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
    <section id="write-review" className="border-t border-line pt-12 md:pt-16">
      <h2 className="pp-heading">Reviews</h2>

      <div className="mt-8 grid gap-10 md:grid-cols-[280px_1fr] md:gap-14">
        <div className="h-fit border border-line p-6">
          <p className="text-[40px] font-semibold leading-none text-ink">{reviews.average || 0}</p>
          <Rating value={reviews.average || 0} size={17} className="mt-2" />
          <p className="mt-1 text-[13px] text-body">
            {reviews.count} review{reviews.count === 1 ? '' : 's'}
          </p>

          <ul className="mt-5 space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const percent = reviews.breakdown?.[star]?.percent ?? 0
              const count = reviews.breakdown?.[star]?.count ?? 0

              return (
                <li key={star} className="flex items-center gap-3 text-[13px] text-body">
                  <span className="w-12 shrink-0">{star} star</span>
                  <span className="h-1.5 flex-1 bg-line">
                    <span
                      className="block h-full bg-brand"
                      style={{ width: `${percent}%` }}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="w-6 shrink-0 text-right">{count}</span>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="min-w-0">
          {reviews.items?.length > 0 ? (
            <ul>
              {reviews.items.map((review) => (
                <li key={review.id} className="border-b border-line py-5 first:pt-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <Rating value={review.rating} />
                    <span className="text-[14px] font-semibold text-ink">
                      {review.reviewerName}
                    </span>
                  </div>
                  {review.comment && <p className="mt-2 text-body">{review.comment}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body">No reviews yet. Be the first to write one.</p>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-10 max-w-xl">
            <h3 className="pp-eyebrow text-ink">Write a review</h3>

            <div className="mt-5 space-y-5">
              <Field label="Rating" htmlFor="review-rating">
                <Select id="review-rating" {...register('rating', { valueAsNumber: true })}>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} star{n === 1 ? '' : 's'}
                    </option>
                  ))}
                </Select>
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Your name"
                  htmlFor="review-name"
                  required
                  error={errors.reviewer_name?.message}
                >
                  <Input
                    id="review-name"
                    autoComplete="name"
                    error={errors.reviewer_name}
                    {...register('reviewer_name', { required: 'Please enter your name.' })}
                  />
                </Field>

                <Field
                  label="Your email"
                  htmlFor="review-email"
                  required
                  error={errors.reviewer_email?.message}
                >
                  <Input
                    id="review-email"
                    type="email"
                    autoComplete="email"
                    error={errors.reviewer_email}
                    {...register('reviewer_email', {
                      required: 'Please enter a valid email address.',
                    })}
                  />
                </Field>
              </div>

              <Field
                label="Your review"
                htmlFor="review-comment"
                required
                error={errors.comment?.message}
              >
                <Textarea
                  id="review-comment"
                  rows={4}
                  error={errors.comment}
                  {...register('comment', {
                    required: 'Please write a review.',
                    minLength: { value: 10, message: 'Please write at least 10 characters.' },
                  })}
                />
              </Field>

              {status && <Alert tone={status.ok ? 'success' : 'error'}>{status.message}</Alert>}

              <Button type="submit" size="sm" loading={isSubmitting}>
                {isSubmitting ? 'Submitting…' : 'Submit review'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
