import Container from '../../components/ui/Container.jsx'

/**
 * Shared shell for the four auth screens.
 *
 * They are the same narrow, centred card on the live site, so the layout lives in one
 * place rather than being repeated (and drifting) across sign in, sign up, forgot and
 * reset.
 */
export default function AuthCard({ title, intro = null, children, footer = null }) {
  return (
    <Container className="py-12 md:py-20">
      <div className="mx-auto w-full max-w-[460px]">
        <h1 className="pp-heading text-center">{title}</h1>
        {intro && <p className="mt-3 text-center text-body">{intro}</p>}

        <div className="mt-8">{children}</div>

        {footer && (
          <div className="mt-7 space-y-1.5 border-t border-line pt-6 text-center text-[14px] text-body">
            {footer}
          </div>
        )}
      </div>
    </Container>
  )
}
