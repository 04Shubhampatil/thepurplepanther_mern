import { useEffect, useState } from 'react'
import { useApi } from '../../hooks/useApi.js'
import { Button } from '../../components/admin/AdminUI.jsx'
import { FORM_CONTROL } from '../../components/admin/AdminControls.jsx'
import { usePageTitle } from '../../theme/page.js'
import { toast } from '../../store/toast.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/settings/shipping.blade.php.
 *
 * The same `.page-settings-card` shell as Page Settings but with no tab strip — two fields
 * and a note.
 *
 * These two numbers drive LIVE PRICING. The threshold is compared against the product
 * subtotal at checkout, so an accidental 0 makes every order ship free; the note under the
 * fields says which subtotal it is measured against, and it is repeated from the Blade
 * rather than paraphrased.
 */
export default function ShippingSettings() {
  usePageTitle('Shipping Settings - Purple Panther')

  const [threshold, setThreshold] = useState('')
  const [rate, setRate] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const { data, refetch } = useApi(() => api.admin.settings.shipping(), [])

  useEffect(() => {
    const settings = data?.settings
    if (!settings) return

    setThreshold(String(settings.freeShippingThreshold ?? ''))
    setRate(String(settings.flatShippingRate ?? ''))
  }, [data])

  async function onSubmit(event) {
    event.preventDefault()

    const next = {}
    if (threshold === '' || Number(threshold) < 0) {
      next.free_shipping_threshold = 'Enter a valid amount.'
    }
    if (rate === '' || Number(rate) < 0) next.flat_shipping_rate = 'Enter a valid amount.'

    setErrors(next)
    if (Object.keys(next).length) {
      toast.error(Object.values(next)[0])
      return
    }

    setSaving(true)
    try {
      const res = await api.admin.settings.updateShipping({
        free_shipping_threshold: Number(threshold),
        flat_shipping_rate: Number(rate),
      })
      toast.success(res.$message)
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

  /** `.offer-form-row` */
  const Row = ({ label, htmlFor, children }) => (
    <div className="grid grid-cols-1 gap-2 border-b border-[#f0f0f0] py-3.5 min-[768px]:grid-cols-[220px_1fr] min-[768px]:items-center min-[768px]:gap-4">
      <label htmlFor={htmlFor} className="text-[14px] font-semibold text-[#555]">
        {label}
        <span className="ml-0.5 text-[#e53935]">*</span> <span className="text-[#888]">:-</span>
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  )

  return (
    <div className="overflow-hidden rounded-[10px] bg-white shadow-admin-card">
      <div className="px-5 pb-2 pt-[18px]">
        <h2 className="text-[20px] font-semibold text-[#444]">Shipping Settings</h2>
        <p className="mt-1 text-[13px] text-[#888]">
          Set the free-delivery minimum and flat delivery charge.
        </p>
      </div>

      <form onSubmit={onSubmit} className="px-[22px] pb-[22px] pt-2">
        <Row label="Free Shipping Above (₹)" htmlFor="free_shipping_threshold">
          <input
            id="free_shipping_threshold"
            type="number"
            min="0"
            step="0.01"
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
            className={`${FORM_CONTROL} ${errors.free_shipping_threshold ? 'border-[#e53935]' : ''}`}
          />
          {errors.free_shipping_threshold ? (
            <p className="mt-1 text-[12px] text-[#e53935]">{errors.free_shipping_threshold}</p>
          ) : null}
        </Row>

        <Row label="Shipping Charge Below Minimum (₹)" htmlFor="flat_shipping_rate">
          <input
            id="flat_shipping_rate"
            type="number"
            min="0"
            step="0.01"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
            className={`${FORM_CONTROL} ${errors.flat_shipping_rate ? 'border-[#e53935]' : ''}`}
          />
          {errors.flat_shipping_rate ? (
            <p className="mt-1 text-[12px] text-[#e53935]">{errors.flat_shipping_rate}</p>
          ) : null}
        </Row>

        {/* `.page-settings-sub` again, below the fields — it names the figure compared */}
        <p className="mt-4 text-[13px] text-[#888]">
          Customers receive free shipping when their product subtotal is equal to or greater
          than this amount.
        </p>

        <div className="pt-[18px]">
          <Button type="submit" loading={saving} disabled={saving}>Save Shipping Settings</Button>
        </div>
      </form>
    </div>
  )
}
