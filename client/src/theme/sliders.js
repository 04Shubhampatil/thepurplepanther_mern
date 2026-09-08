import { useEffect, useRef } from 'react'

/**
 * Swiper configurations, copied VERBATIM from public/frontend/js/script.js.
 *
 * The line references are to that file. Do not "tidy" these objects — the speeds, the
 * fractional slidesPerView and the breakpoints are what make the sliders look like the
 * ones on the live site. If a slider needs changing, change it there first and copy it
 * back, so the two stay in step for as long as both exist.
 */
export const SLIDER_CONFIGS = {
  // script.js:635 — the header offer ticker.
  'one-grid-slider': {
    slidesPerView: 1,
    speed: 1500,
    spaceBetween: 0,
    loop: true,
    parallax: true,
    autoplay: { delay: 3500 },
    navigation: { nextEl: '.su-banner-4-next, .next', prevEl: '.su-banner-4-prev, .prev' },
    pagination: { el: '.swiper-pagination', type: 'fraction' },
  },

  // script.js:908 — the homepage hero.
  'su-banner-5-zoom': {
    slidesPerView: 1,
    speed: 900,
    spaceBetween: 0,
    loop: true,
    effect: 'fade',
    fadeEffect: { crossFade: true },
    parallax: false,
    autoplay: false,
    navigation: { nextEl: '.su-banner-5-next', prevEl: '.su-banner-5-prev' },
  },

  // script.js:976
  'home-accessories-slider': {
    slidesPerView: 1.25,
    spaceBetween: 12,
    speed: 700,
    watchOverflow: true,
    navigation: { nextEl: '.home-accessories-next', prevEl: '.home-accessories-prev' },
    breakpoints: {
      768: { slidesPerView: 2.4, spaceBetween: 16 },
      1200: { slidesPerView: 4, spaceBetween: 20 },
    },
  },

  // script.js:993
  'home-fabric-slider': {
    slidesPerView: 1.08,
    spaceBetween: 12,
    speed: 700,
    watchOverflow: true,
    navigation: { nextEl: '.home-fabric-next', prevEl: '.home-fabric-prev' },
    breakpoints: {
      768: { slidesPerView: 1.4, spaceBetween: 20 },
      1200: { slidesPerView: 2, spaceBetween: 30 },
    },
  },

  // script.js:1010
  'home-journal-slider': {
    slidesPerView: 'auto',
    spaceBetween: 20,
    speed: 700,
    watchOverflow: true,
    navigation: { nextEl: '.home-journal-next', prevEl: '.home-journal-prev' },
  },

  // script.js:1506 — the new-arrivals slider beside the editorial image.
  'su-banner-16-zoom': {
    slidesPerView: 1,
    speed: 1500,
    spaceBetween: 0,
    loop: true,
    parallax: true,
    autoplay: { delay: 3500 },
    navigation: {
      nextEl: '.su-banner-16-next, .swiper-button-next, .next',
      prevEl: '.su-banner-16-prev, .swiper-button-prev, .prev',
    },
    pagination: { el: '.swiper-pagination', clickable: true },
  },

  // script.js:1581 — the product carousel.
  'product-12-slider': {
    speed: 700,
    spaceBetween: 5,
    loop: true,
    navigation: { nextEl: '.next', prevEl: '.prev' },
    autoplay: { delay: 4000 },
    breakpoints: {
      1400: { slidesPerView: 4 },
      1200: { slidesPerView: 4 },
      991: { slidesPerView: 3 },
      768: { slidesPerView: 2 },
      576: { slidesPerView: 2 },
      0: { slidesPerView: 1 },
    },
  },
}

/**
 * Create the named sliders for the page that is currently mounted, and destroy them again
 * when it unmounts.
 *
 * `ready` exists because a slider built over an empty `.swiper-wrapper` measures nothing
 * and then never recovers: Swiper caches slide widths at construction. Pages pass their
 * loading flag so construction waits for the data.
 *
 *   useSliders(['su-banner-5-zoom'], !loading)
 */
export function useSliders(names, ready = true) {
  const key = names.join('|')
  const instances = useRef([])

  useEffect(() => {
    if (!ready || !window.Swiper) return undefined

    const created = names.flatMap((name) => {
      const config = SLIDER_CONFIGS[name]
      if (!config) {
        console.warn(`[theme] no slider config named "${name}"`)
        return []
      }

      return Array.from(document.querySelectorAll(`.${name}`)).map((el) => {
        // Belt and braces: if anything else already claimed this element, take it back
        // rather than stacking a second instance on top of it.
        if (el.swiper) el.swiper.destroy(true, true)
        return new window.Swiper(el, config)
      })
    })

    instances.current = created

    return () => {
      created.forEach((instance) => {
        if (instance && !instance.destroyed) instance.destroy(true, true)
      })
      instances.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready])

  return instances
}
