import { useApi } from '../../hooks/useApi.js'
import * as api from '../../services/endpoints.js'
import Seo from '../../components/common/Seo.jsx'

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
    <div className="pp-about">
      <Seo
        title="About"
        description="The Purple Panther — considered pieces, made to be worn beyond the ordinary."
      />

      <div className="container" style={{ padding: '48px 0', maxWidth: 820 }}>
        <h1>Beyond ordinary</h1>

        <p style={{ fontSize: 18, opacity: 0.85 }}>
          The Purple Panther began with a simple idea: that everyday clothing deserves the same
          care as occasion wear.
        </p>

        <p>
          We design in small runs, choose fabrics that improve with wear, and finish each piece
          properly. Nothing here is made to be replaced next season.
        </p>

        {story?.description && <p>{story.description}</p>}
      </div>

      {grid?.images?.length > 0 && (
        <div className="container" style={{ paddingBottom: 48 }}>
          <div className="row">
            {grid.images.map((image) => (
              <div className="col-md-4 col-sm-6" key={image.id}>
                <figure style={{ margin: 0, marginBottom: 24 }}>
                  <img src={image.image} alt={image.title ?? ''} style={{ width: '100%' }} loading="lazy" />
                  {image.title && <figcaption style={{ marginTop: 8 }}>{image.title}</figcaption>}
                </figure>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
