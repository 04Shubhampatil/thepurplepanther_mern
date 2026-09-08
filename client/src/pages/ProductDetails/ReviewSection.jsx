import { useState } from 'react'
import { useAuthStore } from '../../store/index.js'
import * as api from '../../services/endpoints.js'

/**
 * frontend/partials/product-reviews.blade.php, with product-review.js's client validation.
 *
 * Reviews are open to guests — name and email, no account — which is the original's rule
 * and the reason the form carries its own name/email fields rather than reading the
 * session. A signed-in customer gets them pre-filled, as Blade did with `old(...)`.
 *
 * The star row is five buttons over a hidden input, not a radio group: the theme styles
 * `.review-star-btn`, and the opacity split is how "3 of 5" reads.
 */
const STARS = [1, 2, 3, 4, 5]

export default function ReviewSection({ product, slug, onSubmitted }) {
  const user = useAuthStore((s) => s.user)

  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [alert, setAlert] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reviews = product.reviews?.items ?? []
  const reviewCount = product.reviews?.count ?? 0
  const average = product.reviews?.average ?? 0
  const breakdown = product.reviews?.breakdown ?? {}

  async function onSubmit(event) {
    event.preventDefault()
    setAlert('')
    setSuccess('')

    if (comment.trim().length < 10) {
      setAlert('Please write at least 10 characters.')
      return
    }
    if (!name.trim() || !email.trim()) {
      setAlert('Name and email are required.')
      return
    }

    setSubmitting(true)
    try {
      const response = await api.catalog.submitReview(slug, {
        rating,
        comment: comment.trim(),
        reviewer_name: name.trim(),
        reviewer_email: email.trim(),
      })
      setSuccess(response?.message ?? 'Thank you for your review.')
      setComment('')
      onSubmitted?.()
    } catch (error) {
      setAlert(error.message || 'Could not submit your review.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="shop-review-area pt90 pb-0 gap-60" id="reviews">
      <div className="container">
        <div className="shop-title mb50 style13 text-center">
          <h2 className="title">REVIEWS</h2>
        </div>

        {success && <div className="alert alert-success text-center mb30">{success}</div>}

        <div className="review-info">
          <div className="row g-4 bb1 pb40">
            <div className="col-xl-4 col-lg-6">
              <div className="review-info-box">
                <div className="rating-progress">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const data = breakdown[star] ?? { percent: 0, count: 0 }
                    return (
                      <div className="progress-item d-flex align-items-center" key={star}>
                        <h4 className="star flex-shrink-0">{star} Star</h4>
                        <div
                          className="progress flex-grow-1"
                          role="progressbar"
                          aria-valuenow={data.percent}
                          aria-valuemin="0"
                          aria-valuemax="100"
                        >
                          <div className="progress-bar" style={{ width: `${data.percent}%` }}></div>
                        </div>
                        <span className="num flex-shrink-0">{data.count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="col-xl-4 col-lg-6"></div>
            <div className="col-xl-4 col-lg-6">
              <div className="review-info-box">
                <h4 className="review-number mb10 d-flex align-items-center">
                  <strong>{reviewCount ? average.toFixed(1) : '0.0'}</strong>
                  out of 5 stars
                  <span className="ms-2 text-muted fz14">({reviewCount})</span>
                </h4>
                <a className="su-btn-4 btn-black-border w-100 text-center su-left-right" href="#write-review">
                  <span className="mr10 su-text d-inline-block">WRITE A REVIEW</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="review-list-wrapper pt50">
          <div className="review-list-main">
            {reviews.length === 0 ? (
              <div className="text-center py-4">
                <p className="mb-0">No reviews yet. Be the first to review this product.</p>
              </div>
            ) : (
              reviews.map((review) => (
                <div className="review-list-item d-xl-flex align-items-start mb40" key={review.id}>
                  <div className="left-content flex-shrink-0 me-xl-4 mb20 mb-xl-0">
                    <div className="rating mb10">
                      <ul className="list-unstyled d-flex align-items-center gap-2 mb-0">
                        {STARS.map((star) => (
                          <li style={{ opacity: star <= review.rating ? 1 : 0.25 }} key={star}>★</li>
                        ))}
                      </ul>
                    </div>
                    <h5 className="mb5">{review.reviewerName}</h5>
                    <p className="mb-0 text-muted">
                      {review.createdAt
                        ? new Date(review.createdAt).toLocaleDateString('en-US', {
                            month: 'long',
                            day: '2-digit',
                            year: 'numeric',
                          })
                        : ''}
                    </p>
                  </div>
                  <div className="right-content flex-grow-1">
                    <p className="mb-0">{review.comment}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="submit-review-box shop-s9 mt60" id="write-review">
          <div className="text-center">
            <h3 className="title mb20">
              {reviewCount
                ? 'WRITE A REVIEW'
                : `BE THE FIRST TO REVIEW “${product.title.toUpperCase()}”`}
            </h3>
            <p className="text mb15">
              Login is optional. Guests can review with name and email. Required fields are marked *
            </p>
          </div>

          <form id="product-review-form" noValidate onSubmit={onSubmit}>
            <div
              id="review-form-alert"
              className={`alert alert-danger text-center mb20${alert ? '' : ' d-none'}`}
              role="alert"
              hidden={!alert}
              aria-live="assertive"
            >
              {alert}
            </div>

            <p className="rate-text mb-2">Overall rating*</p>
            <div className="rating mb20" id="review-star-picker">
              <input type="hidden" name="rating" id="review-rating" value={rating} readOnly />
              <ul className="list-unstyled d-flex align-items-center gap-3 mb-0" role="listbox" aria-label="Rating">
                {STARS.map((star) => (
                  <li key={star}>
                    <button
                      type="button"
                      className="review-star-btn border-0 bg-transparent p-0"
                      data-rating={star}
                      aria-label={`${star} stars`}
                      style={{
                        fontSize: '22px',
                        lineHeight: 1,
                        color: '#1d1d1d',
                        cursor: 'pointer',
                        opacity: star <= rating ? 1 : 0.25,
                      }}
                      onClick={() => setRating(star)}
                    >
                      ★
                    </button>
                  </li>
                ))}
              </ul>
              <div className="field-error text-danger mt1" id="rating-error" aria-live="polite"></div>
            </div>

            <div className="review-box mt30">
              <div className="row g-4">
                <div className="col-lg-12">
                  <div className="form-floating form-group">
                    <textarea
                      name="comment"
                      className="form-control textarea shadow-none"
                      placeholder="Your Review*"
                      id="review-comment"
                      required
                      minLength="10"
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                    />
                    <label htmlFor="review-comment">Review *</label>
                    <div className="field-error text-danger" aria-live="polite"></div>
                  </div>
                </div>
                <div className="col-lg-6">
                  <div className="form-floating form-group">
                    <input
                      type="text"
                      name="reviewer_name"
                      id="reviewer-name"
                      className="form-control shadow-none"
                      placeholder="Name*"
                      required
                      maxLength="255"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                    <label htmlFor="reviewer-name">Name *</label>
                    <div className="field-error text-danger" aria-live="polite"></div>
                  </div>
                </div>
                <div className="col-lg-6">
                  <div className="form-floating form-group">
                    <input
                      type="email"
                      name="reviewer_email"
                      id="reviewer-email"
                      className="form-control shadow-none"
                      placeholder="Email*"
                      required
                      maxLength="255"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                    <label htmlFor="reviewer-email">Email *</label>
                    <div className="field-error text-danger" aria-live="polite"></div>
                  </div>
                </div>
                <div className="col-lg-12">
                  <button type="submit" className="su-btn-4 su-btn-16-black w-100 su-left-right" disabled={submitting}>
                    <span className="mr10 su-text d-inline-block">WRITE A REVIEW</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
