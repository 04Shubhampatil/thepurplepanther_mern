import Container from './Container.jsx'

/** Standard page title block for interior pages. */
export default function PageHeader({ title, subtitle = null, eyebrow = null, children = null }) {
  return (
    <Container className="pt-10 md:pt-14">
      {eyebrow && <p className="pp-eyebrow mb-2 text-brand">{eyebrow}</p>}
      <h1 className="pp-heading">{title}</h1>
      {subtitle && <p className="mt-2 max-w-xl text-body">{subtitle}</p>}
      {children}
    </Container>
  )
}
