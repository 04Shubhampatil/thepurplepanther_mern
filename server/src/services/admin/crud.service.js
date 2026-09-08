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
    searchFields = [nameField],
    uniqueFields = [],
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
        throw new ValidationError(
          { [field]: [`This ${label.toLowerCase()} ${field} is already in use.`] },
          `This ${label.toLowerCase()} ${field} is already in use.`,
        )
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
      const payload = { ...data }

      if (hasSlug && !payload.slug) payload.slug = slugify(payload[nameField])
      if (hasSlug) uniqueFields.includes('slug') || uniqueFields.push('slug')

      await assertUnique(payload)

      if (file && imageDir) payload[imageField] = persist(file, imageDir)

      return table().create({ data: payload, include })
    },

    async update(id, data, file = null) {
      const existing = await this.find(id)
      const payload = { ...data }

      // The slug follows the name when the name changes, matching Str::slug on save.
      if (hasSlug && payload[nameField] && !payload.slug) {
        payload.slug = slugify(payload[nameField])
      }

      await assertUnique(payload, id)

      if (file && imageDir) {
        payload[imageField] = persist(file, imageDir)
        // Replace, then delete the old file — never the other way round, or a failed
        // write leaves the row pointing at nothing.
        if (existing[imageField]) remove(existing[imageField])
      }

      return table().update({ where: { id: BigInt(id) }, data: payload, include })
    },

    async destroy(id) {
      const existing = await this.find(id)
      await table().delete({ where: { id: BigInt(id) } })
      if (imageDir && existing[imageField]) remove(existing[imageField])
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
