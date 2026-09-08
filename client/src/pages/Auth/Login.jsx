import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/index.js'
import Seo from '../../components/common/Seo.jsx'
import Button from '../../components/ui/Button.jsx'
import Alert from '../../components/ui/Alert.jsx'
import { Field, Input } from '../../components/ui/Field.jsx'
import AuthCard from './AuthCard.jsx'

export default function Login() {
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const location = useLocation()
  const [failure, setFailure] = useState(null)

  // ResetPassword sends the customer here with a confirmation to show.
  const notice = location.state?.notice ?? null

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async (values) => {
    setFailure(null)
    try {
      await login(values)
      // Return the customer to wherever they were headed before the guard intervened.
      navigate(location.state?.from ?? '/account/overview', { replace: true })
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
      title="Sign in"
      footer={
        <>
          <p>
            <Link
              to="/forgot-password"
              className="text-ink underline underline-offset-2 transition-colors hover:text-brand"
            >
              Forgotten your password?
            </Link>
          </p>
          <p>
            New here?{' '}
            <Link
              to="/signup"
              className="text-ink underline underline-offset-2 transition-colors hover:text-brand"
            >
              Create an account
            </Link>
          </p>
        </>
      }
    >
      <Seo title="Sign in" noIndex />

      {notice && (
        <Alert tone="success" className="mb-5">
          {notice}
        </Alert>
      )}

      {failure && (
        <Alert tone="error" className="mb-5">
          {failure}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Field label="Email" htmlFor="login-email" required error={errors.email?.message}>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            error={errors.email}
            {...register('email', { required: 'Please enter your email address.' })}
          />
        </Field>

        <Field label="Password" htmlFor="login-password" required error={errors.password?.message}>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            error={errors.password}
            {...register('password', { required: 'Please enter your password.' })}
          />
        </Field>

        <Button type="submit" size="sm" loading={isSubmitting} className="w-full">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthCard>
  )
}
