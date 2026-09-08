import { motion } from 'motion/react'
import Section from '../ui/Section.jsx'
import SectionHeading from '../ui/SectionHeading.jsx'
import Image from '../ui/Image.jsx'

/**
 * "Fabric Library" — an editorial image row with overlay titles.
 * A static grid, matching the original; no carousel introduced.
 */
export default function FabricLibrary({ banner }) {
  const slides = banner?.images ?? []
  if (!banner || slides.length === 0) return null

  return (
    <Section>
      <SectionHeading
        title={banner.title ?? 'Fabric Library'}
        subtitle={banner.description ?? undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {slides.map((slide, index) => (
          <motion.figure
            key={slide.id ?? index}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, delay: index * 0.08 }}
            className="group relative m-0 overflow-hidden"
          >
            <Image
              src={slide.image}
              alt={slide.title ?? ''}
              ratio="editorial"
              imgClassName="transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
            />
            {(slide.title || slide.subtitle) && (
              <>
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/50 to-transparent"
                  aria-hidden="true"
                />
                <figcaption className="absolute inset-x-0 bottom-0 p-5">
                  {slide.title && <p className="text-[16px] font-medium text-white">{slide.title}</p>}
                  {slide.subtitle && <p className="mt-0.5 text-[13px] text-white/85">{slide.subtitle}</p>}
                </figcaption>
              </>
            )}
          </motion.figure>
        ))}
      </div>
    </Section>
  )
}
