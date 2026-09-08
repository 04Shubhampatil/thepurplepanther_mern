import { motion } from 'motion/react'
import Button from '../ui/Button.jsx'
import Container from '../ui/Container.jsx'
import Image from '../ui/Image.jsx'

/**
 * Homepage hero.
 *
 * Full-bleed media with the copy overlaid bottom-left, matching the live site. The media
 * is frequently an .mp4, which <Image> handles by rendering <video>.
 *
 * A gradient scrim sits between the media and the text: the headline is brand purple on
 * pale imagery, and without it contrast fails on lighter frames of the video.
 */
export default function HeroSection({ banner }) {
  const slide = banner?.images?.[0]
  if (!slide) return null

  const heading = slide.title ?? banner.title
  const subtitle = slide.subtitle ?? banner.subtitle
  const href = slide.buttonLink ?? banner.buttonLink
  const label = slide.buttonText ?? banner.buttonText ?? 'Explore the collection'

  return (
    <section className="relative -mt-16 md:-mt-20" aria-label={heading ?? 'Featured'}>
      <Image
        src={slide.image}
        alt={heading ?? ''}
        ratio="auto"
        eager
        className="h-[78vh] min-h-[480px] w-full md:h-[92vh]"
      />

      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/85 via-white/25 to-transparent"
        aria-hidden="true"
      />

      <div className="absolute inset-x-0 bottom-0 pb-12 md:pb-20">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-xl"
          >
            {heading && <h1 className="pp-display text-brand">{heading}</h1>}

            {subtitle && (
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
                className="mt-3 max-w-md text-[15px] text-ink/80"
              >
                {subtitle}
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="mt-7"
            >
              <Button to={href || '/shop'}>{label}</Button>
            </motion.div>
          </motion.div>
        </Container>
      </div>
    </section>
  )
}
