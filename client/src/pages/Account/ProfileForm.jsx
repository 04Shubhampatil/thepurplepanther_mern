import { useState } from 'react'
import { useForm } from 'react-hook-form'
import * as api from '../../services/endpoints.js'
import Button from '../../components/ui/Button.jsx'
import Alert from '../../components/ui/Alert.jsx'
import { Field, Input, Checkbox } from '../../components/ui/Field.jsx'

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
      <h2 className="pp-heading">Account information</h2>

      {failure && (
        <Alert tone="error" className="mt-5">
          {failure}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 max-w-2xl space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="First name" htmlFor="pf-first" required error={errors.first_name?.message}>
            <Input
              id="pf-first"
              autoComplete="given-name"
              error={errors.first_name}
              {...register('first_name', { required: 'Please enter your first name.' })}
            />
          </Field>

          <Field label="Last name" htmlFor="pf-last">
            <Input id="pf-last" autoComplete="family-name" {...register('last_name')} />
          </Field>
        </div>

        <Field label="Email" htmlFor="pf-email" required error={errors.email?.message}>
          <Input
            id="pf-email"
            type="email"
            autoComplete="email"
            error={errors.email}
            {...register('email', { required: 'Please enter your email address.' })}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Phone" htmlFor="pf-phone">
            <Input id="pf-phone" type="tel" autoComplete="tel" {...register('phone')} />
          </Field>

          <Field label="Date of birth" htmlFor="pf-dob" error={errors.birth_date?.message}>
            <Input
              id="pf-dob"
              type="date"
              error={errors.birth_date}
              {...register('birth_date')}
            />
          </Field>
        </div>

        <Checkbox
          id="pf-marketing"
          label="Send me news and offers"
          {...register('marketing_opt_in')}
        />

        <fieldset className="mt-8 border border-line p-5">
          <legend className="pp-eyebrow px-2 text-ink">Change password</legend>
          <p className="text-[13px] text-body">Leave blank to keep your current password.</p>

          <div className="mt-5 space-y-5">
            <Field
              label="New password"
              htmlFor="pf-new"
              hint="At least 6 characters."
              error={errors.new_password?.message}
            >
              <Input
                id="pf-new"
                type="password"
                autoComplete="new-password"
                error={errors.new_password}
                {...register('new_password', {
                  minLength: { value: 6, message: 'New password must be at least 6 characters.' },
                })}
              />
            </Field>

            <Field
              label="Confirm new password"
              htmlFor="pf-confirm"
              error={errors.new_password_confirmation?.message}
            >
              <Input
                id="pf-confirm"
                type="password"
                autoComplete="new-password"
                error={errors.new_password_confirmation}
                {...register('new_password_confirmation', {
                  validate: (value) =>
                    !newPassword || value === newPassword || 'New passwords do not match.',
                })}
              />
            </Field>

            <Field
              label="Current password"
              htmlFor="pf-current"
              error={errors.current_password?.message}
            >
              <Input
                id="pf-current"
                type="password"
                autoComplete="current-password"
                error={errors.current_password}
                {...register('current_password', {
                  validate: (value) =>
                    !newPassword || Boolean(value) || 'Please enter your current password.',
                })}
              />
            </Field>
          </div>
        </fieldset>

        <Button type="submit" size="sm" loading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </section>
  )
}
