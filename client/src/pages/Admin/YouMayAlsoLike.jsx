import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { useApi } from '../../hooks/useApi.js'
import { Card, Button } from '../../components/admin/AdminUI.jsx'
import { FormGroup, FORM_CONTROL } from '../../components/admin/AdminControls.jsx'
import { usePageTitle } from '../../theme/page.js'
import { toast } from '../../store/toast.js'
import * as api from '../../services/endpoints.js'
import { fetchAllProducts } from '../../utils/all-products.js'

/**
 * "You May Also Like" — the products the admin curates for the rail that appears on the
 * product details page and the cart page.
 *
 * Stored through the SAME endpoint Shop the Look uses, under its own section key, because
 * `home_section_products` already models "an ordered list of products under a name". A
 * second table would have duplicated the ordering, the replace-in-one-transaction save and
 * the admin shape for no gain.
 *
 * Unlike Shop the Look this list is any length, so it is a list with add and remove rather
 * than a fixed pair of selects. Order is the display order: position 1 shows first.
 *
 * Leaving the list EMPTY is a valid state, not a broken one — both pages then fall back to
 * their existing automatic picks, so the rail is never blank.
 */
const SECTION = 'you_may_also_like'

export default function YouMayAlsoLike() {
  usePageTitle('You May Also Like - Purple Panther')

  const [selected, setSelected] = useState([])
  const [toAdd, setToAdd] = useState('')
  const [saving, setSaving] = useState(false)

  const { data, refetch } = useApi(() => api.admin.homeSections.get(SECTION), [])
  // Every product, paged through: the list endpoint clamps per_page to 100.
  const { data: allProducts } = useApi(() => fetchAllProducts(), [])

  const products = allProducts ?? []

  // The API returns the rows already ordered by position.
  useEffect(() => {
    setSelected((data?.items ?? []).map((row) => String(row.productId)).filter(Boolean))
  }, [data])

  const byId = useMemo(
    () => new Map(products.map((product) => [String(product.id), product])),
    [products],
  )

  // A product already on the list must not be offered again — adding it twice would break
  // the (section, position) pair the server writes.
  const available = products.filter((product) => !selected.includes(String(product.id)))

  function add() {
    if (!toAdd || selected.includes(toAdd)) return
    setSelected((prev) => [...prev, toAdd])
    setToAdd('')
  }

  const remove = (id) => setSelected((prev) => prev.filter((value) => value !== id))

  /** Order is meaningful, so the list can be reordered without removing and re-adding. */
  function move(index, delta) {
    setSelected((prev) => {
      const next = [...prev]
      const target = index + delta
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function onSave(event) {
    event.preventDefault()
    setSaving(true)

    try {
      const res = await api.admin.homeSections.update(SECTION, selected)
      toast.success(res.$message)
      refetch()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="mb-[18px]">
        <Link
          to="/admin/products"
          className="mb-1.5 inline-block text-[14px] font-semibold text-admin-primary hover:underline"
        >
          ← Back to Products
        </Link>
        <h2 className="text-[26px] font-bold text-[#333]">You May Also Like</h2>
      </div>

      <Card className="mb-4 max-w-[980px]">
        <h3 className="mb-1.5 text-[18px] font-bold text-[#333]">Recommended Products</h3>
        <p className="mb-[18px] text-[12px] leading-[1.3] text-[#888]">
          These products appear under “You May Also Like” on the product details page and the
          cart page, in the order listed. Leave the list empty to let the site choose
          automatically. A product is skipped while it is inactive, and is never shown on its
          own product page or when it is already in the customer’s bag.
        </p>

        <form onSubmit={onSave}>
          <div className="grid grid-cols-1 items-end gap-3 min-[576px]:grid-cols-[1fr_auto]">
            <FormGroup label="Add a product">
              <select
                value={toAdd}
                onChange={(event) => setToAdd(event.target.value)}
                className={FORM_CONTROL}
              >
                <option value="">-- Select product --</option>
                {available.map((product) => (
                  <option key={product.id} value={String(product.id)}>{product.title}</option>
                ))}
              </select>
            </FormGroup>

            <div className="pb-[2px]">
              <Button type="button" onClick={add} disabled={!toAdd}>Add</Button>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-[#eee]">
            {selected.length === 0 ? (
              <p className="m-0 p-4 text-[13px] text-[#888]">
                No products selected. The site will pick recommendations automatically.
              </p>
            ) : (
              <ol className="m-0 list-none p-0">
                {selected.map((id, index) => {
                  const product = byId.get(id)
                  return (
                    <li
                      key={id}
                      className="flex items-center gap-3 border-b border-[#f0f0f0] p-2.5 last:border-b-0"
                    >
                      <span className="w-6 shrink-0 text-center text-[12px] font-bold text-[#888]">
                        {index + 1}
                      </span>

                      {product?.image ? (
                        <img
                          src={product.image}
                          alt=""
                          className="size-10 shrink-0 rounded object-cover"
                        />
                      ) : null}

                      <span className="min-w-0 flex-1 truncate text-[13px] text-[#333]">
                        {/* A product deleted since it was picked still has a row; name it
                            rather than rendering a blank line the admin cannot act on. */}
                        {product?.title ?? `Product #${id} (no longer available)`}
                      </span>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => move(index, -1)}
                          disabled={index === 0}
                          aria-label="Move up"
                          className="rounded border border-[#ddd] px-2 py-1 text-[12px] text-[#555] disabled:opacity-40"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => move(index, 1)}
                          disabled={index === selected.length - 1}
                          aria-label="Move down"
                          className="rounded border border-[#ddd] px-2 py-1 text-[12px] text-[#555] disabled:opacity-40"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(id)}
                          aria-label={`Remove ${product?.title ?? 'product'}`}
                          className="flex size-[30px] items-center justify-center rounded bg-[#ff7043] text-white hover:bg-[#f4511e]"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>

          <div className="pt-[18px]">
            <Button type="submit" loading={saving} disabled={saving}>Save Products</Button>
          </div>
        </form>
      </Card>
    </>
  )
}
