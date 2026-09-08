import { useEffect } from 'react'

/**
 * WOW.js's job, done with IntersectionObserver.
 *
 * WORTH KNOWING BEFORE CHANGING THIS: wow.min.js was loaded by the Blade pages but never
 * initialised — nothing ever called `new WOW().init()`. So `.wow` elements were plain
 * visible elements whose `fadeInUp` animation (defined in style.css) ran once at page load,
 * all together, with every `data-wow-delay` and `data-wow-duration` in the markup ignored.
 *
 * This does what that markup asks for: hold the element until it scrolls into view, then
 * run the animation with the delay and duration the author wrote. Above the fold nothing
 * changes — those elements are already intersecting on the first frame — but a `.wow`
 * further down now animates when it is reached rather than while it is off-screen, and the
 * staggered delays finally apply.
 *
 * `rootMargin` brings the trigger slightly inside the viewport so the animation is not
 * already finished by the time the element is properly on screen. `once: true` matches
 * WOW's default — a revealed element stays revealed.
 */
const REVEALED = 'is-revealed'

export function useReveal(deps = []) {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('.wow:not(.' + REVEALED + ')'))
    if (elements.length === 0) return undefined

    // Without IntersectionObserver, show everything rather than hiding it forever.
    if (typeof IntersectionObserver === 'undefined') {
      elements.forEach((el) => el.classList.add(REVEALED))
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return

          const el = entry.target
          const delay = el.dataset.wowDelay
          const duration = el.dataset.wowDuration
          if (delay) el.style.animationDelay = delay
          if (duration) el.style.animationDuration = duration

          el.classList.add(REVEALED)
          observer.unobserve(el)
        })
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0 },
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export default useReveal
