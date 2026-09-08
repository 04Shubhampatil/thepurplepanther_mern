import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import * as api from '../../services/endpoints.js'
import { useAuthStore } from '../../store/index.js'
import Seo from '../../components/common/Seo.jsx'
import Button from '../../components/ui/Button.jsx'
import Alert from '../../components/ui/Alert.jsx'
import { Field, Input } from '../../components/ui/Field.jsx'

/**
 * Admin sign-in.
 *
 * The single field accepts a username OR an email address, reproducing
 * Admin\AuthController::login — existing admins may be using either.
 */
export default function AdminLogin() {
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()
  const [failure, setFailure] = useState(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm()

  const onSubmit = async (values) => {
    setFailure(null)
    try {
      const { user } = await api.adminAuth.login(values)
      setUser(user)
      navigate('/admin/dashboard', { replace: true })
    } catch (error) {
      setFailure(error.message)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-brand-tint px-4 py-12">
      <Seo title="Admin sign in" noIndex />

      <div className="w-full max-w-[400px] border border-brand/15 bg-white p-8">
        <p className="font-alt text-[13px] font-bold uppercase tracking-[0.2em] text-brand">
          Purple Panther
        </p>
        <h1 className="mt-2 text-[22px] font-semibold text-ink">Admin sign in</h1>

        {failure && (
          <Alert tone="error" className="mt-5">
            {failure}
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-5">
          <Field
            label="Username or email"
            htmlFor="al-username"
            required
            error={errors.username?.message}
          >
            <Input
              id="al-username"
              autoComplete="username"
              error={errors.username}
              {...register('username', { required: 'Please enter your username or email.' })}
            />
          </Field>

          <Field label="Password" htmlFor="al-password" required error={errors.password?.message}>
            <Input
              id="al-password"
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
      </div>
    </div>
  )
}
