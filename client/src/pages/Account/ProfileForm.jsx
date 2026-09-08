import { useState } from 'react'
import * as api from '../../services/endpoints.js'

/**
 * The Information panel's form — the `information()` renderer in account-dashboard.js.
 *
 * Contact details and the password change are ONE form and one request, which is how the
 * original worked. Leaving the three password fields empty saves just the contact details;
 * the server only touches the password when a new one is supplied, and only after checking
 * the current one.
 */
export default function ProfileForm({ customer, onSaved }) {
  const [values, setValues] = useState({
    firstName: customer.firstName ?? '',
    lastName: customer.lastName ?? '',
    email: customer.email ?? '',
    phone: customer.phone ?? '',
    birthDate: customer.birthDate ?? '',
    currentPassword: '',
    newPassword: '',
    newPasswordConfirmation: '',
    marketing: Boolean(customer.marketing),
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const bind = (name) => ({
    value: values[name],
    onChange: (event) => setValues((current) => ({ ...current, [name]: event.target.value })),
  })

  const fieldError = (name) => <span className="field-error">{errors[name]?.[0] ?? ''}</span>

  async function onSubmit(event) {
    event.preventDefault()
    setErrors({})

    if (values.newPassword && values.newPassword !== values.newPasswordConfirmation) {
      setErrors({ new_password: ['The password confirmation does not match.'] })
      return
    }

    setSubmitting(true)
    try {
      const response = await api.account.updateProfile({
        first_name: values.firstName,
        last_name: values.lastName,
        email: values.email,
        phone: values.phone,
        birth_date: values.birthDate || null,
        marketing_opt_in: values.marketing,
        ...(values.newPassword
          ? {
              current_password: values.currentPassword,
              new_password: values.newPassword,
              new_password_confirmation: values.newPasswordConfirmation,
            }
          : {}),
      })

      setValues((current) => ({
        ...current,
        currentPassword: '',
        newPassword: '',
        newPasswordConfirmation: '',
      }))
      onSaved?.(response?.message ?? 'Your information has been saved.')
    } catch (error) {
      setErrors(error.errors ?? { email: [error.message] })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form id="informationForm" className="account-form" noValidate onSubmit={onSubmit}>
      <div className="account-form-grid">
        <label>
          First name
          <input name="firstName" required maxLength="120" {...bind('firstName')} />
          {fieldError('first_name')}
        </label>
        <label>
          Last name
          <input name="lastName" maxLength="120" {...bind('lastName')} />
          {fieldError('last_name')}
        </label>
        <label>
          Email address
          <input type="email" name="email" required {...bind('email')} />
          {fieldError('email')}
        </label>
        <label>
          Phone number
          <input type="tel" name="phone" pattern="[0-9 +()-]{7,20}" {...bind('phone')} />
          {fieldError('phone')}
        </label>
        <label>
          Date of birth
          <input type="date" name="birthDate" {...bind('birthDate')} />
          {fieldError('birth_date')}
        </label>
      </div>

      <hr />
      <h3>Change password</h3>

      <div className="account-form-grid">
        <label>
          Current password
          <input type="password" name="currentPassword" autoComplete="current-password" {...bind('currentPassword')} />
          {fieldError('current_password')}
        </label>
        <label>
          New password
          <input type="password" name="newPassword" minLength="6" autoComplete="new-password" {...bind('newPassword')} />
          {fieldError('new_password')}
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            name="newPasswordConfirmation"
            minLength="6"
            autoComplete="new-password"
            {...bind('newPasswordConfirmation')}
          />
          {fieldError('new_password_confirmation')}
        </label>
      </div>

      <label className="account-check">
        <input
          type="checkbox"
          name="marketing"
          checked={values.marketing}
          onChange={(event) => setValues((current) => ({ ...current, marketing: event.target.checked }))}
        />
        {' '}Receive news and product updates
      </label>

      <button className="account-primary" type="submit" disabled={submitting}>Save Changes</button>
    </form>
  )
}
