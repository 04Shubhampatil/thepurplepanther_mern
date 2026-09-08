import prisma from '../config/database.js'
import { NotFoundError } from '../utils/api-error.js'
import { ROLES } from '../constants/roles.js'

/**
 * Product reviews — port of FrontendController::storeProductReview.
 *
 * Two behaviours worth stating explicitly, both preserved:
 *
 * 1. Reviews are created with is_active = true, so they appear immediately. There is NO
 *    moderation queue on the storefront path; admins can only deactivate afterwards
 *    (Admin\ProductController::toggleReview). Changing this to opt-in moderation would be
 *    a product decision, not a migration one.
 *
 * 2. Reviews are NOT gated on having purchased the product, and a guest may review by
 *    supplying any name and email. When the reviewer is not signed in, Laravel looked the
 *    email up against customer accounts and attached user_id if one matched — so a review
 *    can be linked to an account the submitter did not authenticate as. Preserved for
 *    parity; flagged in docs/migration-status.md as a deferred improvement.
 */
export async function createProductReview({ slug, rating, comment, reviewerName, reviewerEmail, userId = null }) {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    select: { id: true },
  })
  if (!product) throw new NotFoundError('Product not found.')

  let resolvedUserId = userId ? BigInt(userId) : null

  if (!resolvedUserId) {
    const match = await prisma.user.findFirst({
      where: { email: reviewerEmail.toLowerCase(), role: ROLES.CUSTOMER },
      select: { id: true },
    })
    resolvedUserId = match?.id ?? null
  }

  return prisma.productReview.create({
    data: {
      productId: product.id,
      userId: resolvedUserId,
      reviewerName,
      reviewerEmail,
      rating,
      comment,
      isActive: true,
    },
  })
}

export default { createProductReview }
