import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, Pencil, Trash2, Star } from 'lucide-react'
import * as api from '../../services/endpoints.js'
import Button from '../../components/ui/Button.jsx'
import Badge from '../../components/ui/Badge.jsx'
import Alert from '../../components/ui/Alert.jsx'
import { Field, Input, Checkbox } from '../../components/ui/Field.jsx'

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

  const field = (name, label, required = false, className = '') => {
    const id = `ad-${name}`
    return (
      <Field
        label={label}
        htmlFor={id}
        required={required}
        error={errors[name]?.message}
        className={className}
      >
        <Input
          id={id}
          error={errors[name]}
          {...register(name, required ? { required: `${label} is required.` } : {})}
        />
      </Field>
    )
  }

  const action =
    'inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.08em] text-body transition-colors hover:text-brand'

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="pp-heading">Addresses</h2>
        <Button type="button" variant="outline" size="sm" onClick={startCreate}>
          <Plus size={15} strokeWidth={1.5} aria-hidden="true" />
          Add address
        </Button>
      </div>

      {failure && (
        <Alert tone="error" className="mt-5">
          {failure}
        </Alert>
      )}

      <AnimatePresence initial={false}>
        {editing && (
          <motion.form
            key="address-form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="overflow-hidden"
          >
            <div className="mt-6 border border-line p-5">
              <h3 className="pp-eyebrow text-ink">
                {editing === 'new' ? 'New address' : 'Edit address'}
              </h3>

              <div className="mt-5 space-y-5">
                {field('name', 'Full name', true)}
                {field('address_line1', 'Address', true)}
                {field('address_line2', 'Apartment, suite (optional)')}

                <div className="grid gap-5 sm:grid-cols-3">
                  {field('city', 'City', true)}
                  {field('state', 'State')}
                  {field('pincode', 'Pincode', true)}
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  {field('country', 'Country', true)}
                  {field('phone', 'Phone')}
                </div>

                {field('label', 'Label (Home, Work…)')}

                <Checkbox
                  id="ad-default"
                  label="Use as my default address"
                  {...register('is_default')}
                />
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button type="submit" size="sm" loading={isSubmitting}>
                  {isSubmitting ? 'Saving…' : 'Save address'}
                </Button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="text-[13px] text-body underline underline-offset-2 transition-colors hover:text-brand"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {addresses.length === 0 && !editing ? (
        <p className="mt-6 text-body">You have not saved any addresses yet.</p>
      ) : (
        <ul className="mt-6 grid gap-5 md:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id}>
              <article className="flex h-full flex-col border border-line p-5">
                {address.default && (
                  <Badge tone="outline" className="mb-3 self-start">
                    Default
                  </Badge>
                )}

                <p className="text-[14px] font-semibold text-ink">{address.name}</p>
                <address className="mt-1.5 flex-1 not-italic text-body">
                  {[
                    address.line1,
                    address.line2,
                    address.city,
                    address.state,
                    address.postcode,
                    address.country,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  {address.phone && (
                    <>
                      <br />
                      {address.phone}
                    </>
                  )}
                </address>

                <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-4">
                  <button type="button" onClick={() => startEdit(address)} className={action}>
                    <Pencil size={13} strokeWidth={1.5} aria-hidden="true" />
                    Edit
                    <span className="sr-only"> address for {address.name}</span>
                  </button>

                  {!address.default && (
                    <button type="button" onClick={() => makeDefault(address)} className={action}>
                      <Star size={13} strokeWidth={1.5} aria-hidden="true" />
                      Make default
                    </button>
                  )}

                  <button type="button" onClick={() => remove(address)} className={action}>
                    <Trash2 size={13} strokeWidth={1.5} aria-hidden="true" />
                    Delete
                    <span className="sr-only"> address for {address.name}</span>
                  </button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
