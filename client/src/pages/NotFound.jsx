import { Link } from 'react-router-dom'
import { usePageTitle } from '../theme/page.js'

/**
 * resources/views/errors/404.blade.php.
 *
 * A standalone page in Laravel: no site header, no footer, its own inline stylesheet, and
 * only bootstrap.min.css and style.css behind it. Both of those are already loaded from
 * index.html, so only the page-specific rules need carrying — inline, exactly as the
 * template had them, since they exist in no .css file to link.
 */
const STYLES = `
.pp-error-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background:
      radial-gradient(circle at top right, rgba(57, 21, 80, 0.08), transparent 42%),
      linear-gradient(180deg, #faf8fb 0%, #ffffff 45%, #f5f1f7 100%);
  }
  .pp-error-header {
    padding: 28px 0 10px;
    text-align: center;
  }
  .pp-error-header img {
    max-height: 72px;
    width: auto;
  }
  .pp-error-main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 16px 80px;
  }
  .pp-error-card {
    max-width: 640px;
    width: 100%;
    text-align: center;
  }
  .pp-error-code {
    font-family: var(--title-font2, Georgia, serif);
    font-size: clamp(96px, 18vw, 160px);
    line-height: 0.9;
    color: #391550;
    margin: 0 0 18px;
    letter-spacing: -0.04em;
  }
  .pp-error-title {
    font-family: var(--title-font2, Georgia, serif);
    font-size: clamp(28px, 4vw, 42px);
    color: #1d1d1d;
    margin: 0 0 16px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .pp-error-text {
    color: #5a5a5a;
    font-size: 16px;
    line-height: 1.7;
    margin: 0 auto 36px;
    max-width: 460px;
  }
  .pp-error-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
  }
  .pp-error-actions .su-btn-4 {
    min-width: 200px;
  }
  .pp-error-footer {
    border-top: 1px solid rgba(57, 21, 80, 0.08);
    padding: 22px 0;
    text-align: center;
    color: #6b6b6b;
    font-size: 14px;
    background: #fff;
  }
`

export default function NotFound() {
  usePageTitle('404 - Page Not Found | The Purple Panther', 'Page not found - The Purple Panther')

  return (
    <>
      <style>{STYLES}</style>
      <div className="pp-error-page">
        <header className="pp-error-header">
          <div className="container">
            <Link to="/">
              <img src="/frontend/images/logo-dark.svg" alt="The Purple Panther" />
            </Link>
          </div>
        </header>

        <main className="pp-error-main">
          <div className="pp-error-card">
            <p className="pp-error-code">404</p>
            <h1 className="pp-error-title">Page Not Found</h1>
            <p className="pp-error-text">
              The page you are looking for may have been moved, renamed, or is temporarily unavailable.
            </p>
            <div className="pp-error-actions">
              <Link className="su-btn-4 su-btn-16-black su-left-right" to="/">
                <span className="mr10 su-text d-inline-block">Back to Home</span>
                <span className="su-arrow-angle">
                  <svg className="su-arrow-svg-top-right" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10.00 10.00">
                    <path d="M1.018 10.009 0 8.991l7.569-7.582H1.723L1.737 0h8.26v8.274H8.574l.013-5.847Z"></path>
                    <path d="M1.018 10.009 0 8.991l7.569-7.582H1.723L1.737 0h8.26v8.274H8.574l.013-5.847Z"></path>
                  </svg>
                </span>
              </Link>
              <Link className="su-btn-4 su-btn-7-black su-left-right rounded-3" to="/collection">
                <span className="mr10 su-text d-inline-block">Shop Collection</span>
                <span className="su-arrow-angle">
                  <svg className="su-arrow-svg-top-right" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10.00 10.00">
                    <path d="M1.018 10.009 0 8.991l7.569-7.582H1.723L1.737 0h8.26v8.274H8.574l.013-5.847Z"></path>
                    <path d="M1.018 10.009 0 8.991l7.569-7.582H1.723L1.737 0h8.26v8.274H8.574l.013-5.847Z"></path>
                  </svg>
                </span>
              </Link>
            </div>
          </div>
        </main>

        <footer className="pp-error-footer">
          <div className="container">© {new Date().getFullYear()}, The Purple Panther.</div>
        </footer>
      </div>
    </>
  )
}
