import { Component } from 'react'

/**
 * Catches render errors so one broken component does not blank the whole site.
 * Errors are logged for diagnosis but never shown to the customer.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
          <h1>Something went wrong</h1>
          <p style={{ opacity: 0.7 }}>Please refresh the page and try again.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.location.reload()}
            style={{ marginTop: 16 }}
          >
            Refresh
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
