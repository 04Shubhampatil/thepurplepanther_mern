import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import ProductGrid from '../../components/product/ProductGrid.jsx'
import Seo from '../../components/common/Seo.jsx'
import Container from '../../components/ui/Container.jsx'
import SectionHeading from '../../components/ui/SectionHeading.jsx'

/**
 * The brand editorial page.
 *
 * Its own URL is preserved because it is linked from the homepage. In Laravel it carried a
 * dedicated stylesheet (beyond-ordinary.css); that file is gone — the layout is now the
 * same tokens and container as every other page.
 */
export default function BeyondOrdinary() {
  const { data } = useApi(() => api.catalog.products({ per_page: 8 }), [])

  return (
    <div>
      <Seo
        title="Beyond Ordinary"
        description="The thinking behind The Purple Panther: considered design, honest materials."
      />

      <Container className="py-14 md:py-20">
        <div className="mx-auto max-w-[820px] text-center">
          <h1 className="pp-display">Beyond ordinary</h1>

          <p className="mt-6 text-[18px] leading-relaxed text-ink">
            Ordinary is easy. It is the default setting of most things made at scale.
          </p>

          <p className="mt-4 leading-[1.9]">
            We are interested in the opposite: pieces that hold their shape, fabrics that soften
            rather than fray, and details you only notice after a year of wearing something.
          </p>

          <p className="mt-4 leading-[1.9]">
            Every product here is made in a small run. When it sells out, it may not come back,
            and that is deliberate.
          </p>
        </div>
      </Container>

      {data?.products?.length > 0 && (
        <Container className="pb-14 md:pb-20">
          <SectionHeading title="From the collection" to="/shop" linkLabel="Shop all" />
          <ProductGrid products={data.products} />
        </Container>
      )}
    </div>
  )
}
