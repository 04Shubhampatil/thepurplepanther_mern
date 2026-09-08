import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import * as api from '../../services/endpoints.js'
import { useAuthStore } from '../../store/index.js'
import Seo from '../../components/common/Seo.jsx'

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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f3eef6',
      }}
    >
      <Seo title="Admin sign in" noIndex />

      <div style={{ width: 'min(400px, 92vw)', background: '#fff', padding: 32, border: '1px solid #e4d8ea' }}>
        <h1 style={{ fontSize: 22, marginBottom: 20 }}>Admin sign in</h1>

        {failure && (
          <div className="alert alert-danger" role="alert">
            {failure}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="form-group">
            <label htmlFor="al-username">Username or email</label>
            <input
              id="al-username"
              autoComplete="username"
              className="form-control"
              {...register('username', { required: 'Please enter your username or email.' })}
            />
            {errors.username && <p style={{ color: '#b00' }}>{errors.username.message}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="al-password">Password</label>
            <input
              id="al-password"
              type="password"
              autoComplete="current-password"
              className="form-control"
              {...register('password', { required: 'Please enter your password.' })}
            />
            {errors.password && <p style={{ color: '#b00' }}>{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
            style={{ width: '100%' }}
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
