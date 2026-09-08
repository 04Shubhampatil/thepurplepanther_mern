import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import Section from '../ui/Section.jsx'
import SectionHeading from '../ui/SectionHeading.jsx'
import Image from '../ui/Image.jsx'
import { formatDate } from '../../utils/format.js'

/** "From the journal" — the four most recent published posts. */
export default function JournalSection({ posts = [] }) {
  if (!posts.length) return null

  return (
    <Section className="pb-4">
      <SectionHeading title="From the journal" to="/blog" linkLabel="All stories" />

      <div className="grid gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {posts.map((post, index) => (
          <motion.article
            key={post.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.45, delay: index * 0.06 }}
            className="group"
          >
            <Link to={`/blog/${post.slug}`} className="block">
              <Image
                src={post.image}
                alt=""
                ratio="wide"
                imgClassName="transition-transform duration-700 group-hover:scale-[1.04]"
              />

              <p className="pp-eyebrow mt-4 text-body">
                {[post.newsType?.title, formatDate(post.publishedAt)].filter(Boolean).join(' · ')}
              </p>

              <h3 className="mt-2 line-clamp-2 text-[16px] leading-snug text-ink transition-colors group-hover:text-brand">
                {post.title}
              </h3>

              {post.excerpt && <p className="mt-2 line-clamp-2 text-body">{post.excerpt}</p>}
            </Link>
          </motion.article>
        ))}
      </div>
    </Section>
  )
}
