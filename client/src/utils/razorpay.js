/**
 * Loads the Razorpay checkout script on demand.
 *
 * Deliberately not in index.html: it is a third-party script that only the checkout page
 * needs, so loading it site-wide would put an external request on every page view.
 * The promise is cached, so opening checkout twice does not inject the script twice.
 */
const SRC = 'https://checkout.razorpay.com/v1/checkout.js'

let pending = null

export function loadRazorpay() {
  if (typeof window !== 'undefined' && window.Razorpay) {
    return Promise.resolve(window.Razorpay)
  }

  if (pending) return pending

  pending = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Razorpay))
      existing.addEventListener('error', () => reject(new Error('Could not load the payment provider.')))
      return
    }

    const script = document.createElement('script')
    script.src = SRC
    script.async = true
    script.onload = () => resolve(window.Razorpay)
    script.onerror = () => {
      pending = null
      reject(new Error('Could not load the payment provider. Please check your connection.'))
    }
    document.body.appendChild(script)
  })

  return pending
}

export default loadRazorpay
