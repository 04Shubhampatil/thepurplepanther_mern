import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import Section from '../ui/Section.jsx'
import SectionHeading from '../ui/SectionHeading.jsx'
import Image from '../ui/Image.jsx'

/**
 * "The Complete Collection" — category tiles.
 *
 * Driven by the banner's slides where the admin has configured them, falling back to the
 * live category list so the section is never empty.
 */
export default function CollectionSection({ banner, categories = [] }) {
  const slides = banner?.images ?? []

  const tiles = slides.length
    ? slides.map((slide, i) => ({
        key: slide.id ?? i,
        image: slide.image,
        title: slide.title ?? banner?.title,
        to: slide.buttonLink || '/shop',
        cta: slide.buttonText,
      }))
    : categories.slice(0, 3).map((category) => ({
        key: category.id,
        image: category.image,
        title: category.title,
        to: `/${category.slug}`,
        cta: 'Shop now',
      }))

  if (tiles.length === 0) return null

  return (
    <Section>
      <SectionHeading
        title={banner?.title ?? 'The Complete Collection'}
        subtitle={banner?.description ?? undefined}
        to="/shop"
        linkLabel="Shop all"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile, index) => (
          <motion.div
            key={tile.key}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, delay: index * 0.08 }}
          >
            <Link to={tile.to} className="group block">
              <div className="relative overflow-hidden">
                <Image
                  src={tile.image}
                  alt={tile.title ?? ''}
                  ratio="editorial"
                  imgClassName="transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/55 to-transparent"
                  aria-hidden="true"
                />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <h3 className="text-[18px] font-medium text-white">{tile.title}</h3>
                  <span className="mt-1 inline-block text-[12px] uppercase tracking-[0.14em] text-white/85 underline-offset-4 group-hover:underline">
                    {tile.cta || 'Shop now'}
                  </span>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </Section>
  )
}
