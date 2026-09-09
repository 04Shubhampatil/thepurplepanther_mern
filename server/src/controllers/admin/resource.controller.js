import { ok, created, asyncHandler } from '../../utils/api-response.js'

/**
 * Controller factory for the simple admin resources.
 *
 * Pairs with services/admin/crud.service.js: seven near-identical Laravel controllers
 * become one implementation, configured per resource. Each still has its own Zod schema,
 * so validation rules and messages remain per-resource.
 */
export function createResourceController(service, label, { imageField = null, messages = {} } = {}) {
  const file = (req) => (imageField && req.file ? req.file : null)

  /*
   * These strings are USER-FACING: the admin's toast shows the message this response
   * carries, exactly as Laravel's layout showed `session('success')`. So they are the
   * controllers' own wording, not a generic template — and the wording is not uniform in
   * the source, which is why it is passed in per resource. ColorController, SizeController
   * and SubCategoryController flash a bare "Status updated."; the others name the resource.
   */
  const say = {
    created: messages.created ?? `${label} created.`,
    updated: messages.updated ?? `${label} updated.`,
    deleted: messages.deleted ?? `${label} deleted.`,
    toggled: messages.toggled ?? `${label} status updated.`,
  }

  return {
    index: asyncHandler(async (req, res) => {
      const result = await service.list({
        search: req.query.search ?? '',
        page: Number.parseInt(req.query.page ?? '1', 10) || 1,
        perPage: Number.parseInt(req.query.per_page ?? '25', 10) || 25,
      })
      return ok(res, result, `${label} list`)
    }),

    show: asyncHandler(async (req, res) =>
      ok(res, { item: await service.find(req.params.id) }, label),
    ),

    store: asyncHandler(async (req, res) =>
      created(res, { item: await service.create(req.body, file(req)) }, say.created),
    ),

    update: asyncHandler(async (req, res) =>
      ok(res, { item: await service.update(req.params.id, req.body, file(req)) }, say.updated),
    ),

    destroy: asyncHandler(async (req, res) => {
      await service.destroy(req.params.id)
      return ok(res, {}, say.deleted)
    }),

    toggle: asyncHandler(async (req, res) =>
      ok(res, { isActive: await service.toggle(req.params.id) }, say.toggled),
    ),
  }
}

export default createResourceController
