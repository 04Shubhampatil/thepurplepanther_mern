/**
 * The size-guide drawer from frontend/pages/shop-single.blade.php.
 *
 * script.js moves `.cloth-sidebar-overlay` and `.cloth-size-sidebar` to <body> and toggles
 * `.active` on them plus `product-size-closed` / `header-active` on <body>. That is a
 * fixed-position drawer over the whole page, so it is driven here from React state and the
 * same classes are written directly — moving React-owned nodes to <body> is what to avoid.
 *
 * The default chart is the theme's own static table, shown when a product has no
 * `size_guide_content` of its own.
 */
export default function SizeGuideDrawer({ product, open, onClose }) {
  return (
    <>
      <div
        className={`cloth-sidebar-overlay position-fixed top-0 start-0 w-100 h-100${open ? ' active' : ''}`}
        aria-hidden="true"
        onClick={onClose}
      ></div>
      <aside className={`cloth-size-sidebar position-fixed top-0 end-0 h-100${open ? ' active' : ''}`} aria-label="Size guide">
        <div className="header-info pb40 d-flex justify-content-between align-items-center">
          <h3 className="title mb-0">Size Guide</h3>
          <button type="button" className="close-cloth-sidebar bg-transparent border-0" aria-label="Close size guide" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
              <path d="M0.988364 10.4999C0.891779 10.4999 0.797359 10.4713 0.717046 10.4176C0.636734 10.364 0.574137 10.2877 0.537173 10.1985C0.500209 10.1092 0.49054 10.0111 0.509387 9.91633C0.528235 9.8216 0.574753 9.73459 0.643057 9.6663L9.66633 0.64303C9.75791 0.55145 9.88212 0.5 10.0116 0.5C10.1412 0.5 10.2654 0.55145 10.3569 0.64303C10.4485 0.734611 10.5 0.858822 10.5 0.988337C10.5 1.11785 10.4485 1.24206 10.3569 1.33364L1.33367 10.3569C1.28837 10.4023 1.23454 10.4383 1.17528 10.4628C1.11602 10.4874 1.0525 10.5 0.988364 10.4999Z" fill="#1D1D1D" />
              <path d="M10.0116 10.4999C9.94747 10.5 9.88395 10.4874 9.82469 10.4628C9.76543 10.4383 9.71161 10.4023 9.6663 10.3569L0.643031 1.33364C0.55145 1.24206 0.5 1.11785 0.5 0.988337C0.5 0.858822 0.55145 0.734611 0.643031 0.64303C0.734611 0.55145 0.858822 0.5 0.988337 0.5C1.11785 0.5 1.24206 0.55145 1.33364 0.64303L10.3569 9.6663C10.4252 9.73459 10.4717 9.8216 10.4906 9.91633C10.5094 10.0111 10.4998 10.1092 10.4628 10.1985C10.4258 10.2877 10.3632 10.364 10.2829 10.4176C10.2026 10.4713 10.1082 10.4999 10.0116 10.4999Z" fill="#1D1D1D" />
            </svg>
          </button>
        </div>
        <div className="details">
          {product.sizeGuideContent ? (
          <div className="product-size-guide__text" style={{ whiteSpace: 'pre-line' }}>{product.sizeGuideContent}</div>
          ) : (
          <div className="product-size-guide__table-wrap">
            <div className="size-chart">
              <h3>Size Chart (in inches)</h3>

              <table>
                <thead>
                  <tr>
                    <th>Size</th>
                    <th>Chest</th>
                    <th>Waist</th>
                    <th>Hip</th>
                    <th>Armhole</th>
                    <th>Shoulder</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>XS</td>
                    <td>32″</td>
                    <td>28″</td>
                    <td>36″</td>
                    <td>15″</td>
                    <td>14″</td>
                  </tr>
                  <tr>
                    <td>S</td>
                    <td>34″</td>
                    <td>30″</td>
                    <td>38″</td>
                    <td>16″</td>
                    <td>14.5″</td>
                  </tr>
                  <tr>
                    <td>M</td>
                    <td>36″</td>
                    <td>32″</td>
                    <td>40″</td>
                    <td>17.5″</td>
                    <td>15″</td>
                  </tr>
                  <tr>
                    <td>L</td>
                    <td>38″</td>
                    <td>34″</td>
                    <td>42″</td>
                    <td>19″</td>
                    <td>15.5″</td>
                  </tr>
                  <tr>
                    <td>XL</td>
                    <td>40″</td>
                    <td>36″</td>
                    <td>44″</td>
                    <td>20.5″</td>
                    <td>16″</td>
                  </tr>
                  <tr>
                    <td>XXL</td>
                    <td>42″</td>
                    <td>38″</td>
                    <td>46″</td>
                    <td>21.5″</td>
                    <td>16.5″</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
          )}
          {product.sizeGuideImage && (
          <div className="product-size-guide__image">
            <img src={product.sizeGuideImage} alt={`Size guide for ${product.title}`} className="img-fluid" />
          </div>
          )}
        </div>
      </aside>
    </>
  )
}
