import { MATERIALS } from './beyondOrdinaryMaterials.js'
import { useBodyClass, usePageStylesheet, usePageTitle } from '../../theme/page.js'

/**
 * frontend/pages/beyond-ordinary.blade.php.
 *
 * The only page that loads beyond-ordinary.css, and it is loaded here on mount rather than
 * in index.html: those rules are written to override style.css, so having them present on
 * every other page would change pages they were never meant to touch.
 *
 * Alternating materials get `--reverse`, which Blade set with `$loop->even`. Laravel's
 * `$loop->even` is true on the SECOND item (its index is 1-based), so the React condition
 * is `index % 2 === 1` — using `index % 2 === 0` would mirror the wrong four panels.
 */
export default function BeyondOrdinary() {
  useBodyClass('beyond-ordinary-page')
  usePageStylesheet('/frontend/css/beyond-ordinary.css?v=intro-editorial-5')
  usePageTitle('Beyond Ordinary - The Purple Panther')

  return (
    <main>
      <section className="beyond-ordinary-hero" aria-labelledby="beyond-ordinary-title">
        <img className="beyond-ordinary-hero__image" src="/frontend/images/beyond-ordinary/hero-editorial.jpg" alt="Woman wearing a precisely tailored ivory shirt" width="1536" height="1024" fetchPriority="high" />
        <div className="beyond-ordinary-hero__shade"></div>
        <div className="beyond-ordinary-shell beyond-ordinary-hero__content">
          <h1 id="beyond-ordinary-title">BEYOND ORDINARY</h1>
          <p className="beyond-ordinary-hero__tagline"><em>Because what you wear every day deserves more thought.</em></p>
        </div>
      </section>

      <section className="beyond-ordinary-intro beyond-ordinary-shell">
        <div className="beyond-ordinary-intro__layout beyond-ordinary-reveal">
          <header className="beyond-ordinary-intro__heading">
            <p>OUR APPROACH</p>
            <h2>Why beyond ordinary</h2>
          </header>
          <div className="beyond-ordinary-intro__copy">
            <p className="beyond-ordinary-intro__lead">We wanted to make something worth wearing differently.</p>
            <p>From the fibres we choose to the way each garment is cut, constructed &amp; finished, every decision is made with a purpose.</p>
            <p className="beyond-ordinary-intro__statement">Not loud.<br />Not excessive.<br />Just more considered.</p>
            <p>Because everyday deserves better.</p>
          </div>
        </div>
        <div className="beyond-ordinary-fabrics beyond-ordinary-reveal">
          <h2>The fabric choices:</h2>
          <ol>
            <li>EGYPTIAN GIZA COTTON</li>
            <li>100% PURE COTTON</li>
            <li>SUPIMA COTTON</li>
            <li>MODAL × LINEN</li>
          </ol>
        </div>
      </section>

      <section className="beyond-ordinary-craft">
        <div className="beyond-ordinary-shell">
          <header className="beyond-ordinary-section-heading beyond-ordinary-reveal">
            <h2>BETTER CRAFT</h2>
            <p><em>Because quality doesn't stop at the fabric.</em></p>
          </header>
          <div className="beyond-ordinary-craft__grid">
            <figure className="beyond-ordinary-craft__image beyond-ordinary-reveal">
              <img src="/frontend/images/beyond-ordinary/precision-stitching.webp" alt="Artisan guiding a precise shirt seam under a sewing machine" width="1536" height="1024" loading="lazy" />
            </figure>
            <div className="beyond-ordinary-craft__points">
              <article className="beyond-ordinary-reveal"><span>01</span><h3>FINEST FUSING</h3><p>Carefully selected fusing helps provide the garment with the right structure and support while maintaining a clean, refined appearance.</p></article>
              <article className="beyond-ordinary-reveal"><span>02</span><h3>THOUGHTFUL BUTTONS</h3><p>Buttons are selected as part of the garment's overall design, adding a considered finishing detail rather than being an afterthought.</p></article>
              <article className="beyond-ordinary-reveal"><span>03</span><h3>PRECISE STITCHING</h3><p>Attention to stitching helps create clean construction, consistency and a polished finish throughout the garment.</p></article>
              <article className="beyond-ordinary-reveal"><span>04</span><h3>CONSIDERED FINISHING</h3><p>From the inside of the garment to the final details, each finishing step is approached with the same attention to quality as the fabric itself.</p></article>
            </div>
          </div>
          <figure className="beyond-ordinary-craft__detail beyond-ordinary-reveal">
            <img src="storage/products/gallery/xOjHlXdA1y7IFkYWf4r4qaXCVyzqwYyoW9r9wKtK.jpg" alt="Refined shirt collar, button and inner seam finishing" width="1254" height="1254" loading="lazy" />
          </figure>
        </div>
      </section>

      <div className="beyond-ordinary-materials">
        {MATERIALS.map((material, index) => (
          <section
            className={`beyond-ordinary-material ${index % 2 === 1 ? 'beyond-ordinary-material--reverse' : ''}`}
            aria-labelledby={`beyond-ordinary-material-${material.number}`}
            key={material.number}
          >
            <div className="beyond-ordinary-shell beyond-ordinary-material__grid">
              <div className="beyond-ordinary-material__number" aria-hidden="true">{material.number}</div>
              <figure className="beyond-ordinary-material__visual beyond-ordinary-reveal">
                <img
                  src={`/frontend/images/beyond-ordinary/${material.image}`}
                  alt={material.alt}
                  width={material.width}
                  height={material.height}
                  loading="lazy"
                />
              </figure>
              <div className="beyond-ordinary-material__content beyond-ordinary-reveal">
                <h2 id={`beyond-ordinary-material-${material.number}`}>{material.number} — {material.title}</h2>
                <p className="beyond-ordinary-material__lead"><strong>{material.lead}</strong></p>
                <p>{material.description}</p>
                <dl className="beyond-ordinary-specs">
                  {material.specs.map(([label, value]) => (
                    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                  ))}
                </dl>
                <h3 className="beyond-ordinary-quality-title">QUALITY ICON</h3>
                <ul className="beyond-ordinary-qualities">
                  {material.qualities.map(([label, description]) => (
                    <li key={label}>
                      <span className="beyond-ordinary-quality-mark" aria-hidden="true"></span>
                      <p><strong>{label}</strong> {material.number === '01' ? '—' : '-'} {description}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
