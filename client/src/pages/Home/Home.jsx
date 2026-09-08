import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import { useConfigStore } from '../../store/index.js'
import Seo from '../../components/common/Seo.jsx'
import ErrorMessage from '../../components/common/ErrorMessage.jsx'
import { ProductGridSkeleton } from '../../components/ui/Skeleton.jsx'
import Container from '../../components/ui/Container.jsx'
import HeroSection from '../../components/home/HeroSection.jsx'
import CollectionSection from '../../components/home/CollectionSection.jsx'
import ProductCarousel from '../../components/home/ProductCarousel.jsx'
import EditorialSection from '../../components/home/EditorialSection.jsx'
import FabricLibrary from '../../components/home/FabricLibrary.jsx'
import JournalSection from '../../components/home/JournalSection.jsx'

/**
 * Homepage.
 *
 * Section order matches the live site exactly:
 *   hero → complete collection → shop the look → our story → popular accessories
 *        → fabric library → journal
 *
 * One request. The server applies every fallback chain (curated → featured → any), so no
 * section can render empty and the client does not need to know the rules.
 */
export default function Home() {
  const { data, error, loading, refetch } = useApi(() => api.catalog.home(), [])
  const categories = useConfigStore((s) => s.categories)

  if (error) {
    return (
      <Container className="py-24">
        <ErrorMessage error={error} onRetry={refetch} />
      </Container>
    )
  }

  if (loading) {
    return (
      <>
        <div className="h-[78vh] min-h-[480px] animate-pulse bg-sand md:h-[92vh]" aria-hidden="true" />
        <Container className="pt-14 md:pt-[90px]">
          <ProductGridSkeleton count={4} />
        </Container>
      </>
    )
  }

  const {
    banners = {},
    shopTheLook = [],
    newArrivals = [],
    popularAccessories = [],
    journalPosts = [],
  } = data ?? {}

  return (
    <>
      <Seo description="Quiet authority for women who move seamlessly from boardroom to dinner." />

      <HeroSection banner={banners.home_hero} />

      <CollectionSection banner={banners.home_complete_collection} categories={categories} />

      <ProductCarousel
        title={banners.home_shoppable_look?.title ?? 'Shop the look'}
        products={shopTheLook}
        to="/shop"
      />

      <ProductCarousel
        title={banners.home_new_arrivals_banner?.title ?? 'New arrivals'}
        products={newArrivals}
        to="/shop"
      />

      <EditorialSection banner={banners.home_our_story} />

      <ProductCarousel title="Popular accessories" products={popularAccessories} to="/accessories" />

      <FabricLibrary banner={banners.home_fabric_library} />

      <JournalSection posts={journalPosts} />
    </>
  )
}
