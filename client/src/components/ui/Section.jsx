import Container from './Container.jsx'

/**
 * Vertical rhythm wrapper. The live site uses a 90px top rhythm (`pt90`), tightened on
 * small screens where 90px eats most of a phone viewport.
 */
export default function Section({
  as: Tag = 'section',
  className = '',
  contained = true,
  children,
  ...props
}) {
  const inner = contained ? <Container>{children}</Container> : children
  return (
    <Tag className={`pt-14 md:pt-[90px] ${className}`} {...props}>
      {inner}
    </Tag>
  )
}
