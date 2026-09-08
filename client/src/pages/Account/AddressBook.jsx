import { useState } from 'react'
import * as api from '../../services/endpoints.js'

/**
 * The Addresses panel — `addresses()`, `addressCard()` and the dialog handlers in
 * account-dashboard.js.
 *
 * The form's own field names are the theme's (`full_name`, `line1`, `postcode`); the API
 * takes Laravel's column names (`name`, `address_line1`, `pincode`). The mapping happens on
 * submit rather than by renaming the inputs, because custom.css styles this dialog by those
 * names and the labels are what a customer sees.
 */
const EMPTY = {
  id: null,
  full_name: '',
  line1: '',
  city: '',
  postcode: '',
  country: '',
  type: 'Shipping',
  default: false,
}

export default function AddressBook({ addresses, onChanged }) {
  const [editing, setEditing] = useState(null)
  const [alert, setAlert] = useState('')
  const [saving, setSaving] = useState(false)

  const open = (address) => {
    setAlert('')
    setEditing(
      address
        ? {
            id: address.id,
            full_name: address.name ?? '',
            line1: address.line1 ?? '',
            city: address.city ?? '',
            postcode: address.postcode ?? '',
            country: address.country ?? '',
            type: address.type ?? 'Shipping',
            default: Boolean(address.default),
          }
        : { ...EMPTY },
    )
  }

  const bind = (name) => ({
    value: editing?.[name] ?? '',
    onChange: (event) => setEditing((current) => ({ ...current, [name]: event.target.value })),
  })

  async function save() {
    setAlert('')
    setSaving(true)

    const payload = {
      name: editing.full_name,
      address_line1: editing.line1,
      city: editing.city,
      pincode: editing.postcode,
      country: editing.country,
      label: editing.type,
      is_default: editing.default,
    }

    try {
      if (editing.id) await api.account.updateAddress(editing.id, payload)
      else await api.account.createAddress(payload)

      setEditing(null)
      onChanged?.(editing.id ? 'Address updated.' : 'Address added.')
    } catch (error) {
      setAlert(error.message || 'Could not save that address.')
    } finally {
      setSaving(false)
    }
  }

  async function makeDefault(id) {
    try {
      await api.account.setDefaultAddress(id)
      onChanged?.('Default address updated.')
    } catch (error) {
      onChanged?.(error.message || 'Could not set the default address.', true)
    }
  }

  async function remove(id) {
    // The original asked before deleting, via pp-confirm.js. Losing a saved address to a
    // mis-click is the kind of thing people notice at checkout, so the prompt stays.
    if (!window.confirm('Delete this address?')) return

    try {
      await api.account.deleteAddress(id)
      onChanged?.('Address deleted.')
    } catch (error) {
      onChanged?.(error.message || 'Could not delete that address.', true)
    }
  }

  return (
    <>
      <section className="account-panel">
        <div className="account-panel-head">
          <h2>Saved addresses</h2>
          <button className="account-text-button" type="button" data-add-address onClick={() => open(null)}>Add</button>
        </div>

        <div id="addressList" className="address-grid">
          {addresses.length === 0 ? (
            <div className="account-empty">
              <span aria-hidden="true">◇</span>
              <h3>No addresses added</h3>
              <p>Add a billing or shipping address for a faster checkout.</p>
            </div>
          ) : (
            addresses.map((address) => (
              <article className="address-card" data-address-id={address.id} key={address.id}>
                <div>
                  <span>{address.type || 'Shipping'}{address.default ? ' · Default' : ''}</span>
                  <h3>{address.name}</h3>
                  <p>
                    {address.line1}<br />
                    {address.city}, {address.postcode}<br />
                    {address.country}
                  </p>
                </div>
                <div>
                  <button type="button" data-edit-address={address.id} onClick={() => open(address)}>Edit</button>
                  <button type="button" data-default-address={address.id} onClick={() => makeDefault(address.id)}>Make default</button>
                  <button type="button" data-delete-address={address.id} onClick={() => remove(address.id)}>Delete</button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {/*
        Rendered as a plain <div class="account-dialog"> rather than a <dialog>: the theme's
        markup used <dialog> and showModal(), which React cannot open declaratively without
        an effect reaching for the DOM node. The class is what carries the styling.
      */}
      {editing && (
        <div id="addressDialog" className="account-dialog" open>
          <form id="addressForm" className="account-form" noValidate onSubmit={(event) => { event.preventDefault(); save() }}>
            <div className="account-panel-head">
              <h2 id="addressDialogTitle">{editing.id ? 'Edit address' : 'Add address'}</h2>
              <button type="button" data-close-address aria-label="Close" onClick={() => setEditing(null)}>×</button>
            </div>

            <div id="addressFormAlert" className="account-form-alert" role="alert" hidden={!alert}>{alert}</div>

            <input type="hidden" name="id" value={editing.id ?? ''} readOnly />

            <label>
              Full name
              <input type="text" name="full_name" required maxLength="255" autoComplete="name" {...bind('full_name')} />
              <span className="field-error"></span>
            </label>
            <label>
              Address
              <input type="text" name="line1" required maxLength="255" autoComplete="street-address" {...bind('line1')} />
              <span className="field-error"></span>
            </label>
            <div className="account-form-grid">
              <label>
                City
                <input type="text" name="city" required maxLength="120" autoComplete="address-level2" {...bind('city')} />
                <span className="field-error"></span>
              </label>
              <label>
                Postal code
                <input type="text" name="postcode" required maxLength="20" autoComplete="postal-code" {...bind('postcode')} />
                <span className="field-error"></span>
              </label>
            </div>
            <label>
              Country
              <input type="text" name="country" required maxLength="120" autoComplete="country-name" {...bind('country')} />
              <span className="field-error"></span>
            </label>
            <label>
              Type
              <select name="type" {...bind('type')}>
                <option value="Shipping">Shipping</option>
                <option value="Billing">Billing</option>
              </select>
              <span className="field-error"></span>
            </label>
            <label className="account-check">
              <input
                type="checkbox"
                name="default"
                value="1"
                checked={editing.default}
                onChange={(event) => setEditing((current) => ({ ...current, default: event.target.checked }))}
              />
              {' '}Make default address
            </label>

            <button className="account-primary" type="button" data-save-address disabled={saving} onClick={save}>
              Save address
            </button>
          </form>
        </div>
      )}
    </>
  )
}
