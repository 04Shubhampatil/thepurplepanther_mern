import { Link } from 'react-router-dom'
import PpPrice from '../product/PpPrice.jsx'

/**
 * frontend/partials/home-shop-look.blade.php — the two hotspots over the lookbook image.
 *
 * Blade took products 0 and 1 and fell back to product 0 for the right hotspot when only
 * one was curated, so the section never renders half-empty. The hover popup is the
 * theme's CSS on `.hotspot`/`.popup`; there is no JavaScript behind it.
 */
export default function ShopTheLook({ products }) {
  const left = products[0]
  const right = products[1] ?? products[0]

  return (
    <div className="hotspot-wrapper">
      {left && (
        <div className="hotspot hotspot-left">
          <span className="icon-plus"><i className="flaticon-plus fz10"></i></span>
          <div className="popup popup-left">
            <span className="popup-arrow popup-arrow-left"></span>
            <img src={left.image} alt={left.title} />
            <div className="popup-content">
              <h6 className="title"><Link to={left.url}>{left.title}</Link></h6>
              <div className="price"><PpPrice product={left} /></div>
            </div>
          </div>
        </div>
      )}
      {right && (
        <div className="hotspot hotspot-right">
          <span className="icon-plus"><i className="flaticon-plus fz10"></i></span>
          <div className="popup popup-right">
            <span className="popup-arrow popup-arrow-right"></span>
            <img src={right.image} alt={right.title} />
            <div className="popup-content">
              <h6 className="title"><Link to={right.url}>{right.title}</Link></h6>
              <div className="price"><PpPrice product={right} /></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
