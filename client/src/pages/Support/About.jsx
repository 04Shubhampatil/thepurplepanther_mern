import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import Seo from '../../components/common/Seo.jsx'
import Container from '../../components/ui/Container.jsx'
import Image from '../../components/ui/Image.jsx'

/**
 * About page.
 *
 * The `about_story_grid` banner is admin-editable, so the imagery can be changed from the
 * panel; the surrounding copy is static, as it was in Blade.
 */
export default function About() {
  const { data } = useApi(() => api.cms.banners(['about_story_grid', 'home_our_story']), [])
  const grid = data?.banners?.about_story_grid
  const story = data?.banners?.home_our_story

  return (
    <div>
      <Seo
        title="About"
        description="The Purple Panther — considered pieces, made to be worn beyond the ordinary."
      />

      <Container className="py-14 md:py-20">
        <div className="mx-auto max-w-[820px] text-center">
          <p className="pp-eyebrow text-brand">Our story</p>
          <h1 className="pp-display mt-3">Beyond ordinary</h1>

          <p className="mt-6 text-[18px] leading-relaxed text-ink">
            The Purple Panther began with a simple idea: that everyday clothing deserves the same
            care as occasion wear.
          </p>

          <p className="mt-4 leading-[1.9]">
            We design in small runs, choose fabrics that improve with wear, and finish each piece
            properly. Nothing here is made to be replaced next season.
          </p>

          {story?.description && <p className="mt-4 leading-[1.9]">{story.description}</p>}
        </div>
      </Container>

      {grid?.images?.length > 0 && (
        <Container className="pb-14 md:pb-20">
          <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {grid.images.map((image) => (
              <li key={image.id}>
                <figure>
                  <Image src={image.image} alt={image.title ?? ''} ratio="editorial" />
                  {image.title && (
                    <figcaption className="mt-3 text-[14px] text-ink">{image.title}</figcaption>
                  )}
                </figure>
              </li>
            ))}
          </ul>
        </Container>
      )}
    </div>
  )
}
