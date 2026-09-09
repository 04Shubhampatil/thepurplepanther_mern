import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import { Card, Button, Alert } from '../../components/admin/AdminUI.jsx'
import { Toggle, FORM_CONTROL } from '../../components/admin/AdminControls.jsx'
import RichTextEditor from '../../components/admin/RichTextEditor.jsx'
import { storageUrl } from '../../utils/admin-media.js'
import { toDateTimeLocal, nowDateTimeLocal } from '../../utils/admin-date.js'
import { usePageTitle } from '../../theme/page.js'
import * as api from '../../services/endpoints.js'

/**
 * admin/blog-posts/create.blade.php + edit.blade.php + blog-posts/_form.blade.php.
 *
 * One `.form-grid` — `display:grid; gap:14px; max-width:640px` — so every field is a full
 * width row in a narrow column, unlike the banner form's side-by-side rows. Both toggles sit
 * in `.toggle-row`s at the bottom, and the submit reads "Update Post" on edit and
 * "Create Post" on create.
 *
 * The two images are separate columns with separate size limits, exactly as
 * BlogPostController validated them: `image` is the square card thumbnail at max 4 MB,
 * `banner_image` the wide detail banner at max 5 MB.
 *
 * `image_url` / `banner_image_url` are ACCESSORS. The admin API hands back the raw `image`
 * and `bannerImage` columns, so the placeholder fallback lives here.
 */
/*
 * `getImageUrlAttribute` falls back to a bundled theme image, not to an external
 * placeholder service — and `getBannerImageUrlAttribute` falls back to the card image
 * before reaching its own default.
 */
const PLACEHOLDER = '/frontend/images/blogs/blog-1.jpg'
const BANNER_PLACEHOLDER = '/frontend/images/blogs/blog-banner-img.jpg'

const ACCEPT = '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp'

