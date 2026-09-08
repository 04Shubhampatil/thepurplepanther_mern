import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/index.js'
import Seo from '../../components/common/Seo.jsx'
import Button from '../../components/ui/Button.jsx'
import Alert from '../../components/ui/Alert.jsx'
import { Field, Input } from '../../components/ui/Field.jsx'
import AuthCard from './AuthCard.jsx'

export default function Signup() {
  const registerUser = useAuthStore((s) => s.register)
  const navigate = useNavigate()
  const [failure, setFailure] = useState(null)

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async (values) => {
    setFailure(null)
    try {
      await registerUser(values)
      navigate('/account/overview', { replace: true })
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
    <AuthCard
      title="Create an account"
      footer={
        <p>
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-ink underline underline-offset-2 transition-colors hover:text-brand"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <Seo title="Create an account" noIndex />

      {failure && (
        <Alert tone="error" className="mb-5">
          {failure}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Field label="Full name" htmlFor="su-name" required error={errors.name?.message}>
          <Input
            id="su-name"
            autoComplete="name"
            error={errors.name}
            {...register('name', { required: 'Please enter your name.' })}
          />
        </Field>

        <Field label="Email" htmlFor="su-email" required error={errors.email?.message}>
          <Input
            id="su-email"
            type="email"
            autoComplete="email"
            error={errors.email}
            {...register('email', { required: 'Please enter your email address.' })}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="su-password"
          required
          hint="At least 6 characters."
          error={errors.password?.message}
        >
          <Input
            id="su-password"
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
          label="Confirm password"
          htmlFor="su-confirm"
          required
          error={errors.password_confirmation?.message}
        >
          <Input
            id="su-confirm"
            type="password"
            autoComplete="new-password"
            error={errors.password_confirmation}
            {...register('password_confirmation', {
              validate: (value) => value === watch('password') || 'Passwords do not match.',
            })}
          />
        </Field>

        <Button type="submit" size="sm" loading={isSubmitting} className="w-full">
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthCard>
  )
}
