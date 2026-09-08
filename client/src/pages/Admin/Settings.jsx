import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Pencil } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import Loading from '../../components/common/Loading.jsx'
import Alert from '../../components/ui/Alert.jsx'
import Button from '../../components/ui/Button.jsx'
import { Field, Input, Textarea } from '../../components/ui/Field.jsx'
import { AdminPage, AdminButton } from '../../components/admin/AdminUI.jsx'

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

  const {
    data: shipping,
    loading: shippingLoading,
    refetch: refetchShipping,
  } = useApi(() => api.admin.settings.shipping(), [])
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
    <AdminPage title="Settings">
      {notice && (
        <Alert tone="info" className="mb-6">
          {notice}
        </Alert>
      )}

      <section className="max-w-[520px] border border-line p-6">
        <h2 className="text-[17px] font-semibold text-ink">Shipping</h2>
        <p className="mt-1 text-[13px] text-body">
          The free-shipping threshold is tested against the cart total{' '}
          <strong className="font-semibold text-ink">after</strong> any discount, so a coupon can
          push an order back into paid delivery.
        </p>

        <form
          onSubmit={shippingForm.handleSubmit(saveShipping)}
          noValidate
          className="mt-5 space-y-5"
        >
          <Field label="Free shipping above (₹)" htmlFor="st-threshold" required>
            <Input
              id="st-threshold"
              type="number"
              step="0.01"
              min="0"
              {...shippingForm.register('free_shipping_threshold', { required: true })}
            />
          </Field>

          <Field label="Flat delivery rate (₹)" htmlFor="st-rate" required>
            <Input
              id="st-rate"
              type="number"
              step="0.01"
              min="0"
              {...shippingForm.register('flat_shipping_rate', { required: true })}
            />
          </Field>

          <Button type="submit" size="sm" loading={shippingForm.formState.isSubmitting}>
            Save shipping settings
          </Button>
        </form>
      </section>

      <section className="mt-8 border border-line p-6">
        <h2 className="text-[17px] font-semibold text-ink">Content pages</h2>

        {/* These are editable but the storefront does not currently render them — see
            audit R11. Flagged so the content is not assumed to be live. */}
        <p className="mt-1 max-w-2xl text-[13px] text-body">
          Note: these pages are stored but are not yet displayed on the storefront, which shows
          its own customer-care content. Wiring them up is a pending product decision.
        </p>

        <ul className="mt-5 max-w-2xl">
          {(pages?.pages ?? []).map((page) => (
            <li
              key={page.slug}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 first:border-t"
            >
              <span className="text-[14px] text-ink">
                {page.title}
                {page.missing && <em className="ml-2 text-body">— not created yet</em>}
              </span>

              <AdminButton onClick={() => editPage(page)}>
                <Pencil size={14} strokeWidth={1.5} aria-hidden="true" />
                Edit
                <span className="sr-only"> {page.title}</span>
              </AdminButton>
            </li>
          ))}
        </ul>

        {activePage && (
          <form
            onSubmit={pageForm.handleSubmit(savePage)}
            noValidate
            className="mt-6 max-w-2xl border border-line p-5"
          >
            <h3 className="text-[15px] font-semibold text-ink">Editing: {activePage}</h3>

            <div className="mt-4 space-y-5">
              <Field label="Title" htmlFor="pg-title">
                <Input id="pg-title" {...pageForm.register('title')} />
              </Field>

              <Field
                label="Content (HTML)"
                htmlFor="pg-content"
                hint="Rendered as HTML on the storefront."
              >
                <Textarea
                  id="pg-content"
                  rows={12}
                  className="font-mono text-[13px]"
                  {...pageForm.register('content')}
                />
              </Field>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button type="submit" size="sm" loading={pageForm.formState.isSubmitting}>
                Save page
              </Button>
              <button
                type="button"
                onClick={() => setActivePage(null)}
                className="text-[13px] text-body underline underline-offset-2 transition-colors hover:text-brand"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>
    </AdminPage>
  )
}
