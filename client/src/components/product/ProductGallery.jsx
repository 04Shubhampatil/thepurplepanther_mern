import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X, ChevronLeft, ChevronRight, Expand } from 'lucide-react'
import Image from '../ui/Image.jsx'

/**
 * Product gallery with a lightbox — replaces Magnific Popup.
 *
 * The lightbox provides what the jQuery plugin did, natively:
 *   · Escape to close, arrow keys to navigate
 *   · backdrop click to dismiss
 *   · focus returned to the trigger on close
 *   · body scroll locked while open
 *
 * Thumbnails are a plain scrollable strip rather than a carousel: the original is a static
 * grid, and the brief is explicit that a carousel should not be introduced where one did
 * not exist.
 */
export default function ProductGallery({ images = [], title = '' }) {
  const [active, setActive] = useState(0)
  const [lightbox, setLightbox] = useState(false)

  const gallery = images.length > 0 ? images : [null]
  const go = (delta) => setActive((i) => (i + delta + gallery.length) % gallery.length)

  useEffect(() => {
    if (!lightbox) return undefined

    const previous = document.activeElement
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const onKey = (e) => {
      if (e.key === 'Escape') setLightbox(false)
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [lightbox, gallery.length])

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="group relative">
          <Image src={gallery[active]} alt={title} ratio="product" eager />

          <button
            type="button"
            onClick={() => setLightbox(true)}
            aria-label="View image full screen"
            className="absolute right-3 top-3 grid size-9 place-items-center bg-white/90 text-ink opacity-0 transition-opacity hover:text-brand focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Expand size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>

          {gallery.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center bg-white/90 text-ink opacity-0 transition-opacity hover:text-brand focus-visible:opacity-100 group-hover:opacity-100"
              >
                <ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next image"
                className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center bg-white/90 text-ink opacity-0 transition-opacity hover:text-brand focus-visible:opacity-100 group-hover:opacity-100"
              >
                <ChevronRight size={18} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        {gallery.length > 1 && (
          <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Product images">
            {gallery.map((src, index) => (
              <li key={`${src}-${index}`} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setActive(index)}
                  aria-label={`Show image ${index + 1} of ${gallery.length}`}
                  aria-current={index === active}
                  className={`block w-[68px] border-2 transition-colors ${
                    index === active ? 'border-brand' : 'border-transparent hover:border-line'
                  }`}
                >
                  <Image src={src} alt="" ratio="product" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {createPortal(
        <AnimatePresence>
          {lightbox && (
            <motion.div
              className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/90 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              role="dialog"
              aria-modal="true"
              aria-label={`${title} — image ${active + 1} of ${gallery.length}`}
              onClick={() => setLightbox(false)}
            >
              <button
                type="button"
                onClick={() => setLightbox(false)}
                aria-label="Close image viewer"
                className="absolute right-5 top-5 grid size-11 place-items-center text-white transition-opacity hover:opacity-70"
              >
                <X size={24} strokeWidth={1.5} aria-hidden="true" />
              </button>

              {gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      go(-1)
                    }}
                    aria-label="Previous image"
                    className="absolute left-4 grid size-11 place-items-center text-white transition-opacity hover:opacity-70"
                  >
                    <ChevronLeft size={26} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      go(1)
                    }}
                    aria-label="Next image"
                    className="absolute right-4 grid size-11 place-items-center text-white transition-opacity hover:opacity-70"
                  >
                    <ChevronRight size={26} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </>
              )}

              <motion.img
                key={active}
                src={gallery[active]}
                alt={`${title} — image ${active + 1}`}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                onClick={(e) => e.stopPropagation()}
                className="max-h-[88vh] max-w-[92vw] object-contain"
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
