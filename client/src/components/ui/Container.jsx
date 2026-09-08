/**
 * Page container.
 *
 * max-width 1430px with 15px gutters, measured from the live site's `.container`.
 * A component rather than a repeated utility string because every section uses it and the
 * value is a design decision, not an incidental one.
 */
export default function Container({ as: Tag = 'div', className = '', children, ...props }) {
  return (
    <Tag className={`mx-auto w-full max-w-[1430px] px-4 sm:px-[15px] ${className}`} {...props}>
      {children}
    </Tag>
  )
}
