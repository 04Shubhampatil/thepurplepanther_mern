import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pencil } from 'lucide-react'
import { Button } from './AdminUI.jsx'
import { FORM_CONTROL } from './AdminControls.jsx'
import { formatDateDMY } from '../../utils/admin-date.js'
import { toast } from '../../store/toast.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/orders/_status-modal.blade.php + the half of public/js/order-admin.js that fills it.
 *
 * `.order-status-modal` — a fixed 560px panel, NOT the site's `Modal`: it has its own head
 * rule, its own body padding and its own shadow, and the delivery-date row sits above the
 * timeline rather than inside the form.
 *
 * ONE ACTION SAVES EVERYTHING THAT WAS FILLED IN. Laravel wired the two halves to separate
 * buttons — a green "Update" under the delivery date, a "Save" under the status — and the
 * live logs show exactly what that produced: an admin chose a status, pressed the green
 * "Update" in a dialog titled "Update Order Status", and only the date was written. Three
 * times in a row, with no status change ever submitted. Either button now applies the
 * delivery date if it was entered and the status if one was chosen, so the dialog does what
 * its title says whichever button is pressed.
 *
 * The two writes stay separate ENDPOINTS, in a fixed order: date first, then status. Each
 * emails the customer, and each reports its own outcome, so a rejected status never hides a
 * date that was already saved and announced.
 *
 * The status dropdown is filled from the SERVER's `options`, not from a fixed list: the
 * state machine decides what a given order can move to, and `delivered` and `cancelled`
 * offer nothing at all.
 */
