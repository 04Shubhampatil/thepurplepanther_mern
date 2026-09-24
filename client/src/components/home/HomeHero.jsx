import { useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import ThemeSwiper, { SwiperSlide } from '../ui/ThemeSwiper.jsx'

/**
 * The homepage hero — the `.su-banner-5-zoom` slider plus the media orchestration that sat
 * beside it in script.js (`activateHomeHeroMedia` / `scheduleHomeHeroImage`, ~line 926).
 *
 * The slider's own autoplay is OFF, and that is the point: slides advance on a rule Swiper
 * cannot express. An image slide holds for 3.5 seconds; a VIDEO slide holds until the video
 * finishes, however long that is. Leaving `autoplay` on would cut videos off mid-way.
 *
 * The rest of the original's care is kept too:
 *   - only the active slide's video plays, and it restarts from 0 each time
 *   - hovering or focusing the hero postpones an image advance (re-checked every 500ms),
 *     so reading the caption does not get interrupted
 *   - `prefers-reduced-motion` stops the rotation entirely rather than speeding it up
 *   - a video whose `play()` is rejected — an autoplay policy, a codec — falls back to the
 *     image timer instead of leaving the hero stuck on one slide forever
 *
 * ADVANCING IS DONE WITH `slideTo`, NOT `slideNext`, and that is not a style choice. The
 * fade effect runs on `virtualTranslate`, so the wrapper never actually moves; Swiper reads
 * a translate of 0 against a three-snap grid and concludes the slider does not overflow —
 * `isBeginning` and `isEnd` are BOTH true and `allowSlideNext` is false, so `slideNext()`
 * returns without doing anything and the hero sits on slide one forever. `slideTo` has no
 * such guard. The wrap-around is therefore ours, which also means neither `loop` nor
 * `rewind` is needed: Swiper 6 duplicated slides to loop, Swiper 11+ reorders them, and
 * with three fading slides that reordering leaves `activeIndex` stranded on the last one.
 */
const IMAGE_HOLD_MS = 3500
const HOVER_RECHECK_MS = 500

export default function HomeHero({ heroImages, homeHero }) {
  const swiperRef = useRef(null)
  const rootRef = useRef(null)
  const timerRef = useRef(null)

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  /** Next slide, wrapping — see the note above on why this is not `slideNext()`. */
  const advanceSlide = useCallback(() => {
    const swiper = swiperRef.current
    if (!swiper || swiper.destroyed) return

    const count = swiper.slides?.length ?? 0
    if (count < 2) return

    swiper.slideTo((swiper.realIndex + 1) % count)
  }, [])

  const scheduleImageAdvance = useCallback(() => {
    window.clearTimeout(timerRef.current)
    if (reducedMotion) return

    const advance = () => {
      const root = rootRef.current
      // Blade's check: don't move while someone is hovering or tabbing through the hero.
      if (root && (root.matches(':hover') || root.contains(document.activeElement))) {
        timerRef.current = window.setTimeout(advance, HOVER_RECHECK_MS)
        return
      }
      advanceSlide()
    }

    timerRef.current = window.setTimeout(advance, IMAGE_HOLD_MS)
  }, [reducedMotion, advanceSlide])

  const activateMedia = useCallback(() => {
    window.clearTimeout(timerRef.current)

    const swiper = swiperRef.current
    if (!swiper) return

    // `rootRef` is NOT used to find the videos. swiper/react can call `onSwiper` before the
    // parent's ref is attached, and an early return there left the hero with no video
    // playing and no timer pending — permanently stuck on slide one. The slider's own
    // element is always available by the time there is a swiper at all.
    const root = rootRef.current ?? swiper.el
    root.querySelectorAll('video.home21-banner-video').forEach((video) => {
      video.pause()
      video.onended = null
    })

    const activeSlide = swiper.slides?.[swiper.activeIndex]
    const activeVideo = activeSlide?.querySelector('video.home21-banner-video')

    if (!activeVideo || reducedMotion) {
      // A video slide under reduced motion holds for the image interval rather than
      // freezing the hero on a paused first frame forever.
      scheduleImageAdvance()
      return
    }

    activeVideo.currentTime = 0
    activeVideo.onended = () => advanceSlide()

    const played = activeVideo.play()
    if (played && typeof played.catch === 'function') {
      // Autoplay refused, or the file will not decode: fall back to the image timer so the
      // hero keeps moving instead of stopping on a still frame.
      played.catch(() => scheduleImageAdvance())
    }
  }, [reducedMotion, scheduleImageAdvance, advanceSlide])

  // Runs after the first commit, when both refs are certainly attached. `onSwiper` may have
  // fired earlier than this; calling twice is harmless because the first thing this does is
  // clear the pending timer.
  useEffect(() => {
    activateMedia()
  }, [activateMedia])

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const slides = heroImages.length > 0 ? heroImages : [null]

  return (
    <section className="home21-banner" ref={rootRef}>
      <div className="container-fluid p-0">
        <ThemeSwiper
          className="swiper-container su-banner-5-zoom"
          slidesPerView={1}
          speed={900}
          spaceBetween={0}
          effect="fade"
          fadeEffect={{ crossFade: true }}
          parallax={false}
          autoplay={false}
          navigation={{ nextEl: '.su-banner-5-next', prevEl: '.su-banner-5-prev' }}
          onSwiper={(swiper) => {
            swiperRef.current = swiper
            activateMedia()
          }}
          onSlideChangeTransitionStart={activateMedia}
        >
          {slides.map((image, index) =>
            image === null ? (
              <SwiperSlide key="fallback">
                <div className="home21-banner-item">
                  <div
                    className="bg bg-position banner-desktop"
                    style={{ backgroundImage: 'url(/frontend/images/banner-1.jpg)' }}
                  ></div>
                </div>
              </SwiperSlide>
            ) : (
              <SwiperSlide key={image.id ?? index}>
                <div className="home21-banner-item">
                  {/*
                    DESKTOP and MOBILE media are rendered as two layers and swapped by CSS
                    at 767px, never by JavaScript — a width measured in the browser would
                    flash the wrong one on first paint and would be wrong again after a
                    rotate. Each layer is a <video> or a background <div> independently, so
                    a video desktop can pair with an image on phones, or the reverse.

                    With no mobile file uploaded the mobile layer falls back to the desktop
                    one, which is the behaviour every existing banner already had.
                  */}
                  {image.isVideo ? (
                    <video
                      className="bg home21-banner-video banner-media-desktop"
                      muted
                      playsInline
                      preload="metadata"
                      data-swiper-parallax="1000"
                    >
                      <source src={image.image} type={image.videoMimeType} />
                    </video>
                  ) : (
                    <div
                      className="bg bg-position banner-desktop"
                      style={{ backgroundImage: `url(${image.image || '/frontend/images/banner-1.jpg'})` }}
                      data-swiper-parallax="1000"
                    ></div>
                  )}

                  {image.isMobileVideo ? (
                    <video
                      className="bg home21-banner-video banner-media-mobile"
                      muted
                      playsInline
                      preload="metadata"
                      data-swiper-parallax="1000"
                    >
                      <source src={image.mobileImage} type={image.mobileVideoMimeType} />
                    </video>
                  ) : image.mobileImage || !image.isVideo ? (
                    <div
                      className="bg bg-position banner-mobile"
                      style={{
                        backgroundImage: `url(${image.mobileImage || image.image || '/frontend/images/mobile-banner-1.jpg'})`,
                      }}
                      data-swiper-parallax="1000"
                    ></div>
                  ) : null}
                  <span className="overly position-absolute"></span>
                  <div className="container"><div className="row"><div className="col-lg-12"><div className="banner-content">
                    <h3 className="title mb10">{image.title || homeHero?.title}</h3>
                    {(image.subtitle || homeHero?.subtitle) && (
                      <div className="sub-title mb10">{image.subtitle || homeHero?.subtitle}</div>
                    )}
                    <div className="d-sm-flex align-items-center">
                      {(image.buttonText || homeHero?.buttonText) && (
                        <Link
                          className="su-btn-4 rounded-3 su-left-right mb-3 mb-sm-0 mr10"
                          to={image.buttonLink || homeHero?.buttonLink || '/shop'}
                        >
                          <span className="mr10 su-text d-inline-block">
                            {image.buttonText || homeHero?.buttonText}
                          </span>
                        </Link>
                      )}
                    </div>
                  </div></div></div></div>
                </div>
              </SwiperSlide>
            ),
          )}
        </ThemeSwiper>
      </div>
    </section>
  )
}