/** `.form-group` — a 13px/600 #666 label above its control. */
function Field({ label, hint, error, children }) {
  return (
    <div className="flex min-w-0 flex-col">
      <label className="mb-1.5 block min-h-4 text-[13px] font-semibold leading-[1.2] text-[#666]">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[12px] leading-[1.3] text-[#888]">{hint}</p> : null}
      {error ? <p className="mt-1 text-[12px] text-[#e53935]">{error}</p> : null}
    </div>
  )
}

/** `.toggle-row` — label left, switch right, over a 1px #f0f0f0 rule. */
function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#f0f0f0] py-3">
      <span className="text-[14px]">{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

function ImagePicker({ label, hint, current, file, onPick, error, fallback = PLACEHOLDER }) {
  // The object URL is revoked when the picked file changes, so re-picking does not leak.
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  return (
    <Field label={label} hint={hint} error={error}>
      <div className="mb-2">
        <img
          src={preview || storageUrl(current, fallback)}
          alt=""
          className="max-h-[120px] rounded-lg"
        />
      </div>
      <input
        type="file"
        accept={ACCEPT}
        onChange={(event) => onPick(event.target.files?.[0] ?? null)}
        className={`${FORM_CONTROL} !py-2`}
      />
    </Field>
  )
}

const emptyForm = {
  title: '',
  news_type_id: '',
  author_name: 'Admin',
  published_at: nowDateTimeLocal(),
  excerpt: '',
  content: '',
  sort_order: 0,
  comments_count: 0,
  is_active: true,
  is_featured: false,
}

export default function JournalPostForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  usePageTitle(`${isEdit ? 'Edit' : 'Add'} Journal Post - Purple Panther`)

  const [form, setForm] = useState(emptyForm)
  const [image, setImage] = useState(null)
  const [bannerImage, setBannerImage] = useState(null)
  const [currentImage, setCurrentImage] = useState('')
  const [currentBanner, setCurrentBanner] = useState('')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: typeData } = useApi(() => api.admin.newsTypes.list({ per_page: 100 }), [])
  const { data: postData } = useApi(
    () => (isEdit ? api.admin.blogPosts.show(id) : Promise.resolve(null)),
    [id],
  )

  const newsTypes = typeData?.items ?? []

  useEffect(() => {
    const post = postData?.item
    if (!post) return

    setForm({
      title: post.title ?? '',
      news_type_id: post.newsTypeId ? String(post.newsTypeId) : '',
      author_name: post.authorName ?? 'Admin',
      published_at: toDateTimeLocal(post.publishedAt),
      excerpt: post.excerpt ?? '',
      content: post.content ?? '',
      sort_order: post.sortOrder ?? 0,
      comments_count: post.commentsCount ?? 0,
      is_active: Boolean(post.isActive),
      is_featured: Boolean(post.isFeatured),
    })
    setCurrentImage(post.image ?? '')
    setCurrentBanner(post.bannerImage ?? '')
  }, [postData])

  const set = (key) => (event) => {
    const value = event.target.value
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function validate() {
    const next = {}
    if (!form.title.trim()) next.title = 'Please enter a title.'
    if (!form.news_type_id) next.news_type_id = 'Please choose a news type.'
    // `stripHtml` rather than a length check: an empty CKEditor body is "<p><br></p>",
    // which is truthy but has nothing in it.
    if (!form.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()) {
      next.content = 'Please write the post content.'
    }
    // The card image was `required` on create and `nullable` on update.
    if (!isEdit && !image) next.image = 'Please choose a card image.'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function onSubmit(event) {
    event.preventDefault()
    setError('')
    if (!validate()) return

    setSaving(true)
    try {
      await api.admin.blogPosts.save(
        id,
        {
          ...form,
          sort_order: Number(form.sort_order) || 0,
          comments_count: Number(form.comments_count) || 0,
        },
        { image, banner_image: bannerImage },
      )
      navigate('/admin/blog-posts')
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <>
      {/* `.page-head` — the Back button sits at the far right on this screen, not above */}
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[22px] font-bold text-[#333]">{isEdit ? 'Edit' : 'Add'} Journal Post</h2>
        <Link
          to="/admin/blog-posts"
          className="inline-flex items-center justify-center rounded-md border border-[#ddd] bg-white px-4 py-[10px] text-[13px] font-semibold text-[#555] transition-colors hover:bg-[#f7f7f7]"
        >
          Back
        </Link>
      </div>

      <Alert onDismiss={() => setError('')}>{error}</Alert>

      <Card>
        {/* `.form-grid` — 14px gap, capped at 640px */}
        <form onSubmit={onSubmit} noValidate className="grid max-w-[640px] gap-3.5">
          <Field label="Title *" error={errors.title}>
            <input
              type="text"
              maxLength={255}
              value={form.title}
              onChange={set('title')}
              placeholder="Enter journal title"
              className={`${FORM_CONTROL} ${errors.title ? 'border-[#e53935]' : ''}`}
            />
          </Field>

          <Field label="News Type *" error={errors.news_type_id}>
            <select
              value={form.news_type_id}
              onChange={set('news_type_id')}
              className={`${FORM_CONTROL} ${errors.news_type_id ? 'border-[#e53935]' : ''}`}
            >
              <option value="">-- Select Type --</option>
              {newsTypes.map((type) => (
                <option key={type.id} value={String(type.id)}>{type.title}</option>
              ))}
            </select>
          </Field>

          <Field label="Author Name">
            <input
              type="text"
              maxLength={255}
              value={form.author_name}
              onChange={set('author_name')}
              placeholder="Admin"
              className={FORM_CONTROL}
            />
          </Field>

          <Field label="Published At">
            <input
              type="datetime-local"
              value={form.published_at}
              onChange={set('published_at')}
              className={FORM_CONTROL}
            />
          </Field>

          <ImagePicker
            label={`Card Image${isEdit && currentImage ? '' : ' *'}`}
            hint="Grid / list thumbnail. Use square image ~448×448 (same size for every post). PNG, JPG, JPEG, WEBP (max 4MB)."
            current={currentImage}
            file={image}
            onPick={setImage}
            error={errors.image}
          />

          <ImagePicker
            label="Banner Image (Journal Banner)"
            hint="Large banner for featured / detail page. Recommended ~1400×549. PNG, JPG, JPEG, WEBP (max 5MB)."
            current={currentBanner || currentImage}
            file={bannerImage}
            onPick={setBannerImage}
            fallback={BANNER_PLACEHOLDER}
          />

          <Field label="Short Excerpt">
            <textarea
              rows={3}
              maxLength={2000}
              value={form.excerpt}
              onChange={set('excerpt')}
              placeholder="Short summary for listing"
              className="min-h-[140px] w-full resize-y rounded-md border border-[#ddd] bg-white px-3 py-[11px] text-[14px] outline-none transition-colors focus:border-admin-primary"
            />
          </Field>

          <Field label="Content / Details *" error={errors.content}>
            <RichTextEditor
              id="content"
              rows={12}
              value={form.content}
              onChange={(html) => setForm((prev) => ({ ...prev, content: html }))}
            />
          </Field>

          <Field label="Sort Order">
            <input
              type="number"
              min="0"
              max="9999"
              value={form.sort_order}
              onChange={set('sort_order')}
              className={FORM_CONTROL}
            />
          </Field>

          <Field label="Comments Count (display)">
            <input
              type="number"
              min="0"
              max="999999"
              value={form.comments_count}
              onChange={set('comments_count')}
              className={FORM_CONTROL}
            />
          </Field>

          <ToggleRow
            label="Active"
            checked={form.is_active}
            onChange={() => setForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
          />
          <ToggleRow
            label="Featured Banner Post"
            checked={form.is_featured}
            onChange={() => setForm((prev) => ({ ...prev, is_featured: !prev.is_featured }))}
          />

          <div>
            <Button type="submit" loading={saving} disabled={saving}>
              {isEdit ? 'Update Post' : 'Save Post'}
            </Button>
          </div>
        </form>
      </Card>
    </>
  )
}
