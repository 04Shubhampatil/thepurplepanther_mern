import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PpPrice from '../product/PpPrice.jsx'
import { useConfigStore } from '../../store/index.js'
import { useUiStore } from '../../store/ui.js'
import * as api from '../../services/endpoints.js'
import { useScrollLock } from '../../theme/chrome.js'

const EMPTY_PROMPT = 'Start typing to search products…'

/**
 * frontend/partials/search-panel.blade.php, with the behaviour of frontend-search.js.
 *
 * `.show` on `.search-16-wrap` is what slides the overlay in — that class is the theme's
 * and the animation is still the theme's. It used to be toggled by delegated jQuery
 * handlers in script.js; it now comes from shared state (store/ui.js), because the button
 * that opens it lives in the header and the panel can be rendered from either the header or
 * the mobile menu.
 *
 * The QUERY is ported from frontend-search.js: the 350ms debounce, the two-character floor,
 * the "SEARCHING…" / "TOP RESULTS FOR X" title states and the see-all link. Cancelling
 * the timer on each keystroke replaces jQuery's `abort()`, and also stops a slow early
 * response from overwriting a newer one.
 */
export default function SearchPanel() {
  const categories = useConfigStore((s) => s.categories)
  const { searchOpen, closeSearch } = useUiStore()
  const navigate = useNavigate()
  const inputRef = useRef(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [title, setTitle] = useState('TOP RESULTS')
  const [seeAllUrl, setSeeAllUrl] = useState('')
  const [emptyMessage, setEmptyMessage] = useState(EMPTY_PROMPT)

  const close = useCallback(() => closeSearch(), [closeSearch])

  // The overlay opens over the page, so the page behind it must not scroll, and Escape
  // must close it — both were mmenu's job when it owned the overlay.
  useScrollLock(searchOpen)

  useEffect(() => {
    if (!searchOpen) return undefined

    // The panel slides in from `visibility: hidden`; focusing on the same frame is a no-op,
    // so it waits for the transition to have started.
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 250)

    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeSearch()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [searchOpen, closeSearch])

  useEffect(() => {
    const term = query.trim()

    if (term.length < 2) {
      setSearching(false)
      setTitle('TOP RESULTS')
      setResults(null)
      setEmptyMessage(EMPTY_PROMPT)
      setSeeAllUrl('')
      return undefined
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      setTitle('SEARCHING…')
      try {
        const data = await api.catalog.search(term)
        setTitle(`TOP RESULTS FOR ${(data.query || term).toUpperCase()}`)
        setResults(data.products ?? [])
        setSeeAllUrl(data.seeAllUrl ?? '')
      } catch {
        setTitle('TOP RESULTS')
        setResults(null)
        setEmptyMessage('Unable to search right now.')
        setSeeAllUrl('')
      } finally {
        setSearching(false)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [query])

  // Blade's form posted to /shop; below two characters it refused to submit at all.
  function onSubmit(event) {
    event.preventDefault()
    const term = query.trim()
    if (term.length < 2) return
    close()
    navigate(`/shop?q=${encodeURIComponent(term)}`)
  }

  // A suggestion fills the box rather than following its href — Blade's behaviour, kept
  // because it lets someone refine a category name instead of leaving the panel.
  const onSuggestion = (value) => (event) => {
    event.preventDefault()
    setQuery(value)
    inputRef.current?.focus()
  }

  return (
    <div className={`search-16-wrap text-start position-fixed top-0 start-0 w-100 h-100${searchOpen ? ' show' : ''}${searching ? ' is-searching' : ''}`}>
      <style>{`
        .search-16-wrap .js-search-loader {
          display: none;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(57, 21, 80, 0.2);
          border-top-color: #391550;
          border-radius: 50%;
          animation: ppSearchSpin 0.7s linear infinite;
        }
        .search-16-wrap.is-searching .js-search-icon { display: none; }
        .search-16-wrap.is-searching .js-search-loader { display: inline-block; }
        .search-16-wrap .js-search-results .product-item {
          opacity: 1;
          transition: opacity 0.25s ease, transform 0.25s ease;
        }
        .search-16-wrap.is-searching .js-search-results .product-item {
          opacity: 0.45;
        }
        .search-16-wrap .js-search-see-all > a,
        .search-16-wrap .js-search-see-all .su-text { color: #fff !important; }
        .search-16-wrap .js-search-see-all .su-arrow-angle path { fill: #fff !important; }
        @keyframes ppSearchSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div className="open-search-16-overlay" onClick={close}></div>
      <div className="search-box-main h-100 position-relative">
        <div className="search-top">
          <div className="search-close-icon" onClick={close}><i className="fa-sharp fa-regular fa-xmark"></i></div>
          <form action="/shop" method="GET" className="js-frontend-search-form" onSubmit={onSubmit}>
            <div className="search-input-box position-relative">
              <button type="submit" className="s-icon bg-transparent border-0 position-absolute top-50 start-0 translate-middle-y" aria-label="Search">
                <svg className="js-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g clipPath="url(#clip0_search_icon)">
                    <path d="M7.09841 1.63574C7.36716 1.63574 7.63591 1.65449 7.9031 1.69043C7.86091 1.68418 7.82028 1.67949 7.7781 1.67324C8.29528 1.74512 8.79997 1.88262 9.28122 2.08418C9.24372 2.06855 9.20622 2.05293 9.16872 2.0373C9.47028 2.16543 9.76091 2.31699 10.0359 2.49199C10.1562 2.56855 10.275 2.6498 10.389 2.73418C10.4156 2.75449 10.4437 2.7748 10.4703 2.79512C10.3437 2.6998 10.4437 2.7748 10.4734 2.79824C10.5312 2.84512 10.589 2.89355 10.6468 2.94199C10.8656 3.13105 11.0703 3.33574 11.2578 3.55449C11.3015 3.60605 11.3453 3.65762 11.3875 3.71074C11.4015 3.72949 11.475 3.82324 11.4203 3.75137C11.3672 3.68262 11.4156 3.74512 11.425 3.75762C11.439 3.77637 11.4515 3.79355 11.4656 3.8123C11.55 3.92793 11.6312 4.04512 11.7078 4.16543C11.8812 4.44043 12.0328 4.72949 12.1593 5.02949C12.1437 4.99199 12.1281 4.95449 12.1125 4.91699C12.3156 5.40293 12.4547 5.9123 12.525 6.43262C12.5187 6.39043 12.514 6.3498 12.5078 6.30762C12.5765 6.82949 12.5765 7.35918 12.5078 7.88262C12.514 7.84043 12.5187 7.7998 12.525 7.75762C12.4547 8.27949 12.3156 8.78887 12.1125 9.27324C12.1281 9.23574 12.1437 9.19824 12.1593 9.16074C12.0453 9.42949 11.9125 9.68887 11.7609 9.93887C11.6859 10.0607 11.6078 10.1811 11.525 10.2967C11.4859 10.3514 11.4453 10.4061 11.4047 10.4592C11.3687 10.5076 11.4828 10.3607 11.4297 10.4264C11.4203 10.4389 11.4109 10.4498 11.4015 10.4623C11.3765 10.4951 11.35 10.5264 11.3234 10.5576C11.139 10.7795 10.9375 10.9873 10.7218 11.1795C10.6718 11.2248 10.6203 11.2686 10.5687 11.3123C10.5422 11.3342 10.5172 11.3561 10.4906 11.3764C10.4625 11.3998 10.3375 11.492 10.4703 11.3936C10.3562 11.4795 10.2406 11.5639 10.1218 11.642C9.82028 11.8404 9.50153 12.0107 9.16872 12.1529L9.28122 12.1061C8.79997 12.3076 8.29528 12.4467 7.7781 12.517C7.82028 12.5107 7.86091 12.5061 7.9031 12.4998C7.37028 12.5701 6.82966 12.5717 6.29528 12.4998C6.33747 12.5061 6.3781 12.5107 6.42028 12.517C5.90466 12.4467 5.39997 12.3092 4.92028 12.1076C4.95778 12.1232 4.99528 12.1389 5.03278 12.1545C4.75935 12.0389 4.49528 11.9029 4.24372 11.7482C4.1156 11.6701 3.98903 11.5857 3.86716 11.4982C3.83903 11.4779 3.81247 11.4576 3.78435 11.4373C3.77028 11.4264 3.74528 11.4139 3.73591 11.3998C3.73435 11.3982 3.83591 11.4779 3.78278 11.4357C3.72341 11.3889 3.6656 11.342 3.60778 11.2936C3.38435 11.1045 3.17341 10.8982 2.97966 10.6779C2.92966 10.6217 2.88122 10.5639 2.83435 10.5061C2.81247 10.4795 2.79216 10.4529 2.77028 10.4264C2.76247 10.4154 2.7531 10.4045 2.74528 10.3936C2.84685 10.5217 2.7781 10.4357 2.75622 10.4076C2.67028 10.292 2.58747 10.1748 2.51091 10.0529C2.3281 9.76855 2.17185 9.47012 2.03903 9.15918C2.05466 9.19668 2.07028 9.23418 2.08591 9.27168C1.88435 8.79199 1.74685 8.2873 1.67653 7.77168C1.68278 7.81387 1.68747 7.85449 1.69372 7.89668C1.62185 7.36387 1.62185 6.82324 1.69372 6.29043C1.68747 6.33262 1.68278 6.37324 1.67653 6.41543C1.74685 5.8998 1.88435 5.39512 2.08591 4.91543C2.07028 4.95293 2.05466 4.99043 2.03903 5.02793C2.15466 4.75449 2.2906 4.49043 2.44528 4.23887C2.52341 4.11074 2.60778 3.98418 2.69528 3.8623C2.7156 3.83418 2.73591 3.80762 2.75622 3.77949C2.76716 3.76543 2.77966 3.74043 2.79372 3.73105C2.79528 3.72949 2.7156 3.83105 2.75778 3.77793C2.80466 3.71855 2.85153 3.66074 2.89997 3.60293C3.08903 3.37949 3.29528 3.16855 3.5156 2.9748C3.57185 2.9248 3.62966 2.87637 3.68747 2.82949C3.71403 2.80762 3.7406 2.7873 3.76716 2.76543C3.7781 2.75762 3.78903 2.74824 3.79997 2.74043C3.67185 2.84199 3.75778 2.77324 3.78591 2.75137C3.90153 2.66543 4.01872 2.58262 4.1406 2.50605C4.42497 2.32324 4.72341 2.16699 5.03435 2.03418C4.99685 2.0498 4.95935 2.06543 4.92185 2.08105C5.40153 1.87949 5.90622 1.74199 6.42185 1.67168C6.37966 1.67793 6.33903 1.68262 6.29685 1.68887C6.56091 1.65449 6.82966 1.63574 7.09841 1.63574C7.34372 1.63574 7.5781 1.42012 7.56716 1.16699C7.55622 0.913867 7.36091 0.698242 7.09841 0.698242C5.87028 0.699805 4.6406 1.05605 3.61247 1.73105C2.61716 2.38418 1.79372 3.31074 1.29685 4.39668C1.0406 4.95605 0.856221 5.54043 0.771846 6.1498C0.678096 6.81387 0.682783 7.46855 0.784346 8.13262C0.968721 9.32949 1.52497 10.4576 2.3281 11.3623C3.12028 12.2545 4.17497 12.9154 5.32028 13.2467C6.67341 13.6389 8.1781 13.5732 9.48278 13.0357C10.1562 12.7576 10.7687 12.3857 11.3203 11.9076C11.8078 11.4842 12.2297 10.9764 12.5672 10.4264C13.2703 9.27637 13.5984 7.89043 13.4734 6.54668C13.4078 5.83887 13.2328 5.16699 12.9531 4.51543C12.6937 3.91387 12.3312 3.36074 11.9 2.86699C10.975 1.81074 9.6781 1.06543 8.29685 0.812305C7.90153 0.74043 7.49997 0.699805 7.09841 0.698242C6.8531 0.698242 6.61872 0.913867 6.62966 1.16699C6.6406 1.42168 6.83591 1.63574 7.09841 1.63574Z" fill="currentColor" />
                    <path d="M10.9609 11.6235L12.1609 12.8235L14.0656 14.7282L14.5015 15.1641C14.675 15.3375 14.9937 15.35 15.164 15.1641C15.3359 14.9766 15.35 14.686 15.164 14.5016C14.764 14.1016 14.364 13.7016 13.964 13.3016C13.3296 12.6672 12.6937 12.0313 12.0593 11.3969C11.914 11.2516 11.7687 11.1063 11.6234 10.961C11.45 10.7875 11.1312 10.775 10.9609 10.961C10.789 11.1469 10.775 11.4375 10.9609 11.6235Z" fill="currentColor" />
                  </g>
                  <defs><clipPath id="clip0_search_icon"><rect width="16" height="16" fill="white" /></clipPath></defs>
                </svg>
                <span className="js-search-loader" aria-hidden="true"></span>
              </button>
              <input
                ref={inputRef}
                type="text"
                name="q"
                className="js-frontend-search-input"
                placeholder="What are you looking for?"
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </form>
          <div className="suggestions">
            <nav>
              <h4 className="title">Suggestions</h4>
              <ul className="list-unstyled js-search-suggestions">
                {categories.length > 0
                  ? categories.map((category) => (
                  <li key={category.id}>
                    <a
                      href={category.url}
                      className="js-search-suggestion"
                      data-query={category.title}
                      onClick={onSuggestion(category.title)}
                    >
                      {category.title}
                    </a>
                  </li>
                  ))
                  : (
                  <li><Link to="/collection" onClick={close}>Collection</Link></li>
                  )}
              </ul>
            </nav>
          </div>
        </div>
        <div className="search-products">
          <h3 className="title js-search-results-title">{title}</h3>
          <div className="product-wrap js-search-results">
            {results === null ? (
              <div className="js-search-empty text-muted py-3">{emptyMessage}</div>
            ) : results.length === 0 ? (
              <div className="js-search-empty text-muted py-3">No products found.</div>
            ) : (
              results.map((product) => (
                <Link key={product.id} to={product.url} className="d-block w-100" onClick={close}>
                  <div className="product-item d-flex align-items-center">
                    <div className="img flex-shrink-0 overflow-hidden">
                      <img src={product.image} alt={product.title} className="img-fluid w-100" />
                    </div>
                    <div className="text">
                      <h4 className="name">{product.title}</h4>
                      <p className="price"><PpPrice product={product} /></p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
          <div className="product-btn position-sticky js-search-see-all" style={{ display: seeAllUrl ? '' : 'none' }}>
            <Link className="su-btn-4 su-btn-16-black su-left-right text-center w-100" to={seeAllUrl || '/shop'} onClick={close}>
              <span className="mr10 su-text d-inline-block text-white">SEE ALL PRODUCTS</span>
              <span className="su-arrow-angle">
                <svg className="su-arrow-svg-top-right" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10.00 10.00">
                  <path d="M1.018 10.009 0 8.991l7.569-7.582H1.723L1.737 0h8.26v8.274H8.574l.013-5.847Z" />
                  <path d="M1.018 10.009 0 8.991l7.569-7.582H1.723L1.737 0h8.26v8.274H8.574l.013-5.847Z" />
                </svg>
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
