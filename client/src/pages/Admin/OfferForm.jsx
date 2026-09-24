import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Image as ImageIcon } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import { Card, Button } from '../../components/admin/AdminUI.jsx'
import { FORM_CONTROL } from '../../components/admin/AdminControls.jsx'
import { storageUrl } from '../../utils/admin-media.js'
import { usePageTitle } from '../../theme/page.js'
import { toast } from '../../store/toast.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/offers/create.blade.php + edit.blade.php.
 *
 * Like categories there is no `_form` partial; the two views are written out separately and
 * differ only in the current image, so that is the single conditional below.
 *
 * The discount field is `.discount-input` with the `%` on the RIGHT — `.discount-suffix`,
 * with a left border. The coupon form uses the same box with the symbol on the left
 * (`.discount-prefix`), so the two are mirror images rather than the same component.
 *
 * Both views submit "Save"; neither says Update.
 */
/*
 * Module scope, NOT inside the component.
 *
 * Declared in the body, this got a new function identity on every render, so React saw a
 * different element type, unmounted the whole row and mounted fresh DOM nodes. Every
 * keystroke destroyed the input the admin was typing into and focus fell back to <body> —
 * one character per click. Purely presentational, so it only ever needed its props.
 */
const Row = ({ label, top = false, labelExtra, children }) => (
  <div
    className={`grid grid-cols-1 gap-2 border-b border-[#f0f0f0] py-3.5 min-[768px]:grid-cols-[220px_1fr] min-[768px]:gap-4 ${
      top ? 'items-start' : 'min-[768px]:items-center'
    }`}
  >
    <div>
      <label className="text-[14px] font-semibold text-[#555]">
        {label} <span className="text-[#888]">:-</span>
      </label>
      {labelExtra}
    </div>
    <div className="min-w-0">{children}</div>
  </div>
)

export default function OfferForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  usePageTitle(`${isEdit ? 'Edit' : 'Add'} Offer - Purple Panther`)

  const [form, setForm] = useState({ title: '', description: '', discount_percent: '' })
  const [image, setImage] = useState(null)
  const [currentImage, setCurrentImage] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const { data } = useApi(
    () => (isEdit ? api.admin.offers.show(id) : Promise.resolve(null)),
    [id],
  )

  useEffect(() => {
    const offer = data?.item
    if (!offer) return

    setForm({
      title: offer.title ?? '',
      description: offer.description ?? '',
      discount_percent: offer.discountPercent ?? '',
    })
    setCurrentImage(offer.image ?? '')
  }, [data])

  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

  async function onSubmit(event) {
    event.preventDefault()
    setErrors({})

    const next = {}
    if (!form.title.trim()) next.title = 'Please enter a title.'
    const percent = Number(form.discount_percent)
    if (!form.discount_percent) next.discount_percent = 'Please enter a discount.'
    else if (!(percent >= 1 && percent <= 100)) {
      next.discount_percent = 'Discount must be between 1 and 100.'
    }
    // The image is required on CREATE only, matching `data-image-required`.
    if (!isEdit && !image) next.image = 'Please select an image.'

    if (Object.keys(next).length) {
      setErrors(next)
      toast.error(Object.values(next)[0])
      return
    }

    setSaving(true)
    try {
      const body = {
        title: form.title.trim(),
        description: form.description,
        discount_percent: percent,
      }

      const res = isEdit
        ? await api.admin.offers.update(id, body, image ? { image } : null)
        : await api.admin.offers.create(body, image ? { image } : null)

      toast.success(res.$message)
      navigate('/admin/offers')
    } catch (err) {
      if (err.errors) {
        setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])))
      }
      toast.error(err.message)
      setSaving(false)
    }
  }

  const FieldError = ({ field }) =>
    errors[field] ? <p className="mt-1 text-[12px] text-[#e53935]">{errors[field]}</p> : null

  /** `.offer-form-row` */

  return (
    <>
      <div className="mb-[18px]">
        <Link
          to="/admin/offers"
          className="mb-1.5 inline-block text-[14px] font-semibold text-admin-primary hover:underline"
        >
          ← Back
        </Link>
        <h2 className="text-[22px] font-bold text-[#333]">{isEdit ? 'Edit' : 'Add'} Offer</h2>
      </div>

      <Card>
        <form onSubmit={onSubmit} noValidate>
          <Row label="Title">
            <input
              type="text"
              value={form.title}
              onChange={set('title')}
              placeholder="Enter title"
              className={`${FORM_CONTROL} ${errors.title ? 'border-[#e53935]' : ''}`}
            />
            <FieldError field="title" />
          </Row>

          <Row label="Description(Optional)" top>
            <textarea
              rows={8}
              value={form.description}
              onChange={set('description')}
              placeholder="Enter description"
              className="min-h-[180px] w-full resize-y rounded-md border border-[#ddd] bg-white px-3 py-[11px] text-[14px] outline-none transition-colors focus:border-admin-primary"
            />
          </Row>

          <Row label="Discount in %">
            {/* `.discount-input` with the suffix on the RIGHT, over a left border */}
            <div
              className={`flex h-[42px] items-center overflow-hidden rounded-md border bg-white ${
                errors.discount_percent ? 'border-[#e53935]' : 'border-[#ddd]'
              }`}
            >
              <input
                type="number"
                min="1"
                max="100"
                inputMode="numeric"
                value={form.discount_percent}
                onChange={set('discount_percent')}
                placeholder="e.g. 20"
                className="h-10 min-w-0 flex-1 border-none px-3 text-[14px] outline-none"
              />
              <span className="flex h-full items-center border-l border-[#eee] bg-[#f7f7f7] px-3.5 font-bold text-[#555]">
                %
              </span>
            </div>
            <FieldError field="discount_percent" />
          </Row>

          <Row
            label="Select Image"
            top
            labelExtra={
              <>
                {/* `.offer-label-wrap .hint` — these are #e53935, not the usual #888 */}
                <p className="mt-1 text-[12px] leading-[1.3] text-[#e53935]">
                  (Recommended resolution: 470X266, 570x223)
                </p>
                <p className="mt-1 text-[12px] leading-[1.3] text-[#e53935]">
                  (Accept png, jpg, jpeg, PNG, JPG, JPEG image files)
                </p>
                <p className="mt-1 text-[12px] leading-[1.3] text-[#e53935]">
                  (Recommended jpg, jpeg for best compression ratio)
                </p>
              </>
            }
          >
            {/* `.offer-image-box` with the plain 120x80 `.offer-image-preview` */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#ddd] bg-white p-2.5">
              <input
                type="file"
                accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                onChange={(event) => setImage(event.target.files?.[0] ?? null)}
                className="h-auto min-w-[180px] flex-1 border-none p-0 text-[14px]"
              />
              <div className="flex h-20 w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#e3f2fd] text-[#90a4ae]">
                {preview || currentImage ? (
                  <img
                    src={preview || storageUrl(currentImage)}
                    alt={form.title}
                    className="size-full object-cover"
                  />
                ) : (
                  <ImageIcon size={28} />
                )}
              </div>
            </div>
            <FieldError field="image" />
          </Row>

          {/* `.offer-form-actions` — both views say Save, neither says Update */}
          <div className="pt-[18px]">
            <Button type="submit" loading={saving} disabled={saving}>Save</Button>
          </div>
        </form>
      </Card>
    </>
  )
}
