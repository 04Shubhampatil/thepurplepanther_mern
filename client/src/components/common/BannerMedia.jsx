const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov']

export const isVideo = (src) =>
  typeof src === 'string' && VIDEO_EXTENSIONS.some((ext) => src.toLowerCase().split('?')[0].endsWith(ext))

/**
 * Renders a banner slide, which may be an image OR a video.
 *
 * The `banner_images.image` column stores whatever was uploaded, and the live data has at
 * least one `.mp4` in it (the homepage hero). Rendering that in an `<img>` produces a
 * silently blank hero — which is exactly what happened before this component existed.
 *
 * Videos are muted, inline and looping so they autoplay under browser policy, and carry
 * `playsInline` so iOS does not take them fullscreen.
 */
export default function BannerMedia({
  src,
  mobileSrc = null,
  alt = '',
  className = '',
  style = { width: '100%', display: 'block' },
  poster = null,
  eager = false,
}) {
  if (!src) return null

  if (isVideo(src)) {
    return (
      <video
        className={className}
        style={style}
        src={src}
        poster={poster ?? undefined}
        autoPlay
        muted
        loop
        playsInline
        // Decorative: the surrounding heading carries the meaning.
        aria-hidden="true"
      />
    )
  }

  // A mobile variant is served through <picture> so the browser picks before downloading.
  if (mobileSrc) {
    return (
      <picture>
        <source media="(max-width: 767px)" srcSet={mobileSrc} />
        <img
          className={className}
          style={style}
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
        />
      </picture>
    )
  }

  return (
    <img
      className={className}
      style={style}
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
    />
  )
}
