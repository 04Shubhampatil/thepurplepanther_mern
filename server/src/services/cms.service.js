import prisma from '../config/database.js'
import { NotFoundError } from '../utils/api-error.js'
import { mediaUrl } from '../utils/media.js'
import { isValidSitePage, isValidSupportPage, SUPPORT_PAGES } from '../constants/cms.js'

/**
 * CMS reads — blog, news types, banners and pages.
 *
 * Ported from FrontendController::blog / blogSingle / support, and the banner queries
 * scattered across home() and blog().
 */

const ACTIVE = { isActive: true }

/**
 * BlogPost::scopePublished — active AND (published_at IS NULL OR published_at <= now).
 * A post with no publish date is treated as published, not as a draft.
 */
const publishedWhere = () => ({
  isActive: true,
  OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
})

const POST_INCLUDE = { newsType: { select: { id: true, title: true, slug: true } } }

/** BlogPost::getImageUrlAttribute and its banner counterpart. */
function presentPost(post) {
  if (!post) return null
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    url: `/blog/${post.slug}`,
    image: mediaUrl(post.image, 'frontend/images/blogs/blog-1.jpg'),
    bannerImage: post.bannerImage ? mediaUrl(post.bannerImage) : null,
    authorName: post.authorName,
    excerpt: post.excerpt,
    content: post.content,
    commentsCount: post.commentsCount,
    isFeatured: post.isFeatured,
    publishedAt: post.publishedAt,
    newsType: post.newsType ?? null,
  }
}

/** Card shape — no `content`, so listing pages do not ship every post's full body. */
const presentPostCard = (post) => {
  const presented = presentPost(post)
  if (!presented) return null
  const { content, ...card } = presented
  return card
}

function presentBanner(banner) {
  if (!banner) return null
  return {
    id: banner.id,
    title: banner.title,
    section: banner.section,
    subtitle: banner.subtitle,
    description: banner.description,
    buttonText: banner.buttonText,
    buttonLink: banner.buttonLink,
    buttonText2: banner.buttonText2,
    buttonLink2: banner.buttonLink2,
    images: (banner.images ?? []).map((image) => ({
      id: image.id,
      image: mediaUrl(image.image),
      mobileImage: image.mobileImage ? mediaUrl(image.mobileImage) : null,
      title: image.title,
      subtitle: image.subtitle,
      buttonText: image.buttonText,
      buttonLink: image.buttonLink,
    })),
  }
}

// ─────────────────────────────────────────────────────── banners

/** First active banner in a section, with its active images ordered by sort_order. */
export async function getBannerBySection(section) {
  const banner = await prisma.banner.findFirst({
    where: { section, ...ACTIVE },
    include: { images: { where: ACTIVE, orderBy: { sortOrder: 'asc' } } },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  })
  return presentBanner(banner)
}

/** All active banners grouped by section — used by layout chrome (top strip, mega menu). */
export async function getBannersBySections(sections = []) {
  const banners = await prisma.banner.findMany({
    where: { ...ACTIVE, ...(sections.length ? { section: { in: sections } } : {}) },
    include: { images: { where: ACTIVE, orderBy: { sortOrder: 'asc' } } },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  })

  const grouped = {}
  for (const banner of banners) {
    if (!grouped[banner.section]) grouped[banner.section] = presentBanner(banner)
  }
  return grouped
}

// ─────────────────────────────────────────────────────── blog

export async function listNewsTypes() {
  return prisma.newsType.findMany({
    where: ACTIVE,
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    select: { id: true, title: true, slug: true },
  })
}

/**
 * Blog index — port of FrontendController::blog.
 *
 * The featured post is chosen first, then EXCLUDED from the paginated list so it does not
 * appear twice. Its fallback chain: featured within the active type -> most recent within
 * the active type. Page size is 9.
 */
