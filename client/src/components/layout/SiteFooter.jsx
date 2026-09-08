import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useConfigStore } from '../../store/index.js'
import { SOCIAL } from '../../theme/site.js'
import * as api from '../../services/endpoints.js'

/**
 * frontend/partials/site-footer.blade.php.
 *
 * The accordion on mobile is Bootstrap's collapse, driven by the `data-bs-toggle` /
 * `data-bs-target` pairs below and the bootstrap.min.js loaded in index.html — no React
 * state, because the ids and the `.collapse d-lg-block` combination are what the theme's
 * CSS keys off to keep the columns open on desktop and shut on mobile.
 *
 * Newsletter signup is the one live part: Blade posted the form and reloaded, so the
 * status line is now filled in from the API response instead.
 */
export default function SiteFooter() {
  const categories = useConfigStore((s) => s.categories)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState({ message: '', error: false })

  async function onSubscribe(event) {
    event.preventDefault()
    const value = email.trim()

    if (!value) {
      setStatus({ message: 'Please enter your email address.', error: true })
      return
    }

    try {
      const response = await api.misc.subscribe(value)
      setStatus({ message: response?.message ?? 'Thank you for subscribing.', error: false })
      setEmail('')
    } catch (error) {
      setStatus({ message: error.message || 'Could not subscribe right now.', error: true })
    }
  }

  return (
    <>
      {/* Our Footer */}
      {/* Our Footer start*/}
      <footer className="footer_one su-footer-four su-footer-five home43-style bgc-thm15 pt60 site-footer">
        <div className="container pb65">
          <div className="row">
            <div className="col-xl-3 col-lg-4">
              <div className="footer_qlink_widget dark-bb-md">
                <div className="collapse show d-lg-block" id="logoCollapse">
                  <div className="link">
                    <Link to="/" aria-label="The Purple Panther home">
                      <img src="/frontend/images/footer-logo.svg" alt="Purple Panther" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-xl-5 col-lg-8">
              <div className="row">
                <div className="col-lg-4 col-xl">
                  <div className="footer_qlink_widget dark-bb-md">
                    <button className="btn fz20 colps-btn w-100 title ps-0 d-lg-none d-flex justify-content-between align-items-center" data-bs-toggle="collapse" data-bs-target="#exploreCollapse" aria-expanded="false" type="button">
                      Category
                      <i className="fa-solid fa-plus icon-toggle"></i>
                    </button>
                    <h6 className="title fz20 d-none d-lg-block">Category</h6>
                    <div className="collapse d-lg-block" id="exploreCollapse">
                      <ul className="list-unstyled">
                        <li><Link to="/shop">All</Link></li>
                        {categories.length > 0
                          ? categories.map((category) => (
                          <li key={category.id}>
                            <a href={category.url}>{category.title}</a>
                          </li>
                          ))
                          : (
                          <li><Link to="/shop">Shop</Link></li>
                          )}
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="col-lg-4 col-xl">
                  <div className="footer_qlink_widget dark-bb-md">
                    <button className="btn fz20 colps-btn w-100 title ps-0 d-lg-none d-flex justify-content-between align-items-center" data-bs-toggle="collapse" data-bs-target="#careCollapse" aria-expanded="false" type="button">
                      Company
                      <i className="fa-solid fa-plus icon-toggle"></i>
                    </button>
                    <h6 className="title fz20 d-none d-lg-block">Company</h6>
                    <div className="collapse d-lg-block" id="careCollapse">
                      <ul className="list-unstyled">
                        <li><Link to="/">Home</Link></li>
                        <li><Link to="/about">Our Story</Link></li>
                        <li><Link to="/support/faqs">Contact</Link></li>
                        {/* <li><Link to="/about">Sustainability</Link></li> */}
                        {/* <li><Link to="/about">Stores</Link></li> */}
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="col-lg-4 col-xl">
                  <div className="footer_qlink_widget dark-bb-md">
                    <button className="btn fz20 colps-btn w-100 title ps-0 d-lg-none d-flex justify-content-between align-items-center" data-bs-toggle="collapse" data-bs-target="#legalCollapse" aria-expanded="false" type="button">
                      Support
                      <i className="fa-solid fa-plus icon-toggle"></i>
                    </button>
                    <h6 className="title fz20 d-none d-lg-block">Support</h6>
                    <div className="collapse d-lg-block" id="legalCollapse">
                      <ul className="list-unstyled">
                        <li><Link to="/support/returns">Refund Policy</Link></li>
                        <li><Link to="/support/privacy">Privacy Policy</Link></li>
                        <li><Link to="/support/shipping">Shipping Policy</Link></li>
                        <li><Link to="/support/terms">Terms of Service</Link></li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-xl-3 col-lg-6 col-md-7">
              <div className="mailchimp_widget dark-bb-md">
                <button className="btn fz20 colps-btn w-100 title ps-0 d-lg-none d-flex justify-content-between align-items-center" data-bs-toggle="collapse" data-bs-target="#newsletterCollapse" aria-expanded="false" type="button">
                  Subscribe
                  <i className="fa-solid fa-plus icon-toggle"></i>
                </button>
                <h6 className="title fz20 d-none d-lg-block">Subscribe </h6>
                <div className="collapse d-lg-block mt30" id="newsletterCollapse">
                  <p className="text mb30 mt30">Sign up for exclusive offers, product drops, events, and more.</p>
                  <form className="footer_mailchimp_form" data-newsletter-form onSubmit={onSubscribe} noValidate>

                    <div className="d-flex align-items-center">
                      <input
                        type="email"
                        className="form-control"
                        name="email"
                        placeholder="Email Address"
                        autoComplete="email"
                        aria-label="Email Address"
                        maxLength="255"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                      />
                      <button type="submit" className="subscribe-btn su-left-right" aria-label="Subscribe">
                        <span className="su-arrow-angle">
                          <svg className="su-arrow-svg-top-right" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10.00 10.00" aria-hidden="true">
                            <path d="M1.018 10.009 0 8.991l7.569-7.582H1.723L1.737 0h8.26v8.274H8.574l.013-5.847Z" />
                            <path d="M1.018 10.009 0 8.991l7.569-7.582H1.723L1.737 0h8.26v8.274H8.574l.013-5.847Z" />
                          </svg>
                        </span>
                      </button>
                    </div>
                    <div
                      className={`pp-newsletter-status${status.error ? ' is-error' : ''}`}
                      data-newsletter-status
                      role="status"
                      hidden={!status.message}
                    >
                      {status.message}
                    </div>
                  </form>
                  <div className="social mt30">
                    <a href={SOCIAL.facebook} target="_blank" rel="noopener" aria-label="Facebook"><i className="fa-brands fa-facebook"></i></a>
                    <a href={SOCIAL.instagram} target="_blank" rel="noopener" aria-label="Instagram"><i className="fa-brands fa-instagram"></i></a>
                    <a href={SOCIAL.x} target="_blank" rel="noopener" aria-label="X">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M9.48945 6.77491L15.3177 0H13.9366L8.87592 5.88256L4.83396 0H0.172028L6.28427 8.89547L0.172028 16H1.55322L6.89745 9.78782L11.1661 16H15.828L9.48911 6.77491H9.48945ZM7.59771 8.97384L6.97842 8.08805L2.05089 1.03974H4.17232L8.1489 6.72795L8.76819 7.61374L13.9373 15.0075H11.8158L7.59771 8.97418V8.97384Z" fill="#1D1D1D" />
                      </svg>
                    </a>
                    <a href={SOCIAL.youtube} target="_blank" rel="noopener" aria-label="YouTube"><i className="fa-brands fa-youtube"></i></a>
                    <a href={SOCIAL.pinterest} target="_blank" rel="noopener" aria-label="Pinterest"><i className="fa-brands fa-pinterest"></i></a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="footer-bottom-home43 pt25 pb25">
          <div className="container">
            <div className="row">
              <div className="col-md-4">
                <div className="footer_bottom_left d-flex align-items-center">
                  <div className="lang_widgets">
                    <div className="text">&copy; {new Date().getFullYear()}, The Purple Panther.</div>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="copyright-widget text-md-center"></div>
              </div>
              <div className="col-md-4">
                <div className="footer_acceped_card_widget">
                  <div className="acceped_card_list">
                    <div className="d-flex mb-0 justify-content-sm-end">
                      <span className="me-2"><img src="/frontend/images/visa-card.webp" alt="Visa" /></span>
                      <span className="me-2"><img src="/frontend/images/master-card.webp" alt="Mastercard" /></span>
                      <span className="me-2"><img src="/frontend/images/apple-pay.webp" alt="Apple Pay" /></span>
                      <span className="me-2"><img src="/frontend/images/discover-card.webp" alt="Discover" /></span>
                      <span className="me-2"><img src="/frontend/images/paypal.webp" alt="PayPal" /></span>
                      <span><img src="/frontend/images/amex-card.webp" alt="Amex" /></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
      {/* Our Footer end */}
    </>
  )
}
