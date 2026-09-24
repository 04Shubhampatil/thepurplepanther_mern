import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../hooks/useApi.js'
import { Card, Button } from '../../components/admin/AdminUI.jsx'
import { FormGroup, FORM_CONTROL } from '../../components/admin/AdminControls.jsx'
import { usePageTitle } from '../../theme/page.js'
import { toast } from '../../store/toast.js'
import * as api from '../../services/endpoints.js'
import { fetchAllProducts } from '../../utils/all-products.js'

/**
 * admin/home-sections/edit.blade.php — "Shop the Look Products".
 *
 * Two `.product-form-card` panels (max-width 980px): the two-product picker, and a pointer
 * to Banners for everything else on the homepage.
 *
 * EXACTLY TWO products, in order. The homepage's hotspot section renders position 1 on the
 * left and position 2 on the right, so the select order is the display order — this is not a
 * multi-select that happens to hold two. The server replaces the section's rows inside one
 * transaction, because `(section, position)` is unique and a partial write would leave the
 * section empty.
 *
 * The Blade's `.product-pricing-row` is a three-column grid; with two fields they occupy the
 * first two columns, which is why the pair sits left-aligned rather than filling the width.
 */
const SECTION = 'shop_the_look'

export default function HomeSections() {
  usePageTitle('Home Section Products - Purple Panther')

  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [saving, setSaving] = useState(false)

  const { data, refetch } = useApi(() => api.admin.homeSections.get(SECTION), [])
  // Every product, paged through: the list endpoint clamps per_page to 100.
  const { data: allProducts } = useApi(() => fetchAllProducts(), [])

  const products = allProducts ?? []

  // Positions are 1 and 2; the API returns the rows already ordered by position.
  useEffect(() => {
    const items = data?.items ?? []
    setFirst(items[0]?.productId ? String(items[0].productId) : '')
    setSecond(items[1]?.productId ? String(items[1].productId) : '')
  }, [data])

  async function onSave(event) {
    event.preventDefault()
    setSaving(true)

    try {
      const res = await api.admin.homeSections.update(SECTION, [first, second].filter(Boolean))
      toast.success(res.$message)
      refetch()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const options = (
    <>
      <option value="">-- Select product --</option>
      {products.map((product) => (
        <option key={product.id} value={String(product.id)}>{product.title}</option>
      ))}
    </>
  )

  return (
    <>
      {/* .page-head with the back link stacked above the title */}
      <div className="mb-[18px]">
        <Link
          to="/admin/banners"
          className="mb-1.5 inline-block text-[14px] font-semibold text-admin-primary hover:underline"
        >
          ← Back to Home Content
        </Link>
        <h2 className="text-[26px] font-bold text-[#333]">Home Section Products</h2>
      </div>
      {/* .product-form-card — 16px below, capped at 980px */}
      <Card className="mb-4 max-w-[980px]">
        <h3 className="mb-1.5 text-[18px] font-bold text-[#333]">Shop the Look</h3>
        <p className="mb-[18px] text-[12px] leading-[1.3] text-[#888]">
          Select exactly the two products shown in the two-product hotspot section on the homepage.
        </p>

        <form onSubmit={onSave}>
          {/* .product-pricing-row — three columns; two fields fill the first two */}
          <div className="grid grid-cols-1 gap-3 min-[576px]:grid-cols-3">
            <FormGroup label="First Product">
              <select value={first} onChange={(event) => setFirst(event.target.value)} className={FORM_CONTROL}>
                {options}
              </select>
            </FormGroup>

            <FormGroup label="Second Product">
              <select value={second} onChange={(event) => setSecond(event.target.value)} className={FORM_CONTROL}>
                {options}
              </select>
            </FormGroup>
          </div>

          {/* .offer-form-actions — 18px above */}
          <div className="pt-[18px]">
            <Button type="submit" loading={saving} disabled={saving}>Save Products</Button>
          </div>
        </form>
      </Card>

      <Card className="mb-4 max-w-[980px]">
        <h3 className="mb-1.5 text-[18px] font-bold text-[#333]">All Other Home Sections</h3>
        <p className="mb-4 text-[14px] text-[#555]">
          Use <strong className="font-bold">Banners</strong> to manage Hero, Collection Tiles, Shop the Look image,
          New Arrivals image, Our Story, Fabric Library, and the final content section.
        </p>
        <Link
          to="/admin/banners"
          className="inline-flex items-center justify-center rounded-md bg-admin-primary px-4 py-[10px] text-[13px] font-semibold text-white transition-colors hover:bg-admin-primary-dark"
        >
          Manage Home Content
        </Link>
      </Card>
    </>
  )
}
