import { usePageTitle } from '../../theme/page.js'

/**
 * frontend/pages/about.blade.php — Our Story.
 *
 * Entirely static: the Blade file has no variables at all, and the page has no `<main>`
 * wrapper either — its `<section>` sits directly under `.wrapper`, which is reproduced by
 * returning the section on its own rather than adding a container the theme has no rule for.
 */
export default function About() {
  usePageTitle('Our Story - The Purple Panther')

  return (

        <section className="about-editorial" aria-labelledby="editorial-story-title">
          <div className="container about-editorial__container">
            <header className="about-editorial__intro">
              <p className="about-editorial__eyebrow">QUIETLY POWERFUL</p>
              <h1 id="editorial-story-title">
               “ Clothing for the woman who moves effortlessly from 9am to night. The Purple Panther creates refined workwear that transitions from meetings to dinners—understated, distinctive, and designed to be remembered for her presence, not her clothes.”  </h1>

            </header>

            <div className="about-editorial__feature container container-1630">
              <figure className="about-editorial__visual">
                <img src="/frontend/images/our-story-5.jpg" alt="Purple Panther timeless shirt tailoring" loading="eager" />
              </figure>

              <article className="about-editorial__content">
                <h2>WHAT WE BRING </h2>
                <p className="about-editorial__eyebrow">9 AM to Night</p>
                <p>We design for the hours beyond the office.</p>
                <p>Pieces that feel appropriate at 9 AM without feeling too corporate at 9 PM. Thoughtful silhouettes, subtle details and effortless versatility allow the same garment to move through different parts of a woman's day.</p>
                <p>Because she shouldn't need a wardrobe change every time the setting changes.</p>
              </article>
            </div>

            <div className="about-editorial__feature about2 container container-1630">

 
              <article className="about-editorial__content">
                <h2>OUR STRENGTH</h2>
                <p className="about-editorial__eyebrow">Finest Fabrics</p>
                <p> Everything begins with how a garment feels</p>

                <p> We work with premium fabrics including Egyptian Giza cotton, Supima cotton and Cotton Tencel, selected for their softness, breathability and drape.</p>

                <p> Materials chosen not simply because they are premium, but because they make sense for the modern Indian woman and the climate she lives and works in.</p>

                <p> Luxury, to us, should be felt before it is noticed.</p>
              </article>

              <figure className="about-editorial__visual">
                <img src="/frontend/images/our-story-4.jpg" alt="Purple Panther timeless shirt tailoring" loading="eager" />
              </figure>
            </div>

            <div className="about-editorial__feature container container-1630">
              <figure className="about-editorial__visual">
                <img src="/frontend/images/our-story-3.jpg" alt="Purple Panther timeless shirt tailoring" loading="eager" />
              </figure>

              <article className="about-editorial__content">
                <h2>UNIQUE DISTINCTION</h2>
                <p className="about-editorial__eyebrow">Distinctive in Form</p>
                <p>We believe simplicity doesn't have to mean ordinary. </p>

    <p>Instead of relying on loud prints or excessive embellishment, we let silhouette, proportion and construction create distinction.</p>

    <p>An architectural collar. A considered cuff. An unexpected pleat. A beautifully placed pintuck. Details you may not notice immediately, but ones that make the garment feel unmistakably different.</p>

    <p>Plain in fabric. Distinctive in form.</p>
              </article>
            </div>

            <div className="about-editorial__feature about2 container container-1630">


              <article className="about-editorial__content">
                <h2>TOP CRAFTSMANSHIP</h2>
                <p className="about-editorial__eyebrow">Made with Intention</p>
                <p>A simple garment leaves nowhere for poor construction to hide.</p>

                <p> From the fall of a shoulder and shape of an armhole to the placement of a seam and structure of a collar, every element is considered with an emphasis on fit, finish and thoughtful construction.</p>

                <p> Because the smallest details often make the biggest difference.</p>
              </article>

              <figure className="about-editorial__visual">
                <img src="/frontend/images/our-story-2.jpg" alt="Purple Panther timeless shirt tailoring" loading="eager" />
              </figure>
            </div>


             <header className="about-editorial__intro">
              <p className="about-editorial__eyebrow">THE PANTHER</p>
         <h1 id="editorial-story-title">" Our mark is a seated panther still, watchful and completely at ease. It doesn't need to roar to command attention. It represents the woman we dress: quiet, composed and unmistakably confident. Not a performance. Not a costume. Not a different version of herself after hours. The same woman. Every room. 9 to night. "</h1>
            </header>


          </div>
        </section>
  )
}
