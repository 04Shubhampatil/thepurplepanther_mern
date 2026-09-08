import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import * as api from '../../services/endpoints.js'
import Seo from '../../components/common/Seo.jsx'
import Button from '../../components/ui/Button.jsx'
import Alert from '../../components/ui/Alert.jsx'
import { Field, Input } from '../../components/ui/Field.jsx'
import AuthCard from './AuthCard.jsx'

/**
 * Forgot password.
 *
 * The server caps this at 2 emails per address per 24 hours and returns 429 with an
 * explanatory message, which is surfaced as-is rather than retried.
 */
export default function ForgotPassword() {
  const [status, setStatus] = useState(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async ({ email }) => {
    setStatus(null)
    try {
      const data = await api.auth.forgotPassword(email)
      const remaining =
        data?.remaining_attempts !== undefined
          ? ` You have ${data.remaining_attempts} request(s) left today.`
          : ''
      setStatus({
        ok: true,
        message: `A password reset link has been sent to your email.${remaining}`,
      })
    } catch (error) {
      setStatus({ ok: false, message: error.message })
    }
  }

  return (
    <AuthCard
      title="Reset your password"
      intro="Enter your email address and we will send you a link to choose a new password."
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
      <Seo title="Reset your password" noIndex />

      {status && (
        <Alert tone={status.ok ? 'success' : 'error'} className="mb-5">
          {status.message}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Field label="Email" htmlFor="fp-email" required error={errors.email?.message}>
          <Input
            id="fp-email"
            type="email"
            autoComplete="email"
            error={errors.email}
            {...register('email', { required: 'Please enter your email address.' })}
          />
        </Field>

        <Button type="submit" size="sm" loading={isSubmitting} className="w-full">
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthCard>
  )
}
