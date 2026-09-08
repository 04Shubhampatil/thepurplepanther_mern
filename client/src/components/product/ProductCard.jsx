import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import Image from '../ui/Image.jsx'
import Badge from '../ui/Badge.jsx'
import WishlistButton from './WishlistButton.jsx'

/**
 * Product grid card.
 *
 * Prices arrive pre-formatted from the server and are rendered as given — the client
 * never formats currency, so there is one implementation and it cannot drift from what
 * checkout charges.
 *
 * `discountPercent` likewise comes from the server, which already applies the rule that an
 * attached offer takes precedence over the computed MRP difference.
 */
export default function ProductCard({ product, index = 0, showWishlist = true, eager = false }) {
  if (!product) return null

  const variants = [...(product.colors ?? []), ...(product.sizes ?? [])]
  const outOfStock = variants.length > 0 && variants.every((v) => Number(v.quantity) === 0)

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45, delay: Math.min(index, 7) * 0.05 }}
      className="group flex flex-col"
    >
      <div className="relative">
        <Link to={product.url} tabIndex={-1} aria-hidden="true">
          <Image
            src={product.image}
            hoverSrc={product.hoverImage !== product.image ? product.hoverImage : null}
            alt={product.title}
            ratio="product"
            eager={eager}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          />
        </Link>

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {product.discountPercent > 0 && <Badge>{product.discountPercent}% off</Badge>}
          {product.isNewArrival && <Badge tone="light">New</Badge>}
          {outOfStock && <Badge tone="muted">Out of stock</Badge>}
        </div>

        {showWishlist && (
          <div className="absolute right-3 top-3 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100">
            <WishlistButton productId={product.id} productTitle={product.title} />
          </div>
        )}
      </div>

      <div className="mt-3.5 flex flex-col gap-1">
        <h3 className="text-[14px] leading-snug text-ink">
          <Link
            to={product.url}
            className="line-clamp-2 transition-colors duration-200 hover:text-brand"
          >
            {product.title}
          </Link>
        </h3>

        <p className="flex items-baseline gap-2 text-[14px]">
          <span className="font-medium text-ink">{product.priceFormatted}</span>
          {product.discountPercent > 0 && (
            <del className="text-[13px] text-body/70">{product.mrpFormatted}</del>
          )}
        </p>
      </div>
    </motion.article>
  )
}
