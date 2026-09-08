import { Link } from 'react-router-dom'
import Seo from '../components/common/Seo.jsx'

export default function NotFound() {
  return (
    <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
      <Seo title="Page not found" noIndex />
      <h1>Page not found</h1>
      <p style={{ marginTop: 12, opacity: 0.7 }}>
        The page you are looking for does not exist or has moved.
      </p>
      <Link to="/" className="btn btn-primary" style={{ marginTop: 20 }}>
        Back to home
      </Link>
    </div>
  )
}
