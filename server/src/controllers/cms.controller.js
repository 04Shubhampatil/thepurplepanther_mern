import { z } from 'zod'
import * as cms from '../services/cms.service.js'
import { ok, asyncHandler } from '../utils/api-response.js'
import { SUPPORT_PAGES, SITE_PAGES, BANNER_SECTION_KEYS } from '../constants/cms.js'

const blogQuerySchema = z
  .object({
    type: z.string().optional(),
    page: z.string().optional(),
    per_page: z.string().optional(),
  })
  .transform((data) => ({
    typeSlug: data.type?.trim() || null,
    page: Number.parseInt(data.page ?? '1', 10) || 1,
    perPage: Number.parseInt(data.per_page ?? '9', 10) || 9,
  }))

/** GET /blog — index with news-type filter, featured post and pagination. */
export const blogIndex = asyncHandler(async (req, res) =>
  ok(res, await cms.listBlogPosts(blogQuerySchema.parse(req.query)), 'Blog'),
)

/** GET /blog/:slug — post plus related, prev and next. */
export const blogShow = asyncHandler(async (req, res) =>
  ok(res, await cms.getBlogPostBySlug(req.params.slug), 'Post'),
)

export const newsTypes = asyncHandler(async (req, res) =>
  ok(res, { newsTypes: await cms.listNewsTypes() }, 'News types'),
)

/**
 * GET /banners — layout chrome (top strip, mega-menu promo, category banner).
 * `?sections=a,b` restricts the result; unknown keys are dropped rather than erroring.
 */
export const banners = asyncHandler(async (req, res) => {
  const requested = String(req.query.sections ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => BANNER_SECTION_KEYS.includes(s))

  return ok(res, { banners: await cms.getBannersBySections(requested) }, 'Banners')
})

/**
 * GET /pages/support/:page? — validates the slug and returns its title.
 * Body content lives in React components, as it did in Blade. Defaults to `faqs`.
 */
export const supportPage = asyncHandler(async (req, res) =>
  ok(res, cms.getSupportPage(req.params.page ?? 'faqs'), 'Support page'),
)

/** GET /pages/support — the full allow-list, for building the support nav. */
export const supportIndex = asyncHandler(async (req, res) =>
  ok(
    res,
    { pages: Object.entries(SUPPORT_PAGES).map(([slug, title]) => ({ slug, title })) },
    'Support pages',
  ),
)

/** GET /pages/:slug — an admin-editable CMS page from the `pages` table. */
export const sitePage = asyncHandler(async (req, res) =>
  ok(res, await cms.getSitePage(req.params.slug), 'Page'),
)

export const sitePageIndex = asyncHandler(async (req, res) =>
  ok(
    res,
    { pages: Object.entries(SITE_PAGES).map(([slug, title]) => ({ slug, title })) },
    'Pages',
  ),
)

export default {
  blogIndex,
  blogShow,
  newsTypes,
  banners,
  supportPage,
  supportIndex,
  sitePage,
  sitePageIndex,
}
