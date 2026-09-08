/**
 * Hosting the Laravel theme's own JavaScript inside a single-page app.
 *
 * `public/frontend/js/script.js` is a 3,479-line IIFE that runs everything at parse time:
 * mmenu, the fixed-header scroll handler, magnific popups, jarallax, the colour swatches,
 * dozens of delegated `$(document).on(...)` handlers — and 82 `new Swiper(...)` calls.
 *
 * Blade loaded it once per full page load, so "runs once, against the finished DOM" was
 * always true. Here it is not: the DOM changes on every route. Two rules follow.
 *
 *   1. script.js is loaded EXACTLY ONCE, after React's first commit. Re-running it would
 *      duplicate every delegated handler and build a second mmenu inside the first.
 *
 *   2. React owns the sliders. Swiper is the one part of script.js that is per-page, and a
 *      Swiper bound to markup that React later unmounts keeps a timer pointed at dead
 *      nodes — the home hero's `slideNext()` loop being the loud example. So script.js is
 *      executed with a NO-OP Swiper stub in place, and `theme/sliders.js` re-creates each
 *      page's sliders from the same option objects, copied verbatim.
 *
 * Everything else in script.js runs exactly as it did in Laravel.
 */

const THEME_JS = '/frontend/js/script.js?v=banner-video-2'

let bootPromise = null

/**
 * A Swiper that does nothing but answer the questions script.js asks of one.
 *
 * script.js does not just construct sliders; it calls `.on()`, reads `.slides` and
 * `.activeIndex`, and calls `.slideNext()` on the instances it made. The stub has to
 * satisfy all of that silently, or the file throws part-way through and the rest of the
 * theme — mmenu included — never initialises.
 */
function makeSwiperStub(RealSwiper) {
  function SwiperStub() {
    this.slides = []
    this.activeIndex = 0
    this.realIndex = 0
    this.params = {}
    // Paired sliders assign through this — `textslider.controller.control = imgslider`
    // (script.js:902, 1245, 2439). Without it the assignment throws and everything
    // after that line in the file, including the magnific and jarallax setup, is skipped.
    this.controller = {}
    this.thumbs = {}
  }

  const noop = function () {
    return this
  }

  Object.assign(SwiperStub.prototype, {
    on: noop,
    off: noop,
    once: noop,
    update: noop,
    destroy: noop,
    slideNext: noop,
    slidePrev: noop,
    slideTo: noop,
    autoplay: { start: () => {}, stop: () => {} },
    navigation: { update: () => {} },
    pagination: { update: () => {} },
  })

  // Static members some plugins read off the constructor.
  SwiperStub.use = () => {}
  SwiperStub.__real = RealSwiper

  return SwiperStub
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = src
    el.async = false
    el.onload = () => resolve()
    el.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.body.appendChild(el)
  })
}

/**
 * Load script.js once. Resolves when the theme has initialised.
 *
 * Called from StoreLayout after the first render, so the header, footer and `#menu` that
 * script.js reaches for are already in the document — the same ordering Blade gave it by
 * putting the tag before `</body>`.
 */
export function bootTheme() {
  if (bootPromise) return bootPromise

  const RealSwiper = window.Swiper
  window.Swiper = makeSwiperStub(RealSwiper)

  bootPromise = loadScript(THEME_JS)
    .catch((error) => {
      // A missing theme file must not take the app down with it: React still renders and
      // the CSS still applies, only the jQuery flourishes are gone.
      console.error('[theme] script.js did not load', error)
    })
    .finally(() => {
      window.Swiper = RealSwiper
    })

  return bootPromise
}

/**
 * Re-run the plugin initialisers that script.js only ever ran once.
 *
 * Options are copied verbatim from script.js (jarallax ~line 2711, magnific ~line 2854) so
 * a lightbox opened from a route change behaves like one opened from a cold page load.
 */
export function initPagePlugins() {
  const $ = window.jQuery
  if (!$) return

  if ($('.jarallax').length > 0 && $.fn.jarallax) {
    $('.jarallax').jarallax({ speed: 0.2, imgWidth: 1200, imgHeight: 520 })
  }

  if (!$.fn.magnificPopup) return

  $('.popup-img').magnificPopup({ type: 'image', gallery: { enabled: true } })
  $('.popup-img-single').magnificPopup({ type: 'image', gallery: { enabled: false } })
  $('.popup-iframe').magnificPopup({
    disableOn: 700,
    type: 'iframe',
    preloader: false,
    fixedContentPos: false,
  })
  $('.popup-youtube, .popup-vimeo, .popup-gmaps').magnificPopup({
    disableOn: 700,
    type: 'iframe',
    mainClass: 'mfp-fade',
    removalDelay: 160,
    preloader: false,
    fixedContentPos: false,
  })
  $('.popup-image').magnificPopup({ type: 'image', gallery: { enabled: true } })
  $('.popup-video').magnificPopup({ type: 'iframe' })
}

/**
 * `<div class="bg" data-background="...">` is the theme's own lazy background convention;
 * script.js applies it on load. New markup from a route change needs the same pass.
 */
export function applyDataBackgrounds(root = document) {
  root.querySelectorAll('[data-background]').forEach((el) => {
    const url = el.getAttribute('data-background')
    if (url) el.style.backgroundImage = `url(${url})`
  })
}
