import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import { Card, Button } from '../../components/admin/AdminUI.jsx'
import { Toggle, FORM_CONTROL } from '../../components/admin/AdminControls.jsx'
import { storageUrl } from '../../utils/admin-media.js'
import { usePageTitle } from '../../theme/page.js'
import { toast } from '../../store/toast.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/categories/create.blade.php + edit.blade.php.
 *
 * There is no `_form` partial here — the two views are written out separately, and they
 * differ in four small ways that are easy to lose in a merge: the Title placeholder and the
 * second image hint appear only on CREATE, the current image appears only on EDIT, and the
 * submit reads Save then Update. Each is reproduced below rather than harmonised.
 *
 * `.form-grid` — 14px gap, capped at 640px — so this is the journal post form's shape, not
 * the 220px label column the offer, coupon and user forms use.
 *
 * The three switches are a group under their own heading: they are per-category product
 * features, not page settings, and the Blade wraps them in a plain div for that reason.
 */

/** `.form-group` — a 13px/600 #666 label above its control. */
function Field({ label, hint, error, children }) {
  return (
    <div className="flex min-w-0 flex-col">
      <label className="mb-1.5 block min-h-4 text-[13px] font-semibold leading-[1.2] text-[#666]">
        {label}
      </label>
      {children}
      {hint}
      {error ? <p className="mt-1 text-[12px] text-[#e53935]">{error}</p> : null}
    </div>
  )
}

/** `.hint` — 12px #888. */
const Hint = ({ children }) => (
  <p className="mt-1 text-[12px] leading-[1.3] text-[#888]">{children}</p>
)

/** `.toggle-row` — label left, switch right, over a 1px #f0f0f0 rule. */
function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#f0f0f0] py-3">
      <span className="text-[14px]">{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

const emptyForm = {
  title: '',
  short_description: '',
  sort_order: 0,
  has_color: false,
  has_size: false,
  show_on_home: false,
}

export default function CategoryForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  usePageTitle(`${isEdit ? 'Edit' : 'Add'} Category - Purple Panther`)

  const [form, setForm] = useState(emptyForm)
  const [image, setImage] = useState(null)
  const [currentImage, setCurrentImage] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const { data } = useApi(
    () => (isEdit ? api.admin.categories.show(id) : Promise.resolve(null)),
    [id],
  )

  useEffect(() => {
    const category = data?.item
    if (!category) return

    setForm({
      title: category.title ?? '',
      short_description: category.shortDescription ?? '',
      sort_order: category.sortOrder ?? 0,
      has_color: Boolean(category.hasColor),
      has_size: Boolean(category.hasSize),
      show_on_home: Boolean(category.showOnHome),
    })
    setCurrentImage(category.image ?? '')
  }, [data])

  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))
  const flip = (key) => () => setForm((prev) => ({ ...prev, [key]: !prev[key] }))

  async function onSubmit(event) {
    event.preventDefault()
    setErrors({})

    if (!form.title.trim()) {
      setErrors({ title: 'Please enter a title.' })
      toast.error('Please enter a title.')
      return
    }

    setSaving(true)
    try {
      const body = {
        title: form.title.trim(),
        short_description: form.short_description.trim(),
        sort_order: Number(form.sort_order) || 0,
        has_color: form.has_color,
        has_size: form.has_size,
        show_on_home: form.show_on_home,
      }

      // The image is optional in BOTH modes, so the multipart form is only needed when one
      // was actually picked; without it the JSON body is enough.
      const res = isEdit
        ? await api.admin.categories.update(id, body, image ? { image } : null)
        : await api.admin.categories.create(body, image ? { image } : null)

      toast.success(res.$message)
      navigate('/admin/categories')
    } catch (err) {
      if (err.errors) {
        setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])))
      }
      toast.error(err.message)
      setSaving(false)
    }
  }

  return (
    <>
      {/* `.page-head` — the title on the left, Back as a `.btn-light` on the right */}
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[22px] font-bold text-[#333]">{isEdit ? 'Edit' : 'Add'} Category</h2>
        <Link
          to="/admin/categories"
          className="inline-flex items-center justify-center rounded-md border border-[#ddd] bg-white px-4 py-[10px] text-[13px] font-semibold text-[#555] transition-colors hover:bg-[#f7f7f7]"
        >
          Back
        </Link>
      </div>

      <Card>
        {/* `.form-grid` — 14px gap, 640px cap */}
        <form onSubmit={onSubmit} noValidate className="grid max-w-[640px] gap-3.5">
          <Field label="Title" error={errors.title}>
            <input
              type="text"
              value={form.title}
              onChange={set('title')}
              /* The placeholder is on the CREATE view only. */
              placeholder={isEdit ? undefined : 'Category title'}
              className={`${FORM_CONTROL} ${errors.title ? 'border-[#e53935]' : ''}`}
            />
          </Field>

          <Field
            label="Home Subtitle"
            hint={<Hint>Shown on homepage “Complete Collection” cards.</Hint>}
            error={errors.short_description}
          >
            <input
              type="text"
              value={form.short_description}
              onChange={set('short_description')}
              placeholder="Short line under category on home"
              className={FORM_CONTROL}
            />
          </Field>

          <Field
            label="Select Image"
            error={errors.image}
            hint={
              <>
                <Hint>
                  *Recommended Size is 400 x 240 pixels &amp; only png, jpg, jpeg image allowed.
                </Hint>
                {/* The second note exists only on the CREATE view. */}
                {isEdit ? null : (
                  <Hint>
                    Note: We recommended to upload jpg, jpeg image files for best compression ratio.
                  </Hint>
                )}
              </>
            }
          >
            {/* The current image sits ABOVE the picker, and only when editing. */}
            {preview || (isEdit && currentImage) ? (
              <div className="mb-2">
                <img
                  src={preview || storageUrl(currentImage)}
                  alt=""
                  className="max-h-40 max-w-full rounded-lg"
                />
              </div>
            ) : null}
            <input
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              onChange={(event) => setImage(event.target.files?.[0] ?? null)}
              className={`${FORM_CONTROL} !py-2`}
            />
          </Field>

          <Field label="Sort Order" error={errors.sort_order}>
            <input
              type="number"
              min="0"
              max="9999"
              value={form.sort_order}
              onChange={set('sort_order')}
              className={FORM_CONTROL}
            />
          </Field>

          <div>
            <h4 className="mb-2 text-[15px] font-bold text-[#333]">
              Product Features Category Wise
            </h4>
            {/*
              These decide what the PRODUCT form offers for a category: turning Colour off
              hides the colour variants there, not just on the storefront.
            */}
            <ToggleRow label="Colour" checked={form.has_color} onChange={flip('has_color')} />
            <ToggleRow label="Size" checked={form.has_size} onChange={flip('has_size')} />
            <ToggleRow label="Show on Home" checked={form.show_on_home} onChange={flip('show_on_home')} />
          </div>

          <div>
            <Button type="submit" loading={saving} disabled={saving}>
              {isEdit ? 'Update' : 'Save'}
            </Button>
          </div>
        </form>
      </Card>
    </>
  )
}
