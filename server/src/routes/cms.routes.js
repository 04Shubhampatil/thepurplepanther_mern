import { Router } from 'express'
import * as cmsController from '../controllers/cms.controller.js'

/**
 * Blog, banners and CMS pages.
 *
 * ROUTE ORDER: `/pages/support` and `/pages/support/:page` must precede `/pages/:slug`,
 * or "support" is read as a CMS page slug and 404s. Same hazard as the catalog router.
 */
const router = Router()

router.get('/blog', cmsController.blogIndex)
router.get('/blog/:slug', cmsController.blogShow)

router.get('/news-types', cmsController.newsTypes)
router.get('/banners', cmsController.banners)

// Literal paths first.
router.get('/pages/support', cmsController.supportIndex)
router.get('/pages/support/:page', cmsController.supportPage)
router.get('/pages', cmsController.sitePageIndex)

// Wildcard last.
router.get('/pages/:slug', cmsController.sitePage)

export default router
