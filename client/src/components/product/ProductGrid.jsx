import ProductCard from './ProductCard.jsx'
import { ProductGridSkeleton } from '../ui/Skeleton.jsx'

/**
 * Responsive product grid: 2 columns on mobile, 3 on tablet, 4 on desktop — matching the
 * live site rather than shrinking a desktop layout.
 */
export default function ProductGrid({
  products = [],
  loading = false,
  skeletonCount = 8,
  empty = 'No products found.',
  columns = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  eagerCount = 4,
}) {
  if (loading && products.length === 0) return <ProductGridSkeleton count={skeletonCount} />

  if (products.length === 0) {
    return <p className="py-16 text-center text-body">{empty}</p>
  }

  return (
    <div className={`grid gap-x-4 gap-y-10 md:gap-x-6 ${columns}`}>
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          index={index}
          eager={index < eagerCount}
        />
      ))}
    </div>
  )
}
