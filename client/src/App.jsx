import { useEffect } from 'react'
import AppRoutes from './routes/index.jsx'
import ErrorBoundary from './components/common/ErrorBoundary.jsx'
import { useAuthStore } from './store/index.js'

/**
 * Application root.
 *
 * The session is resolved ONCE at boot. The auth cookie is HTTP-only, so asking the server
 * is the only way to know whether someone is signed in — and every guard waits on this
 * rather than assuming signed-out, which would otherwise flash the login page on reload.
 */
export default function App() {
  const init = useAuthStore((s) => s.init)

  useEffect(() => {
    init()
  }, [init])

  return (
    <ErrorBoundary>
      <AppRoutes />
    </ErrorBoundary>
  )
}