export async function listBlogPosts({ typeSlug = null, page = 1, perPage = 9 } = {}) {
  const [newsTypes, journalBanner] = await Promise.all([
    listNewsTypes(),
    getBannerBySection('journal_page_banner'),
  ])

  let activeType = null
  if (typeSlug) {
    activeType = await prisma.newsType.findFirst({
      where: { slug: typeSlug, ...ACTIVE },
      select: { id: true, title: true, slug: true },
    })
    // Laravel did not 404 on an unknown ?type= — it fell through to all posts.
  }

  const baseWhere = {
    ...publishedWhere(),
    ...(activeType ? { newsTypeId: activeType.id } : {}),
  }

  let featuredPost = await prisma.blogPost.findFirst({
    where: { ...baseWhere, isFeatured: true },
    include: POST_INCLUDE,
    orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
  })

  if (!featuredPost) {
    featuredPost = await prisma.blogPost.findFirst({
      where: baseWhere,
      include: POST_INCLUDE,
      orderBy: { publishedAt: 'desc' },
    })
  }

  const listWhere = {
    ...baseWhere,
    ...(featuredPost ? { id: { not: featuredPost.id } } : {}),
  }

  const take = Math.min(Math.max(1, perPage), 50)
  const currentPage = Math.max(1, page)

  const [total, posts] = await prisma.$transaction([
    prisma.blogPost.count({ where: listWhere }),
    prisma.blogPost.findMany({
      where: listWhere,
      include: POST_INCLUDE,
      orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
      skip: (currentPage - 1) * take,
      take,
    }),
  ])

  return {
    newsTypes,
    activeType,
    journalBanner,
    featuredPost: presentPostCard(featuredPost),
    posts: posts.map(presentPostCard),
    pagination: {
      page: currentPage,
      perPage: take,
      total,
      lastPage: Math.max(1, Math.ceil(total / take)),
      hasMore: currentPage * take < total,
    },
  }
}

/**
 * Blog detail — port of FrontendController::blogSingle.
 *
 * prev/next navigate by ID, not by publish date. That is what Laravel did, and it is
 * deliberately preserved even though it can disagree with the list ordering.
 */
export async function getBlogPostBySlug(slug) {
  const post = await prisma.blogPost.findFirst({
    where: { slug, ...publishedWhere() },
    include: POST_INCLUDE,
  })
  if (!post) throw new NotFoundError('Post not found.')

  const [relatedPosts, prevPost, nextPost] = await Promise.all([
    prisma.blogPost.findMany({
      where: {
        ...publishedWhere(),
        id: { not: post.id },
        ...(post.newsTypeId ? { newsTypeId: post.newsTypeId } : {}),
      },
      include: POST_INCLUDE,
      orderBy: { publishedAt: 'desc' },
      take: 2,
    }),
    prisma.blogPost.findFirst({
      where: { ...publishedWhere(), id: { lt: post.id } },
      orderBy: { id: 'desc' },
      select: { id: true, title: true, slug: true },
    }),
    prisma.blogPost.findFirst({
      where: { ...publishedWhere(), id: { gt: post.id } },
      orderBy: { id: 'asc' },
      select: { id: true, title: true, slug: true },
    }),
  ])

  return {
    post: presentPost(post),
    relatedPosts: relatedPosts.map(presentPostCard),
    prevPost,
    nextPost,
  }
}

// ─────────────────────────────────────────────────────── pages

/**
 * A CMS page from the `pages` table.
 *
 * See constants/cms.js — this content is currently write-only in the source application
 * (audit R11). Exposed here so it is reachable, not because a storefront view renders it.
 */
export async function getSitePage(slug) {
  if (!isValidSitePage(slug)) throw new NotFoundError('Page not found.')

  const page = await prisma.page.findFirst({ where: { slug, ...ACTIVE } })
  if (!page) throw new NotFoundError('Page not found.')

  return { id: page.id, slug: page.slug, title: page.title, content: page.content }
}

/**
 * Support page metadata. The body lives in React components, exactly as it lived in Blade
 * templates — this only validates the slug and resolves its title, reproducing
 * FrontendController::support's abort(404) for anything off the allow-list.
 */
export function getSupportPage(slug = 'faqs') {
  if (!isValidSupportPage(slug)) throw new NotFoundError('Page not found.')
  return { slug, title: SUPPORT_PAGES[slug] }
}

export default {
  getBannerBySection,
  getBannersBySections,
  listNewsTypes,
  listBlogPosts,
  getBlogPostBySlug,
  getSitePage,
  getSupportPage,
}
