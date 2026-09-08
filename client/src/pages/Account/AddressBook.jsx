import { useState } from 'react'
import { useForm } from 'react-hook-form'
import * as api from '../../services/endpoints.js'

const BLANK = {
  name: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
  phone: '',
  label: '',
  is_default: false,
}

/**
 * Saved addresses.
 *
 * The first address a customer saves becomes the default automatically — that rule lives
 * on the server, so the list is replaced with what the server returns rather than being
 * patched optimistically.
 */
export default function AddressBook({ addresses, onChange }) {
  const [editing, setEditing] = useState(null)
  const [failure, setFailure] = useState(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: BLANK })

  const startCreate = () => {
    setEditing('new')
    reset(BLANK)
  }

  const startEdit = (address) => {
    setEditing(address.id)
    reset({
      name: address.name ?? '',
      address_line1: address.line1 ?? '',
      address_line2: address.line2 ?? '',
      city: address.city ?? '',
      state: address.state ?? '',
      pincode: address.postcode ?? '',
      country: address.country ?? 'India',
      phone: address.phone ?? '',
      label: address.type ?? '',
      is_default: address.default ?? false,
    })
  }

  const refresh = async () => {
    const { addresses: next } = await api.account.addresses()
    onChange(next)
  }

  const onSubmit = async (values) => {
    setFailure(null)
    try {
      if (editing === 'new') {
        await api.account.createAddress(values)
      } else {
        await api.account.updateAddress(editing, values)
      }
      await refresh()
      setEditing(null)
    } catch (error) {
      if (error.errors) {
        Object.entries(error.errors).forEach(([field, messages]) =>
          setError(field, { type: 'server', message: messages[0] }),
        )
      }
      setFailure(error.message)
    }
  }

  const remove = async (address) => {
    await api.account.deleteAddress(address.id)
    await refresh()
  }

  const makeDefault = async (address) => {
    await api.account.setDefaultAddress(address.id)
    await refresh()
  }

  const field = (name, label, required = false) => (
    <div className="form-group">
      <label htmlFor={`ad-${name}`}>{label}</label>
      <input
        id={`ad-${name}`}
        className="form-control"
        {...register(name, required ? { required: `${label} is required.` } : {})}
      />
      {errors[name] && <p style={{ color: '#b00', fontSize: 13 }}>{errors[name].message}</p>}
    </div>
  )

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Addresses</h2>
        <button type="button" className="btn btn-outline-dark" onClick={startCreate}>
          Add address
        </button>
      </div>

      {failure && (
        <div className="alert alert-danger" role="alert">
          {failure}
        </div>
      )}

      {editing && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          style={{ border: '1px solid #eee', padding: 16, margin: '16px 0' }}
        >
          <h3 style={{ fontSize: 16 }}>{editing === 'new' ? 'New address' : 'Edit address'}</h3>

          {field('name', 'Full name', true)}
          {field('address_line1', 'Address', true)}
          {field('address_line2', 'Apartment, suite (optional)')}

          <div className="row">
            <div className="col-sm-4">{field('city', 'City', true)}</div>
            <div className="col-sm-4">{field('state', 'State')}</div>
            <div className="col-sm-4">{field('pincode', 'Pincode', true)}</div>
          </div>

          <div className="row">
            <div className="col-sm-6">{field('country', 'Country', true)}</div>
            <div className="col-sm-6">{field('phone', 'Phone')}</div>
          </div>

          {field('label', 'Label (Home, Work…)')}

          <div className="form-check">
            <input
              id="ad-default"
              type="checkbox"
              className="form-check-input"
              {...register('is_default')}
            />
            <label htmlFor="ad-default" className="form-check-label">
              Use as my default address
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save address'}
            </button>
            <button type="button" className="btn btn-link" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {addresses.length === 0 && !editing ? (
        <p style={{ opacity: 0.7 }}>You have not saved any addresses yet.</p>
      ) : (
        <div className="row">
          {addresses.map((address) => (
            <div className="col-md-6" key={address.id}>
              <article style={{ border: '1px solid #eee', padding: 16, marginBottom: 16 }}>
                {address.default && <span className="pp-badge">Default</span>}
                <strong style={{ display: 'block' }}>{address.name}</strong>
                <p style={{ margin: '6px 0', opacity: 0.85 }}>
                  {[address.line1, address.line2, address.city, address.state, address.postcode, address.country]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                {address.phone && <p style={{ margin: 0, opacity: 0.7 }}>{address.phone}</p>}

                <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                  <button type="button" onClick={() => startEdit(address)}>
                    Edit
                  </button>
                  {!address.default && (
                    <button type="button" onClick={() => makeDefault(address)}>
                      Make default
                    </button>
                  )}
                  <button type="button" onClick={() => remove(address)}>
                    Delete
                  </button>
                </div>
              </article>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
