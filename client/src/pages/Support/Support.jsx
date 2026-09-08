import { useParams, NavLink } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import Loading from '../../components/common/Loading.jsx'
import Seo from '../../components/common/Seo.jsx'
import NotFound from '../NotFound.jsx'
import ContactForm from './ContactForm.jsx'
import SUPPORT_CONTENT from './supportContent.js'

/**
 * Customer-care pages.
 *
 * Content lives in the view layer, exactly as it did in Blade — the server validates the
 * slug against its allow-list and returns the title, and the copy is rendered from
 * `supportContent.js`. That keeps editorial text in version control rather than turning it
 * into an unplanned CMS.
 */
export default function Support() {
  const { page = 'faqs' } = useParams()
  const { data, error, loading } = useApi(() => api.cms.supportPage(page), [page])

  const { data: index } = useApi(() => api.cms.supportPages(), [])

  if (error?.status === 404) return <NotFound />
  if (loading && !data) return <Loading full />
  if (!data) return null

  const content = SUPPORT_CONTENT[page]

  return (
    <div className="container pp-support" style={{ padding: '32px 0' }}>
      <Seo title={data.title} description={`${data.title} — The Purple Panther customer care.`} />

      <div className="row">
        <nav className="col-md-3" aria-label="Customer care">
          <h2 style={{ fontSize: 18 }}>Customer care</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {(index?.pages ?? []).map((item) => (
              <li key={item.slug}>
                <NavLink
                  to={`/support/${item.slug}`}
                  className={({ isActive }) => (isActive ? 'is-active' : '')}
                >
                  {item.title}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="col-md-9">
          <h1>{data.title}</h1>

          {content ? (
            <div className="pp-support__body">
              {content.intro && <p style={{ fontSize: 17, opacity: 0.85 }}>{content.intro}</p>}

              {content.sections?.map((section, index) => (
                <section key={index} style={{ marginTop: 24 }}>
                  {section.heading && <h2 style={{ fontSize: 19 }}>{section.heading}</h2>}
                  {section.body?.map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                  {section.list && (
                    <ul>
                      {section.list.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}

              {content.faqs && (
                <div style={{ marginTop: 24 }}>
                  {content.faqs.map((faq, index) => (
                    <details key={index} style={{ borderBottom: '1px solid #eee', padding: '12px 0' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{faq.q}</summary>
                      <p style={{ marginTop: 8 }}>{faq.a}</p>
                    </details>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p style={{ opacity: 0.7 }}>
              For help with this topic, please get in touch using the form below.
            </p>
          )}

          <ContactForm subject={data.title} />
        </div>
      </div>
    </div>
  )
}
