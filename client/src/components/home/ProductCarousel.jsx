import { useRef } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, A11y, FreeMode } from 'swiper/modules'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import ProductCard from '../product/ProductCard.jsx'
import Section from '../ui/Section.jsx'
import SectionHeading from '../ui/SectionHeading.jsx'
import 'swiper/css'
import 'swiper/css/free-mode'

/**
 * Horizontal product carousel.
 *
 * Swiper is used here because the live site's "Shop the Look" and "Popular Accessories"
 * rows genuinely scroll horizontally and are swipeable on touch. It is deliberately NOT
 * used for the shop grid or collection tiles, which are static grids in the original — the
 * brief is explicit that a carousel must not be introduced where one did not exist.
 *
 * Only the modules actually needed are imported, and only two small Swiper stylesheets,
 * rather than the full bundle.
 */
export default function ProductCarousel({ title, eyebrow = null, products = [], to = null, linkLabel = 'View all' }) {
  const prevRef = useRef(null)
  const nextRef = useRef(null)

  if (!products.length) return null

  const arrow =
    'grid size-10 place-items-center border border-line text-ink transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-30'

  return (
    <Section>
      <div className="mb-8 flex items-end justify-between gap-4 md:mb-10">
        <SectionHeading title={title} eyebrow={eyebrow} to={to} linkLabel={linkLabel} className="!mb-0 flex-1" />

        {/* Hidden from assistive tech: the slides remain reachable by keyboard and the
            list scrolls natively, so these are a pointer affordance only. */}
        <div className="hidden shrink-0 gap-2 sm:flex" aria-hidden="true">
          <button type="button" ref={prevRef} className={arrow} tabIndex={-1}>
            <ChevronLeft size={18} strokeWidth={1.5} />
          </button>
          <button type="button" ref={nextRef} className={arrow} tabIndex={-1}>
            <ChevronRight size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <Swiper
        modules={[Navigation, A11y, FreeMode]}
        spaceBetween={16}
        slidesPerView={1.35}
        freeMode={{ enabled: true, sticky: false }}
        onBeforeInit={(swiper) => {
          // The refs are not attached when Swiper reads params, so they are assigned here.
          swiper.params.navigation.prevEl = prevRef.current
          swiper.params.navigation.nextEl = nextRef.current
        }}
        navigation={{ prevEl: prevRef.current, nextEl: nextRef.current }}
        a11y={{
          prevSlideMessage: 'Previous products',
          nextSlideMessage: 'Next products',
          containerMessage: title,
        }}
        breakpoints={{
          640: { slidesPerView: 2.4, spaceBetween: 20 },
          1024: { slidesPerView: 3.4, spaceBetween: 24 },
          1280: { slidesPerView: 4, spaceBetween: 24 },
        }}
        // Swiper must clip its own overflow. Leaving it visible lets the "peek" slide
        // extend past the viewport and gives the whole document a horizontal scrollbar.
        className="!overflow-hidden"
      >
        {products.map((product, index) => (
          <SwiperSlide key={product.id} className="!h-auto">
            <ProductCard product={product} index={index} eager={index < 4} />
          </SwiperSlide>
        ))}
      </Swiper>
    </Section>
  )
}
