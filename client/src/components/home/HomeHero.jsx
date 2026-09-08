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
      swiperRef.current?.slideNext()
    }

    timerRef.current = window.setTimeout(advance, IMAGE_HOLD_MS)
  }, [reducedMotion])

  const activateMedia = useCallback(() => {
    window.clearTimeout(timerRef.current)

    const root = rootRef.current
    if (!root) return

    root.querySelectorAll('video.home21-banner-video').forEach((video) => {
      video.pause()
      video.onended = null
    })

    const swiper = swiperRef.current
    const activeSlide = swiper?.slides?.[swiper.activeIndex]
    const activeVideo = activeSlide?.querySelector('video.home21-banner-video')

    if (!activeVideo) {
      scheduleImageAdvance()
      return
    }

    activeVideo.currentTime = 0
    activeVideo.onended = () => swiperRef.current?.slideNext()

    if (reducedMotion) return

    const played = activeVideo.play()
    if (played && typeof played.catch === 'function') {
      played.catch(() => scheduleImageAdvance())
    }
  }, [reducedMotion, scheduleImageAdvance])

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
          loop={slides.length > 1}
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
                  {image.isVideo ? (
                    <video
                      className="bg home21-banner-video"
                      muted
                      playsInline
                      preload="metadata"
                      data-swiper-parallax="1000"
                    >
                      <source src={image.image} type={image.videoMimeType} />
                    </video>
                  ) : (
                    <>
                      <div
                        className="bg bg-position banner-desktop"
                        style={{ backgroundImage: `url(${image.image || '/frontend/images/banner-1.jpg'})` }}
                        data-swiper-parallax="1000"
                      ></div>
                      <div
                        className="bg bg-position banner-mobile"
                        style={{
                          backgroundImage: `url(${image.mobileImage || image.image || '/frontend/images/mobile-banner-1.jpg'})`,
                        }}
                        data-swiper-parallax="1000"
                      ></div>
                    </>
                  )}
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
