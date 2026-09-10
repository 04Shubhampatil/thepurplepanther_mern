import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import { Card, Button } from '../../components/admin/AdminUI.jsx'
import { FORM_CONTROL } from '../../components/admin/AdminControls.jsx'
import { storageUrl } from '../../utils/admin-media.js'
import { useAuthStore } from '../../store/index.js'
import { usePageTitle } from '../../theme/page.js'
import { toast } from '../../store/toast.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/profile/edit.blade.php.
 *
 * The `.offer-form-row` grid again, with the 80px square `.user-avatar-preview` the user
 * form uses.
 *
 * There is NO current-password field, unlike the storefront's account form: an admin editing
 * their own profile is already authenticated by this session. Blank keeps the current
 * password, and Confirm Password exists for Laravel's `confirmed` rule.
 *
 * Saving refreshes the auth store, so the header's name and avatar update without a reload —
 * in Laravel the redirect re-rendered the layout and did that for free.
 */
export default function Profile() {
  usePageTitle('My Profile - Purple Panther')

  // `init()` re-reads /auth/me, which is what refreshes the header's name and avatar.
  const refreshUser = useAuthStore((state) => state.init)

  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    password_confirmation: '',
  })
  const [avatar, setAvatar] = useState(null)
  const [currentAvatar, setCurrentAvatar] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const { data, refetch } = useApi(() => api.admin.profile(), [])

  useEffect(() => {
    const user = data?.user
    if (!user) return

    setForm({
      name: user.name ?? '',
      username: user.username ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      password: '',
      password_confirmation: '',
    })
    setCurrentAvatar(user.avatar ?? '')
  }, [data])

  const preview = useMemo(() => (avatar ? URL.createObjectURL(avatar) : null), [avatar])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

  async function onSubmit(event) {
    event.preventDefault()
    setErrors({})

    const next = {}
    if (!form.name.trim()) next.name = 'Please enter a name.'
    if (!form.username.trim()) next.username = 'Please enter a username.'
    if (!form.email.trim()) next.email = 'Please enter a valid email address.'
    if (form.password && form.password.length < 6) {
      next.password = 'Password must be at least 6 characters.'
    }
    if (form.password && form.password !== form.password_confirmation) {
      next.password_confirmation = 'The password confirmation does not match.'
    }

    if (Object.keys(next).length) {
      setErrors(next)
      toast.error(Object.values(next)[0])
      return
    }

    setSaving(true)
    try {
      const res = await api.admin.updateProfile(
        {
          name: form.name.trim(),
          username: form.username.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          // Omitted entirely when blank, so the stored password is left alone.
          ...(form.password
            ? { password: form.password, password_confirmation: form.password_confirmation }
            : {}),
        },
        avatar ? { avatar } : null,
      )

      toast.success(res.$message)
      setForm((prev) => ({ ...prev, password: '', password_confirmation: '' }))
      setAvatar(null)
      refetch()
      refreshUser?.()
    } catch (err) {
      if (err.errors) {
        setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])))
      }
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const FieldError = ({ field }) =>
    errors[field] ? <p className="mt-1 text-[12px] text-[#e53935]">{errors[field]}</p> : null

  /** `.offer-form-row` */
  const Row = ({ label, top = false, children }) => (
    <div
      className={`grid grid-cols-1 gap-2 border-b border-[#f0f0f0] py-3.5 min-[768px]:grid-cols-[220px_1fr] min-[768px]:gap-4 ${
        top ? 'items-start' : 'min-[768px]:items-center'
      }`}
    >
      <label className="text-[14px] font-semibold text-[#555]">
        {label} <span className="text-[#888]">:-</span>
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  )

  /** `getAvatarUrlAttribute` — the fallback is generated from the name. */
  const avatarSrc =
    preview ||
    (currentAvatar
      ? storageUrl(currentAvatar)
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(form.name)}&background=e91e63&color=fff`)

  return (
    <>
      <div className="mb-[18px]">
        <Link
          to="/admin/dashboard"
          className="mb-1.5 inline-block text-[14px] font-semibold text-admin-primary hover:underline"
        >
          ← Back
        </Link>
        <h2 className="text-[22px] font-bold text-[#333]">My Profile</h2>
      </div>

      <Card>
        <form onSubmit={onSubmit} noValidate>
          <Row label="Avatar" top>
            {/* `.offer-image-box` with `.user-avatar-preview` — an 80px square at 8px radius */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#ddd] bg-white p-2.5">
              <input
                type="file"
                accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                onChange={(event) => setAvatar(event.target.files?.[0] ?? null)}
                className="h-auto min-w-[180px] flex-1 border-none p-0 text-[14px]"
              />
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#e3f2fd]">
                <img src={avatarSrc} alt={form.name} className="size-full object-cover" />
              </div>
            </div>
            <FieldError field="avatar" />
          </Row>

          <Row label="Name">
            <input
              type="text"
              maxLength={255}
              value={form.name}
              onChange={set('name')}
              className={`${FORM_CONTROL} ${errors.name ? 'border-[#e53935]' : ''}`}
            />
            <FieldError field="name" />
          </Row>

          <Row label="Username">
            <input
              type="text"
              maxLength={100}
              value={form.username}
              onChange={set('username')}
              className={`${FORM_CONTROL} ${errors.username ? 'border-[#e53935]' : ''}`}
            />
            <FieldError field="username" />
          </Row>

          <Row label="Email">
            <input
              type="email"
              maxLength={255}
              value={form.email}
              onChange={set('email')}
              className={`${FORM_CONTROL} ${errors.email ? 'border-[#e53935]' : ''}`}
            />
            <FieldError field="email" />
          </Row>

          <Row label="Phone">
            <input
              type="text"
              maxLength={20}
              value={form.phone}
              onChange={set('phone')}
              className={FORM_CONTROL}
            />
          </Row>

          <Row label="New Password">
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder="Leave blank to keep current"
              autoComplete="new-password"
              className={`${FORM_CONTROL} ${errors.password ? 'border-[#e53935]' : ''}`}
            />
            <FieldError field="password" />
          </Row>

          <Row label="Confirm Password">
            <input
              type="password"
              value={form.password_confirmation}
              onChange={set('password_confirmation')}
              placeholder="Confirm new password"
              autoComplete="new-password"
              className={`${FORM_CONTROL} ${errors.password_confirmation ? 'border-[#e53935]' : ''}`}
            />
            <FieldError field="password_confirmation" />
          </Row>

          {/* `.offer-form-actions` */}
          <div className="pt-[18px]">
            <Button type="submit" loading={saving} disabled={saving}>Update Profile</Button>
          </div>
        </form>
      </Card>
    </>
  )
}
