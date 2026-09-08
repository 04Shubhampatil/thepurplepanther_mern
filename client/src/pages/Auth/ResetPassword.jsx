import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import * as api from '../../services/endpoints.js'
import Seo from '../../components/common/Seo.jsx'
import Button from '../../components/ui/Button.jsx'
import Alert from '../../components/ui/Alert.jsx'
import { Field, Input } from '../../components/ui/Field.jsx'
import AuthCard from './AuthCard.jsx'

/**
 * Reset password.
 *
 * The token comes from the URL and the email from the query string, matching the link
 * format Laravel emailed — so reset links already in customers' inboxes keep working
 * across cutover.
 */
export default function ResetPassword() {
  const { token } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [failure, setFailure] = useState(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { email: searchParams.get('email') ?? '' } })

  const onSubmit = async (values) => {
    setFailure(null)
    try {
      await api.auth.resetPassword({ ...values, token })
      // The server deliberately does not sign the user in, so the new password is proven
      // at the login step.
      navigate('/login', {
        replace: true,
        state: { notice: 'Your password has been reset. Please sign in.' },
      })
    } catch (error) {
      setFailure(error.message)
    }
  }

  return (
    <AuthCard
      title="Choose a new password"
      footer={
        <p>
          <Link
            to="/login"
            className="text-ink underline underline-offset-2 transition-colors hover:text-brand"
          >
            Back to sign in
          </Link>
        </p>
      }
    >
      <Seo title="Choose a new password" noIndex />

      {failure && (
        <Alert tone="error" className="mb-5">
          {failure}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Field label="Email" htmlFor="rp-email" required error={errors.email?.message}>
          <Input
            id="rp-email"
            type="email"
            autoComplete="email"
            error={errors.email}
            {...register('email', { required: 'Please enter your email address.' })}
          />
        </Field>

        <Field
          label="New password"
          htmlFor="rp-password"
          required
          hint="At least 6 characters."
          error={errors.password?.message}
        >
          <Input
            id="rp-password"
            type="password"
            autoComplete="new-password"
            error={errors.password}
            {...register('password', {
              required: 'Please choose a password.',
              minLength: { value: 6, message: 'Password must be at least 6 characters.' },
            })}
          />
        </Field>

        <Field
          label="Confirm new password"
          htmlFor="rp-confirm"
          required
          error={errors.password_confirmation?.message}
        >
          <Input
            id="rp-confirm"
            type="password"
            autoComplete="new-password"
            error={errors.password_confirmation}
            {...register('password_confirmation', {
              validate: (value) => value === watch('password') || 'Passwords do not match.',
            })}
          />
        </Field>

        <Button type="submit" size="sm" loading={isSubmitting} className="w-full">
          {isSubmitting ? 'Saving…' : 'Save new password'}
        </Button>
      </form>
    </AuthCard>
  )
}
