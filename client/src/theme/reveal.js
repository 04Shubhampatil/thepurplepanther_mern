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
 * further down now animates when it is reached, and the staggered delays finally apply.
 *
 * TWO THINGS THAT ARE EASY TO GET WRONG HERE, BOTH LEARNED THE HARD WAY:
 *
 * 1. A one-shot querySelectorAll is not enough. Pages fetch their content, so at the moment
 *    this hook runs the route is usually still rendering a spinner and there are no `.wow`
 *    elements to observe yet. A MutationObserver picks up whatever arrives later.
 *
 * 2. The stylesheet hides `.wow` until revealed, so if this hook never ran the page would
 *    have invisible holes in it. The CSS is therefore scoped to `html.js-reveal`, and that
 *    class is set HERE — no hook, no hiding, and the worst case is the pre-existing
 *    behaviour of everything animating at load.
 */
const REVEALED = 'is-revealed'
const ENABLED = 'js-reveal'

export function useReveal(deps = []) {
  useEffect(() => {
    // Without IntersectionObserver, never hide anything.
    if (typeof IntersectionObserver === 'undefined') return undefined

    const root = document.documentElement
    root.classList.add(ENABLED)

    const intersection = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return

          const el = entry.target
          const { wowDelay, wowDuration } = el.dataset
          if (wowDelay) el.style.animationDelay = wowDelay
          if (wowDuration) el.style.animationDuration = wowDuration

          el.classList.add(REVEALED)
          intersection.unobserve(el)
        })
      },
      // Pull the trigger slightly inside the viewport so the animation is not already
      // finished by the time the element is properly on screen.
      { rootMargin: '0px 0px -10% 0px', threshold: 0 },
    )

    const observe = (scope) => {
      if (scope.nodeType !== 1) return
      if (scope.matches?.('.wow') && !scope.classList.contains(REVEALED)) intersection.observe(scope)
      scope.querySelectorAll?.(`.wow:not(.${REVEALED})`).forEach((el) => intersection.observe(el))
    }

    observe(document.body)

    // Route content arrives after this hook runs, so watch for it rather than assuming.
    const mutation = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach(observe))
    })
    mutation.observe(document.body, { childList: true, subtree: true })

    return () => {
      mutation.disconnect()
      intersection.disconnect()
      root.classList.remove(ENABLED)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export default useReveal
