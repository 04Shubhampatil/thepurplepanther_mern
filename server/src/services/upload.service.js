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
})

const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'])
const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB, the largest limit Laravel used

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
 * Write one uploaded file and return its RELATIVE path for storage.
 *
 * The filename is random rather than derived from the original: a user-supplied name can
 * carry path separators, and a predictable name lets one upload silently overwrite
 * another.
 */
export function persist(file, directory) {
  if (!file?.buffer) return null

  const dir = String(directory).replace(/[^a-z0-9-]/gi, '')
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
