import { Component } from 'react'

/**
 * Catches render errors so one broken component does not blank the whole site.
 * Errors are logged for diagnosis but never shown to the customer.
 *
 * Deliberately styled with plain utility classes and no imported components: whatever
 * failed may well be one of them, and a fallback that can itself throw is no fallback.
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
        <div className="mx-auto w-full max-w-[1430px] px-4 py-20 text-center md:py-28">
          <h1 className="pp-heading">Something went wrong</h1>
          <p className="mx-auto mt-3 max-w-sm text-body">
            Please refresh the page and try again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-7 inline-flex items-center justify-center bg-brand px-9 py-4 text-[15px] font-semibold text-white transition-colors hover:bg-brand-soft"
          >
            Refresh
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
