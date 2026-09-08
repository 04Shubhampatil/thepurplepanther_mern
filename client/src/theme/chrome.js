import { useEffect, useState } from 'react'

/**
 * The window-scroll behaviours that were spread across script.js and site-drawers.js.
 *
 * Both are here rather than in the components that use them because they share one
 * requirement: a scroll listener must be passive and must not do layout work on every
 * event. The originals differed — script.js bound a plain handler, site-drawers.js used
 * requestAnimationFrame — and the rAF version is the one worth keeping.
 */

/** site-drawers.js `initStickyHeader` — `.site-header-fixed` past 160px. */
export function useStickyHeader() {
  const [fixed, setFixed] = useState(false)

  useEffect(() => {
    let ticking = false

    const update = () => {
      setFixed(window.scrollY > 160)
      ticking = false
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return fixed
}

/** script.js `scrollToTop` — `.scrollToHome` gets `.show` past 300px. */
export function useScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let ticking = false

    const update = () => {
      setVisible(window.scrollY > 300)
      ticking = false
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return visible
}

/**
 * Lock the page behind an open drawer.
 *
 * mmenu did this by putting `mm-wrapper_blocking` on <body> and letting its own stylesheet
 * set `overflow: hidden`. The classes are still written (the theme styles the slide-out
 * against them) but the scroll lock is applied here so it does not depend on which of the
 * theme's stylesheets happens to be loaded.
 */
export function useScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previous
    }
  }, [locked])
}

/** Add classes to <body> for as long as the calling component wants them. */
export function useBodyClasses(classes, active = true) {
  const key = classes.filter(Boolean).join(' ')

  useEffect(() => {
    const applied = key.split(' ').filter(Boolean)
    if (!active || applied.length === 0) return undefined

    document.body.classList.add(...applied)
    return () => document.body.classList.remove(...applied)
  }, [key, active])
}
