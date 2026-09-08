import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { LogOut, ChevronRight } from 'lucide-react'
import Drawer from '../ui/Drawer.jsx'
import { useAuthStore, useConfigStore } from '../../store/index.js'

/**
 * Navigation panel.
 *
 * The live site's menu is: HOME, COLLECTION, ACCESSORIES, OUR STORY, CUSTOMER SUPPORT.
 * Category links are driven by the API rather than hardcoded, so adding a category in the
 * admin surfaces it here — but the fixed entries keep their original order and wording.
 */
const PRIMARY = [
  ['/', 'Home'],
  ['/collection', 'Collection'],
  ['/accessories', 'Accessories'],
  ['/about', 'Our Story'],
  ['/support/faqs', 'Customer Support'],
]

const SECONDARY = [
  ['/shop', 'Shop all'],
  ['/blog', 'Journal'],
  ['/beyond-ordinary', 'Beyond Ordinary'],
]

export default function MobileMenu({ open, onClose }) {
  const { user, logout } = useAuthStore()
  const categories = useConfigStore((s) => s.categories)

  // Categories the fixed list already covers, so they are not repeated.
  const covered = new Set(['collection', 'accessories'])
  const extra = categories.filter((c) => !covered.has(c.slug))

  const item =
    'group flex items-center justify-between border-b border-line py-4 text-[15px] font-medium uppercase tracking-[0.1em] text-ink transition-colors hover:text-brand'

  return (
    <Drawer open={open} onClose={onClose} side="left" title="Menu" widthClass="w-full max-w-[380px]">
      <nav className="px-6 py-2" aria-label="Main navigation">
        <ul>
          {PRIMARY.map(([to, label], index) => (
            <motion.li
              key={to}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.06 + index * 0.04, duration: 0.3 }}
            >
              <Link to={to} onClick={onClose} className={item}>
                {label}
                <ChevronRight
                  size={16}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className="text-body transition-transform duration-200 group-hover:translate-x-1"
                />
              </Link>
            </motion.li>
          ))}

          {extra.map((category) => (
            <li key={category.id}>
              <Link to={`/${category.slug}`} onClick={onClose} className={item}>
                {category.title}
                <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" className="text-body" />
              </Link>
            </li>
          ))}
        </ul>

        <ul className="mt-8">
          {SECONDARY.map(([to, label]) => (
            <li key={to}>
              <Link
                to={to}
                onClick={onClose}
                className="block py-2.5 text-[13px] tracking-[0.04em] text-body transition-colors hover:text-brand"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-8 border-t border-line pt-6">
          {user ? (
            <>
              <p className="mb-3 text-[13px] text-body">
                Signed in as <span className="text-ink">{user.email}</span>
              </p>
              <Link
                to="/account/overview"
                onClick={onClose}
                className="block py-2 text-[13px] uppercase tracking-[0.1em] text-ink hover:text-brand"
              >
                My account
              </Link>
              <button
                type="button"
                onClick={async () => {
                  await logout()
                  onClose()
                }}
                className="flex items-center gap-2 py-2 text-[13px] uppercase tracking-[0.1em] text-ink hover:text-brand"
              >
                <LogOut size={15} strokeWidth={1.5} aria-hidden="true" />
                Sign out
              </button>
            </>
          ) : (
            <div className="flex gap-3">
              <Link
                to="/login"
                onClick={onClose}
                className="flex-1 bg-brand px-4 py-3 text-center text-[13px] font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-brand-soft"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                onClick={onClose}
                className="flex-1 border border-ink px-4 py-3 text-center text-[13px] font-semibold uppercase tracking-[0.1em] text-ink transition-colors hover:bg-ink hover:text-white"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </nav>
    </Drawer>
  )
}
