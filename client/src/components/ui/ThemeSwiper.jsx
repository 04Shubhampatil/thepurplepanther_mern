import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, EffectFade, Navigation, Pagination, Parallax } from 'swiper/modules'

import 'swiper/css'
import 'swiper/css/effect-fade'
import 'swiper/css/navigation'
import 'swiper/css/pagination'

/**
 * The theme's sliders, on swiper/react instead of the bundled Swiper 6 global.
 *
 * Swiper 6 shipped every module; Swiper 14 is opt-in, so the five the theme's option
 * objects actually use are registered here — autoplay, fade, navigation, pagination and
 * parallax. A slider whose config names `autoplay` without the module loaded silently
 * does not autoplay, which is the sort of thing nobody notices for a week.
 *
 * IMPORTANT — the CSS imports above are not optional. style.css carries Swiper 6's
 * stylesheet, which keys off `.swiper-container-*`; Swiper 14 writes `.swiper-*`, so
 * `.swiper-container-fade` never matches and a fade slider stacks all its slides on top of
 * each other. Swiper 14's own CSS is imported to style the classes it actually emits. The
 * old v6 rules still apply harmlessly to the `swiper-container` class the Blade markup
 * hard-codes, and the two agree about `.swiper-wrapper` and `.swiper-slide`.
 *
 * `className` receives the theme's own hooks (`su-banner-5-zoom`, `product-12-slider`, …)
 * because custom.css sizes and spaces the sliders through them — those are load-bearing,
 * not leftovers from how the slider used to be constructed.
 */
const MODULES = [Autoplay, EffectFade, Navigation, Pagination, Parallax]

export default function ThemeSwiper({ className = '', children, ...options }) {
  return (
    <Swiper className={className} modules={MODULES} {...options}>
      {children}
    </Swiper>
  )
}

export { SwiperSlide }
