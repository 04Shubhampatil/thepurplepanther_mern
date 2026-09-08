/** Loading placeholder. Keeps layout stable so content does not jump in. */
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-line/60 ${className}`} aria-hidden="true" />
}

/** Product grid placeholder, matching the card's 3:4 media ratio. */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="aspect-[3/4] w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  )
}

export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

export default Skeleton
