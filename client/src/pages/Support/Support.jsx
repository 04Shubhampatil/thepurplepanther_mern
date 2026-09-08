import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { SUPPORT_ROUTES, SUPPORT_CONTENT, DEFAULT_SUPPORT_PAGE } from './supportContent.js'
import { useBodyClass, usePageTitle } from '../../theme/page.js'

/**
 * Customer care — frontend/pages/support.blade.php plus support-pages.js.
 *
 * As with the account area, the Blade file is an empty `<div id="support-app">`; the markup
 * being reproduced is the script's. Class names (`support-shell`, `support-layout`,
 * `support-nav`, `support-accordion`, `support-form`) are what custom.css styles.
 *
 * The two forms are decorative in the original: support-pages.js intercepts the submit,
 * writes "Thank you. Your information has been received." into the status line and resets
 * the fields — it never posts anywhere. That is preserved rather than quietly wired to an
 * endpoint, because sending a return request somewhere new would be a behaviour change, not
 * a port. If these should reach a real inbox, that is a decision to make deliberately.
 */
function Accordion({ items, page }) {
  const [open, setOpen] = useState(null)

  return (
    <div className="support-accordion">
      {items.map(([question, answers], index) => {
        const expanded = open === index
        return (
          <article key={index}>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`answer-${page}-${index}`}
              onClick={() => setOpen(expanded ? null : index)}
            >
              <span>{question}</span>
              <b aria-hidden="true">{expanded ? '⌃' : '⌄'}</b>
            </button>
            <div id={`answer-${page}-${index}`} hidden={!expanded}>
              {answers.map((answer, answerIndex) => (
                // The FAQ copy contains <br> tags inline, which Blade rendered as markup.
                <p key={answerIndex} dangerouslySetInnerHTML={{ __html: answer }} />
              ))}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function SupportForm({ block }) {
  const [status, setStatus] = useState('')

  function onSubmit(event) {
    event.preventDefault()
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity()
      return
    }
    setStatus('Thank you. Your information has been received.')
    event.currentTarget.reset()
  }

  const field = (input) => (
    <label key={input.name}>
      {input.label}
      {input.control === 'textarea' ? (
        <textarea name={input.name} rows={input.rows ?? 5} required={input.required} />
      ) : input.control === 'select' ? (
        <select name={input.name} required={input.required}>
          {input.options.map(([value, label]) => (
            <option value={value} key={label}>{label}</option>
          ))}
        </select>
      ) : (
        <input
          name={input.name}
          type={input.type ?? 'text'}
          required={input.required}
          placeholder={input.placeholder}
        />
      )}
    </label>
  )

  return (
    <form className="support-form" id={block.id} onSubmit={onSubmit}>
      {(block.rows ?? []).map((row, index) => (
        <div key={index}>{row.map(field)}</div>
      ))}
      {(block.fields ?? []).map(field)}
      {block.check && (
        <label className="support-check">
          <input type="checkbox" required /> {block.check}
        </label>
      )}
      <button className="support-primary" type="submit">{block.submitLabel}</button>
      <p className="support-form-status" role="status">{status}</p>
    </form>
  )
}

function Block({ block, page }) {
  switch (block.type) {
    case 'lead':
      return <p className="support-lead">{block.text}</p>

    case 'accordion':
      return <Accordion items={block.items} page={page} />

    case 'paragraphs':
      return block.items.map((text, index) => <p key={index}>{text}</p>)

    case 'sections':
      return block.items.map(([title, paragraphs], index) => (
        <section className="support-copy-section" key={index}>
          <h2>{title}</h2>
          {paragraphs.map((text, textIndex) => <p key={textIndex}>{text}</p>)}
        </section>
      ))

    case 'link':
      return <Link className="support-primary" to={block.href}>{block.label}</Link>

    case 'table':
      return (
        <div className="size-table-wrap">
          <table className="size-table">
            <tbody>
              {block.rows.map(([size, ...cells]) => (
                <tr key={size}>
                  <th>{size}</th>
                  {cells.map((cell, index) => <td key={index}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )

    case 'benefits':
      return (
        <div className="affiliate-benefits">
          {block.items.map(([title, text]) => (
            <article key={title}>
              <strong>{title}</strong>
              <p>{text}</p>
            </article>
          ))}
        </div>
      )

    case 'form':
      return <SupportForm block={block} />

    default:
      return null
  }
}

export default function Support() {
  const { page: requested } = useParams()
  const [navOpen, setNavOpen] = useState(false)

  const page = requested ?? DEFAULT_SUPPORT_PAGE
  const content = SUPPORT_CONTENT[page]

  useBodyClass('support-page')
  usePageTitle(content ? `${content.title} - The Purple Panther` : 'Customer Care - The Purple Panther')

  // support-pages.js fell back to FAQs for an unknown slug rather than 404ing.
  if (!content) return <Navigate to={`/support/${DEFAULT_SUPPORT_PAGE}`} replace />

  return (
    <div id="support-app" className="support-app" data-support-page={page}>
      <main className="support-shell">
        <div className="support-layout">
          <button
            className="support-nav-toggle"
            type="button"
            aria-expanded={navOpen}
            aria-controls="supportNav"
            onClick={() => setNavOpen((open) => !open)}
          >
            Customer Care <span>+</span>
          </button>
          <nav id="supportNav" className={`support-nav${navOpen ? ' open' : ''}`} aria-label="Customer care">
            {SUPPORT_ROUTES.map(([slug, label]) => (
              <Link
                to={`/support/${slug}`}
                className={slug === page ? 'active' : undefined}
                aria-current={slug === page ? 'page' : undefined}
                key={slug}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="support-content">
            <section className="support-copy-section">
              <h2>{content.title}</h2>
              {content.blocks.map((block, index) => (
                <Block block={block} page={page} key={index} />
              ))}
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
