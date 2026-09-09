import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { User as UserIcon } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import { Button } from '../../components/admin/AdminUI.jsx'
import { FORM_CONTROL } from '../../components/admin/AdminControls.jsx'
import { storageUrl } from '../../utils/admin-media.js'
import { usePageTitle } from '../../theme/page.js'
import { toast } from '../../store/toast.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/users/create.blade.php + edit.blade.php + users/_form.blade.php,
 * plus the validation in public/js/user-form.js.
 *
 * The `.offer-form-row` grid again — a 220px label column beside the field — inside a
 * `.product-form-card` capped at 980px.
 *
 * Password is the one field that differs between the two modes: required on create, and on
 * edit left blank to keep the current one, with the hint saying so. The field is never
 * PREFILLED — the API does not return a password hash and could not fill it if it did.
 */
const PLATFORMS = ['Web', 'Android', 'iOS']

/** `.offer-form-row` */
function Row({ label, top = false, labelExtra, children }) {
  return (
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
}

const RedHint = ({ children }) => (
  <p className="mt-1 text-[12px] leading-[1.3] text-[#e53935]">{children}</p>
)

const emptyForm = { name: '', email: '', phone: '', password: '', platform: 'Web' }

export default function UserForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  usePageTitle(`${isEdit ? 'Edit' : 'Add'} User - Purple Panther`)

  const [form, setForm] = useState(emptyForm)
  const [avatar, setAvatar] = useState(null)
  const [currentAvatar, setCurrentAvatar] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const { data } = useApi(
    () => (isEdit ? api.admin.users.show(id) : Promise.resolve(null)),
    [id],
  )

  useEffect(() => {
    const user = data?.item
    if (!user) return

    setForm({
      name: user.name ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      // Never seeded — the API returns no hash, and a placeholder here would be saved back
      // as a literal password the moment the admin submitted without touching the field.
      password: '',
      platform: user.platform || 'Web',
    })
    setCurrentAvatar(user.avatar ?? '')
  }, [data])

  const preview = useMemo(() => (avatar ? URL.createObjectURL(avatar) : null), [avatar])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

  /** user-form.js's rules, with its exact messages. */
  function validate() {
    const next = {}
    const name = form.name.trim()

    if (!name) next.name = 'Name is required.'
    else if (name.length < 2) next.name = 'Name must be at least 2 characters.'

    if (!form.email.trim()) next.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = 'Enter a valid email address.'
    }

    // Required on create; on edit only checked when the admin actually typed something.
    if (!isEdit && !form.password) next.password = 'Password is required.'
    else if (form.password && form.password.length < 6) {
      next.password = 'Password must be at least 6 characters.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function onSubmit(event) {
    event.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const res = await api.admin.users.save(
        id,
        {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          platform: form.platform,
          // Omitted on edit when blank, so the stored password is left alone.
          ...(form.password ? { password: form.password } : {}),
        },
        { avatar },
      )

      toast.success(res.$message)
      navigate('/admin/users')
    } catch (err) {
      if (err.errors) {
        setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])))
      }
      toast.error(err.message)
      setSaving(false)
    }
  }

  const invalid = (field) => (errors[field] ? 'border-[#e53935]' : '')
  const FieldError = ({ field }) =>
    errors[field] ? <p className="mt-1 text-[12px] text-[#e53935]">{errors[field]}</p> : null

  return (
    <>
      {/* `.page-head` — back link above the title */}
      <div className="mb-[18px]">
        <Link
          to="/admin/users"
          className="mb-1.5 inline-block text-[14px] font-semibold text-admin-primary hover:underline"
        >
          ← Back
        </Link>
        <h2 className="text-[22px] font-bold text-[#333]">{isEdit ? 'Edit' : 'Add'} User</h2>
      </div>

      <form onSubmit={onSubmit} noValidate>
        {/* `.product-form-card.user-form-card` */}
        <div className="mb-4 max-w-[980px] rounded-[10px] bg-white p-[18px] shadow-admin-card">
          <Row label="Name">
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              placeholder="Enter your name"
              className={`${FORM_CONTROL} ${invalid('name')}`}
            />
            <FieldError field="name" />
          </Row>

          <Row label="Email">
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="Enter your email"
              className={`${FORM_CONTROL} ${invalid('email')}`}
            />
            <FieldError field="email" />
          </Row>

          <Row label="Phone number">
            <input
              type="text"
              value={form.phone}
              onChange={set('phone')}
              placeholder="Enter your phone number"
              className={FORM_CONTROL}
            />
          </Row>

          <Row label="Password">
            {/* `.user-form-card input[type=password]` — .08em tracking on the value, but the
                placeholder is reset to normal and #bdbdbd so the asterisks stay legible */}
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder="********"
              autoComplete="new-password"
              className={`${FORM_CONTROL} tracking-[0.08em] placeholder:tracking-normal placeholder:text-[#bdbdbd] ${invalid('password')}`}
            />
            {isEdit ? (
              <p className="mt-1 text-[12px] leading-[1.3] text-[#888]">
                Leave blank if you do not want to change password.
              </p>
            ) : null}
            <FieldError field="password" />
          </Row>

          <Row label="Platform">
            <select value={form.platform} onChange={set('platform')} className={FORM_CONTROL}>
              {PLATFORMS.map((platform) => (
                <option key={platform} value={platform}>{platform}</option>
              ))}
            </select>
          </Row>

          <Row
            label="Select Image"
            top
            labelExtra={
              <>
                <RedHint>(Recommended resolution: 300x300, 400x400)</RedHint>
                <RedHint>(Accept png, jpg, jpeg, PNG, JPG, JPEG image files)</RedHint>
              </>
            }
          >
            {/* `.offer-image-box` with `.user-avatar-preview` — an 80px SQUARE at 8px radius,
                not the 120x80 the offer form uses */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#ddd] bg-white p-2.5">
              <input
                type="file"
                accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                onChange={(event) => setAvatar(event.target.files?.[0] ?? null)}
                className="h-auto min-w-[180px] flex-1 border-none p-0 text-[14px]"
              />
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#e3f2fd] text-[#546e7a]">
                {preview || currentAvatar ? (
                  <img
                    src={preview || storageUrl(currentAvatar)}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <UserIcon size={28} />
                )}
              </div>
            </div>
            <FieldError field="avatar" />
          </Row>

          {/* `.offer-form-actions` — Save then Cancel, unlike the coupon form's lone Save */}
          <div className="flex flex-wrap items-center gap-2 pt-[18px]">
            <Button type="submit" loading={saving} disabled={saving}>Save</Button>
            <Link
              to="/admin/users"
              className="inline-flex items-center justify-center rounded-md border border-[#ddd] bg-white px-4 py-[10px] text-[13px] font-semibold text-[#555] transition-colors hover:bg-[#f7f7f7]"
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </>
  )
}