export default function OrderStatusModal({ orderId, onClose, onSaved }) {
  const [data, setData] = useState(null)
  const [deliveryDate, setDeliveryDate] = useState('')
  const [loadedDate, setLoadedDate] = useState('')
  const [status, setStatus] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const open = orderId !== null && orderId !== undefined

  useEffect(() => {
    if (!open) {
      setData(null)
      setStatus('')
      setDescription('')
      setDeliveryDate('')
      setLoadedDate('')
      // The component stays mounted between opens, so this must be cleared here too —
      // otherwise a successful save leaves `saving` true and the NEXT open has both buttons
      // disabled with nothing to explain why.
      setSaving(false)
      return
    }

    let cancelled = false
    api.admin.orders
      .statusData(orderId)
      .then((payload) => {
        if (cancelled) return
        setData(payload)
        const current = formatDateDMY(payload.expectedDeliveryDate)
        setDeliveryDate(current)
        setLoadedDate(current)
      })
      .catch((err) => {
        if (!cancelled) toast.error(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [open, orderId])

  // Escape closes, as the Blade's overlay click and close button did.
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  /*
   * Everything the admin filled in, in one go. The date is only written when it actually
   * changed — re-saving the same date would re-send the "delivery date updated" email.
   */
  async function saveAll(event) {
    event?.preventDefault?.()

    const dateText = deliveryDate.trim()
    const dateChanged = dateText !== '' && dateText !== loadedDate
    const hasStatus = Boolean(status)

    if (!dateChanged && !hasStatus) {
      toast.error('Choose a status or enter a delivery date.')
      return
    }

    // The field is DD-MM-YYYY; the endpoint takes an ISO date. Reject a malformed date
    // BEFORE anything is written, so a typo here cannot leave a half-applied change.
    let iso = null
    if (dateChanged) {
      const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dateText)
      if (!match) {
        toast.error('Enter the delivery date as DD-MM-YYYY.')
        return
      }
      iso = `${match[3]}-${match[2]}-${match[1]}`
    }

    setSaving(true)
    let wroteSomething = false
    try {
      if (dateChanged) {
        const res = await api.admin.orders.updateDeliveryDate(orderId, iso)
        toast.success(res.$message)
        wroteSomething = true
      }
      if (hasStatus) {
        const res = await api.admin.orders.updateStatus(orderId, { status, description })
        toast.success(res.$message)
        wroteSomething = true
      }
      onSaved?.()
      onClose()
    } catch (err) {
      toast.error(err.message)
      // A date may already be saved when the status is refused — show the list as it is.
      if (wroteSomething) onSaved?.()
      setSaving(false)
    }
  }

  if (!open) return null

  /*
   * Three fixed strings, not a list built from the options — order-admin.js writes exactly
   * these, and only for the placed/pending case. A packed or shipped order shows NO hint at
   * all, which is why this is not simply "the options, joined".
   */
  const canUpdate = Boolean(data?.options?.length)
  const raw = String(data?.status ?? '').toLowerCase()

  const hint = !canUpdate
    ? 'No further status updates allowed for this order.'
    : raw === 'placed' || raw === 'pending'
      ? 'You can move this order to Packed, Shipped, Delivered, or Cancelled.'
      : ''

  return createPortal(
    <>
      {/* `.confirm-overlay` */}
      <div className="fixed inset-0 z-[1200] bg-black/40" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Update Order Status"
        className="fixed left-1/2 top-1/2 z-[1201] max-h-[calc(100vh-40px)] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-[10px] bg-white shadow-[0_16px_40px_rgba(0,0,0,0.2)]"
      >
        {/* `.order-status-modal-head` — 14px/18px over a 1px #eee rule */}
        <div className="flex items-center justify-between border-b border-[#eee] px-[18px] py-3.5">
          <h3 className="text-[18px] font-bold text-[#333]">Update Order Status</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="border-none bg-transparent text-[24px] leading-none text-[#888]"
          >
            ×
          </button>
        </div>

        {/* `.order-status-modal-body` */}
        <div className="px-[18px] pb-5 pt-4">
          {/* `.delivery-date-row` — its own section above the timeline, over a #f0f0f0 rule */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5 border-b border-[#f0f0f0] pb-3.5">
            <label htmlFor="expected-delivery-date" className="text-[14px] font-semibold text-[#555]">
              Expected Delivery Date:
            </label>
            <div className="flex items-center gap-2">
              <input
                id="expected-delivery-date"
                type="text"
                value={deliveryDate}
                onChange={(event) => setDeliveryDate(event.target.value)}
                placeholder="DD-MM-YYYY"
                autoComplete="off"
                className="h-[38px] min-w-[140px] rounded-md border border-[#ddd] px-3 text-[14px] outline-none"
              />
              {/* `.btn-delivery-update` — green, and the only green control in the panel */}
              <button
                type="button"
                onClick={saveAll}
                disabled={saving}
                className="inline-flex h-[38px] items-center justify-center gap-2 rounded-md border-none bg-[#43a047] px-3.5 font-semibold text-white transition-colors hover:bg-[#2e7d32] disabled:cursor-wait disabled:opacity-85"
              >
                <Pencil size={14} />
                Update
              </button>
            </div>
          </div>

          {/* `.order-timeline` — every logged status, oldest first, joined by a #90caf9 line */}
          <div className="mb-[18px] mt-2 pl-2">
            {(data?.logs ?? []).map((log, index, all) => (
              <div
                key={log.id}
                className="relative grid grid-cols-[20px_1fr_auto] gap-2.5 pb-4"
              >
                {index < all.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-2 top-4 w-0.5 bg-[#90caf9]"
                  />
                ) : null}
                <span className="z-[1] mt-[3px] size-3.5 rounded-full bg-[#1e88e5]" />
                <div>
                  <strong className="block text-[14px] font-bold text-[#333]">{log.title}</strong>
                  {log.description ? (
                    <p className="mt-0.5 text-[12px] text-[#777]">{log.description}</p>
                  ) : null}
                </div>
                <span className="whitespace-nowrap text-[12px] text-[#888]">
                  {formatDateDMY(log.loggedAt)}
                </span>
              </div>
            ))}
          </div>

          <form onSubmit={saveAll} noValidate>
            {/* `.offer-form-row` — the same 220px label grid the offer and coupon forms use */}
            <div className="grid grid-cols-1 gap-2 border-b border-[#f0f0f0] py-3.5 min-[576px]:grid-cols-[160px_1fr] min-[576px]:items-center min-[576px]:gap-4">
              <label htmlFor="order-status-select" className="text-[14px] font-semibold text-[#555]">
                Status <span className="text-[#888]">:-</span>
              </label>
              <div className="min-w-0">
                <select
                  id="order-status-select"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  disabled={!canUpdate}
                  className={`${FORM_CONTROL} disabled:cursor-not-allowed disabled:bg-[#f7f7f7]`}
                >
                  <option value="">---Select Status---</option>
                  {(data?.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {hint ? <p className="mt-1 text-[12px] leading-[1.3] text-[#888]">{hint}</p> : null}
              </div>
            </div>

            <div className="grid grid-cols-1 items-start gap-2 border-b border-[#f0f0f0] py-3.5 min-[576px]:grid-cols-[160px_1fr] min-[576px]:gap-4">
              <label htmlFor="order-status-description" className="text-[14px] font-semibold text-[#555]">
                Short Description <span className="text-[#888]">:-</span>
              </label>
              <div className="min-w-0">
                <textarea
                  id="order-status-description"
                  rows={4}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Enter short description"
                  className="min-h-[140px] w-full resize-y rounded-md border border-[#ddd] bg-white px-3 py-[11px] text-[14px] outline-none transition-colors focus:border-admin-primary"
                />
              </div>
            </div>

            {/* `.offer-form-actions` */}
            <div className="pt-[18px]">
              {/* Save is disabled outright on a terminal order, as order-admin.js disabled it */}
              <Button type="submit" loading={saving} disabled={saving || !canUpdate}>Save</Button>
            </div>
          </form>
        </div>
      </div>
    </>,
    document.body,
  )
}
