import Seo from '../components/common/Seo.jsx'
import Button from '../components/ui/Button.jsx'
import Container from '../components/ui/Container.jsx'

export default function NotFound() {
  return (
    <Container className="py-24 text-center md:py-32">
      <Seo title="Page not found" noIndex />
      <p className="pp-eyebrow text-brand">404</p>
      <h1 className="pp-heading mt-3">Page not found</h1>
      <p className="mx-auto mt-3 max-w-md text-body">
        The page you are looking for does not exist or has moved.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Button to="/">Back to home</Button>
        <Button to="/shop" variant="outline">
          Shop all
        </Button>
      </div>
    </Container>
  )
}
