import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Centred modal dialog — the replacement for Magnific Popup and for the ad-hoc
 * fixed-position divs the first pass used.
 *
 * Like Drawer, it exists once so the accessibility work is done once:
 *   · Escape closes
 *   · clicking the backdrop closes, clicking inside does not
 *   · focus moves in on open and returns to the trigger on close
 *   · Tab is trapped inside while open
 *   · `role="dialog"` + `aria-modal` + a labelled title
 *   · background scroll locked without the page shifting
 *
 * Rendered in a portal so no ancestor's overflow or transform can clip it.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer = null,
  widthClass = 'max-w-[680px]',
}) {
  const panelRef = useRef(null)
  const previouslyFocused = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    previouslyFocused.current = document.activeElement

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

      const focusable = panelRef.current.querySelectorAll(FOCUSABLE)
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
    const timer = setTimeout(() => panelRef.current?.querySelector(FOCUSABLE)?.focus(), 60)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      clearTimeout(timer)
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
      previouslyFocused.current?.focus?.()
    }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div
            className="absolute inset-0 bg-ink/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 16, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.99 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className={`relative flex max-h-[92vh] w-full flex-col bg-white shadow-2xl ${widthClass}`}
          >
            <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
              <h2 className="text-[18px] font-semibold text-ink">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="-mr-2 -mt-1 p-2 text-body transition-colors hover:text-brand"
              >
                <X size={20} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

            {footer && (
              <div className="border-t border-line px-5 py-4 sm:px-6">{footer}</div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
