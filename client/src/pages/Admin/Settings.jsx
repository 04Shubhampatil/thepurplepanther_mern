import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import Loading from '../../components/common/Loading.jsx'

/**
 * Settings: shipping thresholds and the CMS pages.
 *
 * The shipping values drive live pricing — the free-shipping threshold is tested against
 * the post-discount subtotal at checkout — so the form makes clear what changing them
 * affects.
 */
export default function Settings() {
  const [notice, setNotice] = useState(null)
  const [activePage, setActivePage] = useState(null)

  const { data: shipping, loading: shippingLoading, refetch: refetchShipping } = useApi(
    () => api.admin.settings.shipping(),
    [],
  )
  const { data: pages, refetch: refetchPages } = useApi(() => api.admin.settings.pages(), [])

  const shippingForm = useForm()
  const pageForm = useForm()

  useEffect(() => {
    if (shipping?.settings) {
      shippingForm.reset({
        free_shipping_threshold: shipping.settings.freeShippingThreshold,
        flat_shipping_rate: shipping.settings.flatShippingRate,
      })
    }
  }, [shipping, shippingForm])

  const saveShipping = async (values) => {
    setNotice(null)
    try {
      await api.admin.settings.updateShipping(values)
      await refetchShipping()
      setNotice('Shipping settings updated. This affects live checkout immediately.')
    } catch (error) {
      setNotice(error.message)
    }
  }

  const editPage = (page) => {
    setActivePage(page.slug)
    pageForm.reset({ title: page.title ?? '', content: page.content ?? '' })
  }

  const savePage = async (values) => {
    setNotice(null)
    try {
      await api.admin.settings.updatePage(activePage, values)
      await refetchPages()
      setActivePage(null)
      setNotice('Page saved successfully.')
    } catch (error) {
      setNotice(error.message)
    }
  }

  if (shippingLoading) return <Loading full />

  return (
    <div>
      <h1 style={{ fontSize: 24 }}>Settings</h1>

      {notice && (
        <div className="alert alert-info" role="status">
          {notice}
        </div>
      )}

      <section style={{ border: '1px solid #eee', padding: 20, marginTop: 20, maxWidth: 520 }}>
        <h2 style={{ fontSize: 18 }}>Shipping</h2>
        <p style={{ fontSize: 13, opacity: 0.75 }}>
          The free-shipping threshold is tested against the cart total <strong>after</strong> any
          discount, so a coupon can push an order back into paid delivery.
        </p>

        <form onSubmit={shippingForm.handleSubmit(saveShipping)} noValidate>
          <div className="form-group">
            <label htmlFor="st-threshold">Free shipping above (₹)</label>
            <input
              id="st-threshold"
              type="number"
              step="0.01"
              min="0"
              className="form-control"
              {...shippingForm.register('free_shipping_threshold', { required: true })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="st-rate">Flat delivery rate (₹)</label>
            <input
              id="st-rate"
              type="number"
              step="0.01"
              min="0"
              className="form-control"
              {...shippingForm.register('flat_shipping_rate', { required: true })}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={shippingForm.formState.isSubmitting}>
            Save shipping settings
          </button>
        </form>
      </section>

      <section style={{ border: '1px solid #eee', padding: 20, marginTop: 20 }}>
        <h2 style={{ fontSize: 18 }}>Content pages</h2>

        {/* These are editable but the storefront does not currently render them — see
            audit R11. Flagged so the content is not assumed to be live. */}
        <p style={{ fontSize: 13, opacity: 0.75 }}>
          Note: these pages are stored but are not yet displayed on the storefront, which shows
          its own customer-care content. Wiring them up is a pending product decision.
        </p>

        <ul style={{ listStyle: 'none', padding: 0 }}>
          {(pages?.pages ?? []).map((page) => (
            <li key={page.slug} style={{ padding: '8px 0', borderBottom: '1px solid #f2f2f2' }}>
              <strong>{page.title}</strong>
              {page.missing && <em style={{ opacity: 0.6 }}> — not created yet</em>}
              <button type="button" onClick={() => editPage(page)} style={{ marginLeft: 12 }}>
                Edit
              </button>
            </li>
          ))}
        </ul>

        {activePage && (
          <form onSubmit={pageForm.handleSubmit(savePage)} style={{ marginTop: 16 }} noValidate>
            <h3 style={{ fontSize: 16 }}>Editing: {activePage}</h3>

            <div className="form-group">
              <label htmlFor="pg-title">Title</label>
              <input id="pg-title" className="form-control" {...pageForm.register('title')} />
            </div>

            <div className="form-group">
              <label htmlFor="pg-content">Content (HTML)</label>
              <textarea
                id="pg-content"
                rows="12"
                className="form-control"
                {...pageForm.register('content')}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={pageForm.formState.isSubmitting}>
                Save page
              </button>
              <button type="button" className="btn btn-link" onClick={() => setActivePage(null)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
