import prisma from '../../config/database.js'
import { NotFoundError, ValidationError } from '../../utils/api-error.js'
import { persist, remove } from '../upload.service.js'

/**
 * Shared CRUD for the simple admin resources.
 *
 * `BrandController`, `ColorController`, `SizeController`, `SubCategoryController`,
 * `NewsTypeController`, `CategoryController` and `OfferController` are near-identical in
 * the source: index / store / update / destroy / toggleStatus, with slug generation and an
 * optional image. Rather than seven copies that drift apart, they share this factory and
 * differ only in configuration.
 *
 * Behaviour per resource is unchanged — the per-resource Zod schemas still carry each
 * one's own rules and messages.
 */

/**
 * Zod hands back the request's own field names, which are Laravel's column names in
 * snake_case; Prisma's client uses the camelCase names from schema.prisma. Nothing bridged
 * the two, so any resource field with an underscore — `sort_order`, `is_active`,
 * `short_description`, `news_type_id` — reached `prisma.create` as an unknown argument.
 *
 * Only the KEYS are touched, and only those containing an underscore, so a value is never
 * reinterpreted. Doing it here rather than in eight schemas keeps the request contract
 * (snake_case, matching the Laravel forms) separate from the storage contract.
 */
function camelizeKeys(data) {
  const out = {}
  for (const [key, value] of Object.entries(data)) {
    out[key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())] = value
  }
  return out
}

/**
 * Callers pass either a single multer file (the common case, `upload.single`) or a map of
 * column -> file (`upload.fields`, used where a resource has more than one image). Both are
 * normalised to a map so the write paths below have one shape to handle.
 */
function normaliseFiles(file, primaryField = 'image') {
  if (!file) return {}
  if (file.buffer) return { [primaryField]: file }
  return file
}

/** Laravel's Str::slug. */
export function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * @param {object} config
 * @param {string} config.model        Prisma model name, e.g. 'brand'
 * @param {string} config.label        Human label used in messages, e.g. 'Brand'
 * @param {string} [config.nameField]  Field the slug derives from ('name' or 'title')
 * @param {boolean} [config.hasSlug]
 * @param {string} [config.imageField]
 * @param {string} [config.imageDir]
 * @param {string[]} [config.searchFields]
 * @param {string[]} [config.uniqueFields]
 * @param {object} [config.include]
 */
export function createCrudService(config) {
  const {
    model,
    label,
    nameField = 'title',
    hasSlug = true,
    imageField = 'image',
    imageDir = null,
    /**
     * Extra file columns, as `{ column: directory }`. Journal posts are the only resource
     * with two — `image` is the 448x448 card thumbnail and `bannerImage` the wide detail
     * banner, stored in different directories exactly as BlogPostController stored them.
     */
    extraImageDirs = {},
    searchFields = [nameField],
    uniqueFields = [],
    /*
     * Per-field clash messages, because the source's are not uniform: CategoryController
     * flashes "This category name already exists. Duplicate name not allowed." while the
     * generated fallback below would say "…category title is already in use." The admin's
     * toast shows whichever the response carries, so the wording is worth carrying over.
     */
    uniqueMessages = {},
    include = undefined,
    orderBy = [{ sortOrder: 'asc' }, { [nameField]: 'asc' }],
  } = config

  const table = () => prisma[model]

  /** Uniqueness is checked before writing so the customer sees a field error, not a 500. */
  async function assertUnique(data, ignoreId = null) {
    for (const field of uniqueFields) {
      if (data[field] === undefined) continue

      const clash = await table().findFirst({
        where: {
          [field]: data[field],
          ...(ignoreId ? { NOT: { id: BigInt(ignoreId) } } : {}),
        },
        select: { id: true },
      })

      if (clash) {
        const message =
          uniqueMessages[field] ?? `This ${label.toLowerCase()} ${field} is already in use.`
        throw new ValidationError({ [field]: [message] }, message)
      }
    }
  }

  return {
    async list({ search = '', page = 1, perPage = 25, where: extraWhere = {} } = {}) {
      const term = String(search ?? '').trim()
      const where = {
        ...extraWhere,
        ...(term ? { OR: searchFields.map((f) => ({ [f]: { contains: term } })) } : {}),
      }

      const take = Math.min(Math.max(1, perPage), 100)
      const currentPage = Math.max(1, page)

      const [total, rows] = await prisma.$transaction([
        table().count({ where }),
        table().findMany({
          where,
          include,
          orderBy,
          skip: (currentPage - 1) * take,
          take,
        }),
      ])

      return {
        items: rows,
        pagination: {
          page: currentPage,
          perPage: take,
          total,
          lastPage: Math.max(1, Math.ceil(total / take)),
        },
      }
    },

    async find(id) {
      const row = await table().findUnique({ where: { id: BigInt(id) }, include })
      if (!row) throw new NotFoundError(`${label} not found.`)
      return row
    },

    async create(data, file = null) {
      const payload = camelizeKeys(data)

      if (hasSlug && !payload.slug) payload.slug = slugify(payload[nameField])
      if (hasSlug) uniqueFields.includes('slug') || uniqueFields.push('slug')

      await assertUnique(payload)

      const uploads = normaliseFiles(file, imageField)
      if (uploads[imageField] && imageDir) {
        payload[imageField] = persist(uploads[imageField], imageDir)
      }
      for (const [column, dir] of Object.entries(extraImageDirs)) {
        if (uploads[column]) payload[column] = persist(uploads[column], dir)
      }

      return table().create({ data: payload, include })
    },

    async update(id, data, file = null) {
      const existing = await this.find(id)
      const payload = camelizeKeys(data)

      /*
       * The slug is FROZEN after creation unless the admin types a new one.
       *
       * It used to follow the name on every save. Because no admin form sends `slug`, and
       * `optStr` turns an absent key into null rather than undefined, that fired on every
       * update: renaming a category from "Accessories" to anything rewrote its slug, and
       * with it the public URL. Verified before the fix — /accessories became
       * /accessories-updated, breaking every inbound link, bookmark and search result
       * pointing at the old address, silently and with a success toast.
       *
       * A slug is an address, not a display name. `updateProduct` already treats it that
       * way (`if (data.slug)`); this brings categories, brands, offers, colours, sizes,
       * news types and journal posts into line.
       */
      if (hasSlug && payload.slug) {
        payload.slug = slugify(payload.slug)
      } else {
        delete payload.slug
      }

      await assertUnique(payload, id)

      const uploads = normaliseFiles(file, imageField)
      if (uploads[imageField] && imageDir) {
        payload[imageField] = persist(uploads[imageField], imageDir)
        // Replace, then delete the old file — never the other way round, or a failed
        // write leaves the row pointing at nothing.
        if (existing[imageField]) remove(existing[imageField])
      }
      for (const [column, dir] of Object.entries(extraImageDirs)) {
        if (!uploads[column]) continue
        payload[column] = persist(uploads[column], dir)
        if (existing[column]) remove(existing[column])
      }

      return table().update({ where: { id: BigInt(id) }, data: payload, include })
    },

    async destroy(id) {
      const existing = await this.find(id)
      await table().delete({ where: { id: BigInt(id) } })
      if (imageDir && existing[imageField]) remove(existing[imageField])
      for (const column of Object.keys(extraImageDirs)) {
        if (existing[column]) remove(existing[column])
      }
    },

    /** Flip `is_active`. Returns the new value so the UI does not need to re-read. */
    async toggle(id) {
      const existing = await this.find(id)
      const updated = await table().update({
        where: { id: BigInt(id) },
        data: { isActive: !existing.isActive },
      })
      return updated.isActive
    },
  }
}

export default createCrudService
