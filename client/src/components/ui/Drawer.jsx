import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'

/**
 * Slide-out panel — replaces the jQuery site-drawers implementation.
 *
 * Accessibility is the reason this is one shared component rather than three ad-hoc
 * panels. It provides, in one place:
 *   · Escape to close
 *   · focus moved into the panel on open, and restored to the trigger on close
 *   · focus trapped inside while open, so Tab cannot reach the page behind
 *   · `aria-modal` and a labelled dialog
 *   · background scroll locked, without the page jumping as the scrollbar disappears
 *
 * Rendered in a portal so a parent's `overflow` or `transform` cannot clip it.
 */
export default function Drawer({
  open,
  onClose,
  side = 'right',
  title,
  children,
  footer = null,
  widthClass = 'w-full max-w-[420px]',
}) {
  const panelRef = useRef(null)
  const previouslyFocused = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    previouslyFocused.current = document.activeElement

    // Compensate for the scrollbar so the page behind does not shift on open.
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    const { overflow, paddingRight } = document.body.style
    document.body.style.overflow = 'hidden'
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return

      const focusable = panelRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const timer = setTimeout(() => panelRef.current?.querySelector('button, a, input')?.focus(), 60)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      clearTimeout(timer)
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
      previouslyFocused.current?.focus?.()
    }
  }, [open, onClose])

  const offscreen = side === 'right' ? '100%' : '-100%'

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100]">
          <motion.div
            className="absolute inset-0 bg-ink/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`absolute inset-y-0 ${side === 'right' ? 'right-0' : 'left-0'} ${widthClass} flex flex-col bg-white shadow-2xl`}
            initial={{ x: offscreen }}
            animate={{ x: 0 }}
            exit={{ x: offscreen }}
            transition={{ type: 'tween', ease: [0.32, 0.72, 0, 1], duration: 0.38 }}
          >
            <header className="flex items-center justify-between border-b border-line px-6 py-5">
              <h2 className="pp-eyebrow text-ink">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={`Close ${String(title).toLowerCase()}`}
                className="-mr-2 p-2 text-ink transition-colors hover:text-brand"
              >
                <X size={20} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

            {footer && <div className="border-t border-line px-6 py-5">{footer}</div>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
