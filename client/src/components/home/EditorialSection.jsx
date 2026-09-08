import { motion } from 'motion/react'
import Button from '../ui/Button.jsx'
import Container from '../ui/Container.jsx'
import Image from '../ui/Image.jsx'

/**
 * Full-width editorial band — "Our Story" on the homepage.
 * Image on one side, copy on the other, reversible via `reverse`.
 */
export default function EditorialSection({ banner, reverse = false, tone = 'sand' }) {
  const slide = banner?.images?.[0]
  if (!banner || !slide) return null

  return (
    <section className={`mt-14 md:mt-[90px] ${tone === 'sand' ? 'bg-sand' : ''}`}>
      <Container className="!px-0 md:!px-[15px]">
        <div className={`grid items-center md:grid-cols-2 ${reverse ? 'md:[&>*:first-child]:order-2' : ''}`}>
          <motion.div
            initial={{ opacity: 0, scale: 1.03 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <Image src={slide.image} alt={banner.title ?? ''} ratio="editorial" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="px-6 py-12 md:px-14 md:py-16"
          >
            {banner.subtitle && <p className="pp-eyebrow mb-3 text-brand">{banner.subtitle}</p>}
            <h2 className="pp-heading">{banner.title}</h2>
            {banner.description && <p className="mt-4 max-w-md text-body">{banner.description}</p>}

            {banner.buttonLink && (
              <Button to={banner.buttonLink} variant="outline" size="sm" className="mt-7">
                {banner.buttonText || 'Read more'}
              </Button>
            )}
          </motion.div>
        </div>
      </Container>
    </section>
  )
}
