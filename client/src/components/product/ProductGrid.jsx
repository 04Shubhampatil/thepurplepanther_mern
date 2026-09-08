import ProductCard from './ProductCard.jsx'

export default function ProductGrid({ products = [], onWishlist = null, wishlistIds = [], empty = 'No products found.' }) {
  if (!products.length) {
    return (
      <p className="pp-empty" style={{ padding: '40px 0', opacity: 0.7 }}>
        {empty}
      </p>
    )
  }

  return (
    <div className="row">
      {products.map((product) => (
        <div className="col-lg-3 col-md-4 col-sm-6 col-6" key={product.id}>
          <ProductCard
            product={product}
            onWishlist={onWishlist}
            inWishlist={wishlistIds.includes(String(product.id))}
          />
        </div>
      ))}
    </div>
  )
}
