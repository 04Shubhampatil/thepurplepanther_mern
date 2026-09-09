import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import multer from 'multer'
import env from '../config/env.js'
import logger from '../config/logger.js'
import { BusinessError } from '../utils/api-error.js'

/**
 * File uploads.
 *
 * Storage is LOCAL, matching Laravel's `FILESYSTEM_DISK=public` with the tree rooted at
 * `public/storage` — S3 is configured in the source but never selected (audit §4). Files
 * are written to the SAME directories with the same relative-path convention, so:
 *
 *   - existing rows keep resolving,
 *   - both applications can serve each other's uploads during the parallel run,
 *   - rollback costs nothing.
 *
 * The database stores a bare relative path ("products/abc.jpg"); URL resolution stays a
 * read-time concern in utils/media.js.
 */

export const UPLOAD_DIRS = Object.freeze({
  products: 'products',
  categories: 'categories',
  brands: 'brands',
  offers: 'offers',
  banners: 'banners',
  coupons: 'coupons',
  users: 'users',
  blogPosts: 'blog-posts',
  blogPostBanners: 'blog-posts/banners',
})

const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'])
const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB, the largest limit Laravel used

/**
 * Banners are the one module that accepts video.
 *
 * `BannerController::validated` allowed `mimes:png,jpg,jpeg,mp4,webm,ogg,mov` at
 * `max:51200` — 50 MB, not the 4 MB every other upload is held to — because the homepage
 * hero plays a video file. Sharing the image-only instance here would reject the very
 * uploads the form's own hint promises.
 *
 * Restricting videos to the Home — Main Hero SECTION is a separate check: multer's filter
 * cannot see `section` reliably (a multipart field only reaches `req.body` if the client
 * put it before the files), so the services enforce it once both are in hand.
 */
export const BANNER_VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
])

const MAX_BANNER_FILE_SIZE = 50 * 1024 * 1024

function storageRoot() {
  if (!env.STORAGE_ROOT) {
    throw new BusinessError('File storage is not configured. Set STORAGE_ROOT.')
  }
  return env.STORAGE_ROOT
}

/**
 * Multer instance. Files are buffered in memory and written by `persist()`, so a request
 * that fails validation never leaves a stray file on disk.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 30 },
  fileFilter(req, file, cb) {
    if (!IMAGE_MIME.has(file.mimetype)) {
      cb(new BusinessError('Only PNG, JPG, WEBP and SVG images are allowed.'))
      return
    }
    cb(null, true)
  },
})

/**
 * Journal posts: images only, but 5 MB rather than 4.
 *
 * `BlogPostController` validated the card image at `max:4096` and the detail banner at
 * `max:5120`. multer's ceiling is per-instance, so the looser of the two is used here and
 * the form states each limit — the same place Laravel stated them.
 */
export const blogPostUploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
  fileFilter(req, file, cb) {
    if (!IMAGE_MIME.has(file.mimetype)) {
      cb(new BusinessError('Only PNG, JPG, JPEG and WEBP images are allowed.'))
      return
    }
    cb(null, true)
  },
})

/** The banner variant of the same instance: images or video, 50 MB apiece. */
export const bannerUploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BANNER_FILE_SIZE, files: 30 },
  fileFilter(req, file, cb) {
    if (!IMAGE_MIME.has(file.mimetype) && !BANNER_VIDEO_MIME.has(file.mimetype)) {
      cb(new BusinessError('Only PNG, JPG, JPEG images and MP4, WEBM, OGG, MOV videos are allowed.'))
      return
    }
    cb(null, true)
  },
})

/**
 * Write one uploaded file and return its RELATIVE path for storage.
 *
 * The filename is random rather than derived from the original: a user-supplied name can
 * carry path separators, and a predictable name lets one upload silently overwrite
 * another.
 */
export function persist(file, directory) {
  if (!file?.buffer) return null

  // Slashes are allowed so a nested target like 'blog-posts/banners' survives — Laravel
  // stored the journal's banner images there. Everything else is still stripped, and each
  // segment is re-checked, so no value can walk up out of the storage root.
  const dir = String(directory)
    .split('/')
    .map((segment) => segment.replace(/[^a-z0-9-]/gi, ''))
    .filter(Boolean)
    .join('/')
  if (!dir) throw new BusinessError('Invalid upload directory.')

  const absoluteDir = path.join(storageRoot(), dir)
  fs.mkdirSync(absoluteDir, { recursive: true })

  const ext = (path.extname(file.originalname || '').toLowerCase().match(/^\.[a-z0-9]{1,5}$/) || [
    '.jpg',
  ])[0]
  const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`

  fs.writeFileSync(path.join(absoluteDir, name), file.buffer)

  // Forward slashes: this value goes into the database and then into a URL.
  return `${dir}/${name}`
}

export const persistMany = (files = [], directory) =>
  files.map((file) => persist(file, directory)).filter(Boolean)

/**
 * Delete a stored file. Never throws — a missing file must not fail the request that
 * replaced it, and the path is validated so a crafted value cannot escape the tree.
 */
export function remove(relativePath) {
  if (!relativePath || /^https?:\/\//i.test(relativePath)) return

  try {
    const root = storageRoot()
    const target = path.resolve(root, relativePath)

    // Path-traversal guard: "../../etc/passwd" must not resolve outside the store.
    if (!target.startsWith(path.resolve(root) + path.sep)) {
      logger.warn({ relativePath }, 'Refused to delete a file outside the storage root')
      return
    }

    if (fs.existsSync(target)) fs.unlinkSync(target)
  } catch (error) {
    logger.warn({ err: error, relativePath }, 'Could not delete file')
  }
}

export const removeMany = (paths = []) => paths.forEach(remove)

export default { upload, persist, persistMany, remove, removeMany, UPLOAD_DIRS }
