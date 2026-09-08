import { useState } from 'react'
import { useForm } from 'react-hook-form'
import * as api from '../../services/endpoints.js'

/**
 * Account information.
 *
 * Changing the password requires the CURRENT one — the server enforces it, and the form
 * mirrors the rule so the customer is told before submitting rather than after.
 */
export default function ProfileForm({ customer, onSaved }) {
  const [failure, setFailure] = useState(null)

  const {
    register,
    handleSubmit,
    watch,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      first_name: customer.firstName ?? '',
      last_name: customer.lastName ?? '',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      birth_date: customer.birthDate ?? '',
      marketing_opt_in: customer.marketing ?? true,
      current_password: '',
      new_password: '',
      new_password_confirmation: '',
    },
  })

  const newPassword = watch('new_password')

  const onSubmit = async (values) => {
    setFailure(null)
    try {
      const { user } = await api.account.updateProfile(values)
      // Clear only the password fields; keep the saved details on screen.
      reset({ ...values, current_password: '', new_password: '', new_password_confirmation: '' })
      onSaved?.(user)
    } catch (error) {
      if (error.errors) {
        Object.entries(error.errors).forEach(([field, messages]) =>
          setError(field, { type: 'server', message: messages[0] }),
        )
      }
      setFailure(error.message)
    }
  }

  return (
    <section>
      <h2>Account information</h2>

      {failure && (
        <div className="alert alert-danger" role="alert">
          {failure}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="row">
          <div className="col-sm-6 form-group">
            <label htmlFor="pf-first">First name</label>
            <input
              id="pf-first"
              className="form-control"
              {...register('first_name', { required: 'Please enter your first name.' })}
            />
            {errors.first_name && <p style={{ color: '#b00' }}>{errors.first_name.message}</p>}
          </div>

          <div className="col-sm-6 form-group">
            <label htmlFor="pf-last">Last name</label>
            <input id="pf-last" className="form-control" {...register('last_name')} />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="pf-email">Email</label>
          <input
            id="pf-email"
            type="email"
            className="form-control"
            {...register('email', { required: 'Please enter your email address.' })}
          />
          {errors.email && <p style={{ color: '#b00' }}>{errors.email.message}</p>}
        </div>

        <div className="row">
          <div className="col-sm-6 form-group">
            <label htmlFor="pf-phone">Phone</label>
            <input id="pf-phone" type="tel" className="form-control" {...register('phone')} />
          </div>

          <div className="col-sm-6 form-group">
            <label htmlFor="pf-dob">Date of birth</label>
            <input id="pf-dob" type="date" className="form-control" {...register('birth_date')} />
            {errors.birth_date && <p style={{ color: '#b00' }}>{errors.birth_date.message}</p>}
          </div>
        </div>

        <div className="form-check" style={{ margin: '12px 0' }}>
          <input
            id="pf-marketing"
            type="checkbox"
            className="form-check-input"
            {...register('marketing_opt_in')}
          />
          <label htmlFor="pf-marketing" className="form-check-label">
            Send me news and offers
          </label>
        </div>

        <fieldset style={{ marginTop: 24, border: '1px solid #eee', padding: 16 }}>
          <legend style={{ fontSize: 16 }}>Change password</legend>
          <p style={{ fontSize: 13, opacity: 0.75 }}>Leave blank to keep your current password.</p>

          <div className="form-group">
            <label htmlFor="pf-new">New password</label>
            <input
              id="pf-new"
              type="password"
              autoComplete="new-password"
              className="form-control"
              {...register('new_password', {
                minLength: { value: 6, message: 'New password must be at least 6 characters.' },
              })}
            />
            {errors.new_password && <p style={{ color: '#b00' }}>{errors.new_password.message}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="pf-confirm">Confirm new password</label>
            <input
              id="pf-confirm"
              type="password"
              autoComplete="new-password"
              className="form-control"
              {...register('new_password_confirmation', {
                validate: (value) =>
                  !newPassword || value === newPassword || 'New passwords do not match.',
              })}
            />
            {errors.new_password_confirmation && (
              <p style={{ color: '#b00' }}>{errors.new_password_confirmation.message}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="pf-current">Current password</label>
            <input
              id="pf-current"
              type="password"
              autoComplete="current-password"
              className="form-control"
              {...register('current_password', {
                validate: (value) =>
                  !newPassword || Boolean(value) || 'Please enter your current password.',
              })}
            />
            {errors.current_password && (
              <p style={{ color: '#b00' }}>{errors.current_password.message}</p>
            )}
          </div>
        </fieldset>

        <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ marginTop: 16 }}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </section>
  )
}
