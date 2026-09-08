import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import ProductGrid from '../../components/product/ProductGrid.jsx'
import Seo from '../../components/common/Seo.jsx'

/**
 * The brand editorial page. Its own URL is preserved because it is linked from the
 * homepage and carries its own stylesheet (beyond-ordinary.css).
 */
export default function BeyondOrdinary() {
  const { data } = useApi(() => api.catalog.products({ per_page: 8 }), [])

  return (
    <div className="pp-beyond">
      <Seo
        title="Beyond Ordinary"
        description="The thinking behind The Purple Panther: considered design, honest materials."
      />

      <div className="container" style={{ padding: '48px 0', maxWidth: 820 }}>
        <h1>Beyond ordinary</h1>
        <p style={{ fontSize: 18, opacity: 0.85 }}>
          Ordinary is easy. It is the default setting of most things made at scale.
        </p>
        <p>
          We are interested in the opposite: pieces that hold their shape, fabrics that soften
          rather than fray, and details you only notice after a year of wearing something.
        </p>
        <p>
          Every product here is made in a small run. When it sells out, it may not come back,
          and that is deliberate.
        </p>
      </div>

      {data?.products?.length > 0 && (
        <div className="container" style={{ paddingBottom: 48 }}>
          <h2>From the collection</h2>
          <ProductGrid products={data.products} />
        </div>
      )}
    </div>
  )
}
