import { useParams, NavLink } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import Loading from '../../components/common/Loading.jsx'
import Seo from '../../components/common/Seo.jsx'
import NotFound from '../NotFound.jsx'
import ContactForm from './ContactForm.jsx'
import SUPPORT_CONTENT from './supportContent.js'
import Container from '../../components/ui/Container.jsx'

/**
 * Customer-care pages.
 *
 * Content lives in the view layer, exactly as it did in Blade — the server validates the
 * slug against its allow-list and returns the title, and the copy is rendered from
 * `supportContent.js`. That keeps editorial text in version control rather than turning it
 * into an unplanned CMS.
 *
 * FAQs use native <details>, so keyboard interaction, Find-in-page and the open/closed
 * state come from the browser rather than being rebuilt in state.
 */
export default function Support() {
  const { page = 'faqs' } = useParams()
  const { data, error, loading } = useApi(() => api.cms.supportPage(page), [page])

  const { data: index } = useApi(() => api.cms.supportPages(), [])

  if (error?.status === 404) return <NotFound />
  if (loading && !data) return <Loading full />
  if (!data) return null

  const content = SUPPORT_CONTENT[page]

  const navClass = ({ isActive }) =>
    [
      'block whitespace-nowrap border-b-2 px-1 py-2 text-[14px] transition-colors md:border-b-0 md:border-l-2 md:px-4 md:py-2',
      isActive
        ? 'border-brand text-brand'
        : 'border-transparent text-body hover:text-ink md:hover:border-line',
    ].join(' ')

  return (
    <Container className="py-10 md:py-14">
      <Seo title={data.title} description={`${data.title} — The Purple Panther customer care.`} />

      <div className="grid gap-8 md:grid-cols-[240px_1fr] md:gap-12">
        <nav aria-label="Customer care" className="md:border-r md:border-line md:pr-6">
          <h2 className="pp-eyebrow text-ink">Customer care</h2>

          <ul className="-mx-4 mt-4 flex gap-5 overflow-x-auto px-4 md:mx-0 md:block md:space-y-0.5 md:overflow-visible md:px-0">
            {(index?.pages ?? []).map((item) => (
              <li key={item.slug} className="shrink-0 md:shrink">
                <NavLink to={`/support/${item.slug}`} className={navClass}>
                  {item.title}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          <h1 className="pp-heading">{data.title}</h1>

          {content ? (
            <div className="mt-5 max-w-2xl">
              {content.intro && (
                <p className="text-[17px] leading-relaxed text-ink">{content.intro}</p>
              )}

              {content.sections?.map((section, index) => (
                <section key={index} className="mt-8">
                  {section.heading && (
                    <h2 className="text-[19px] font-semibold text-ink">{section.heading}</h2>
                  )}

                  {section.body?.map((paragraph, i) => (
                    <p key={i} className="mt-3 leading-[1.9]">
                      {paragraph}
                    </p>
                  ))}

                  {section.list && (
                    <ul className="mt-3 list-disc space-y-1.5 pl-5">
                      {section.list.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}

              {content.faqs && (
                <div className="mt-10">
                  {content.faqs.map((faq, index) => (
                    <details key={index} className="group border-b border-line first:border-t">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[15px] font-semibold text-ink transition-colors hover:text-brand [&::-webkit-details-marker]:hidden">
                        {faq.q}
                        <ChevronDown
                          size={17}
                          strokeWidth={1.5}
                          aria-hidden="true"
                          className="shrink-0 transition-transform duration-200 group-open:rotate-180"
                        />
                      </summary>
                      <p className="pb-4 leading-[1.9]">{faq.a}</p>
                    </details>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-5 text-body">
              For help with this topic, please get in touch using the form below.
            </p>
          )}

          <ContactForm subject={data.title} />
        </div>
      </div>
    </Container>
  )
}
