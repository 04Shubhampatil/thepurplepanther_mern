import { useState } from 'react'

const RATIOS = {
  product: 'aspect-[3/4]',
  portrait: 'aspect-[2/3]',
  square: 'aspect-square',
  wide: 'aspect-[16/9]',
  editorial: 'aspect-[4/5]',
  auto: '',
}

const VIDEO = ['.mp4', '.webm', '.ogg', '.mov']
export const isVideo = (src) =>
  typeof src === 'string' && VIDEO.some((ext) => src.toLowerCase().split('?')[0].endsWith(ext))

/**
 * Media element for products and editorial imagery.
 *
 * Three things it exists to guarantee:
 *
 * 1. **No layout shift.** The ratio wrapper reserves space before the file loads, so a
 *    product grid does not reflow as images arrive.
 * 2. **Video support.** `banner_images.image` holds whatever was uploaded, and the live
 *    homepage hero is an `.mp4`. Rendering that in an `<img>` gives a silently blank hero.
 * 3. **A graceful failure.** A broken path shows a neutral tile rather than a torn icon.
 *
 * `object-cover` on a fixed ratio is what preserves the site's editorial crop.
 */
export default function Image({
  src,
  alt = '',
  ratio = 'product',
  fit = 'cover',
  className = '',
  imgClassName = '',
  eager = false,
  hoverSrc = null,
  sizes,
  ...props
}) {
  const [failed, setFailed] = useState(false)
  const [hovering, setHovering] = useState(false)

  const wrapper = `relative overflow-hidden bg-sand ${RATIOS[ratio] ?? RATIOS.product} ${className}`
  const media = `absolute inset-0 size-full ${fit === 'contain' ? 'object-contain' : 'object-cover'} ${imgClassName}`

  if (!src || failed) {
    return (
      <div className={wrapper} role="img" aria-label={alt || 'Image unavailable'}>
        <div className="absolute inset-0 grid place-items-center text-[11px] uppercase tracking-[0.14em] text-body/50">
          The Purple Panther
        </div>
      </div>
    )
  }

  if (isVideo(src)) {
    return (
      <div className={wrapper}>
        {/* Muted + inline + loop so autoplay is permitted; decorative, so hidden from AT. */}
        <video
          className={media}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          {...props}
        />
      </div>
    )
  }

  return (
    <div
      className={wrapper}
      onMouseEnter={hoverSrc ? () => setHovering(true) : undefined}
      onMouseLeave={hoverSrc ? () => setHovering(false) : undefined}
    >
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={eager ? 'high' : undefined}
        sizes={sizes}
        onError={() => setFailed(true)}
        className={`${media} transition-opacity duration-500 ${hovering ? 'opacity-0' : 'opacity-100'}`}
        {...props}
      />

      {/* Second image cross-fades on hover — the product-grid behaviour on the live site. */}
      {hoverSrc && (
        <img
          src={hoverSrc}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className={`${media} transition-opacity duration-500 ${hovering ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  )
}
