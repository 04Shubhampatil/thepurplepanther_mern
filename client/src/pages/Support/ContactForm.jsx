import { useState } from 'react'
import { useForm } from 'react-hook-form'
import * as api from '../../services/endpoints.js'
import { useAuthStore } from '../../store/index.js'

/** Contact form. Rate limited server-side, so a spam burst is refused rather than stored. */
export default function ContactForm({ subject = '' }) {
  const user = useAuthStore((s) => s.user)
  const [status, setStatus] = useState(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: user ? `${user.firstName} ${user.lastName}`.trim() : '',
      email: user?.email ?? '',
      subject,
      message: '',
    },
  })

  const onSubmit = async (values) => {
    setStatus(null)
    try {
      await api.misc.contact(values)
      setStatus({ ok: true, message: 'Thanks for getting in touch. We will reply shortly.' })
      reset({ ...values, message: '' })
    } catch (error) {
      if (error.errors) {
        Object.entries(error.errors).forEach(([field, messages]) =>
          setError(field, { type: 'server', message: messages[0] }),
        )
      }
      setStatus({ ok: false, message: error.message })
    }
  }

  return (
    <section style={{ marginTop: 40, borderTop: '1px solid #eee', paddingTop: 24 }}>
      <h2 style={{ fontSize: 19 }}>Still need help?</h2>

      {status && (
        <div className={`alert ${status.ok ? 'alert-success' : 'alert-danger'}`} role="status">
          {status.message}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="row">
          <div className="col-sm-6 form-group">
            <label htmlFor="cf-name">Your name</label>
            <input
              id="cf-name"
              className="form-control"
              {...register('name', { required: 'Please enter your name.' })}
            />
            {errors.name && <p style={{ color: '#b00', fontSize: 13 }}>{errors.name.message}</p>}
          </div>

          <div className="col-sm-6 form-group">
            <label htmlFor="cf-email">Your email</label>
            <input
              id="cf-email"
              type="email"
              className="form-control"
              {...register('email', { required: 'Please enter a valid email address.' })}
            />
            {errors.email && <p style={{ color: '#b00', fontSize: 13 }}>{errors.email.message}</p>}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="cf-subject">Subject</label>
          <input id="cf-subject" className="form-control" {...register('subject')} />
        </div>

        <div className="form-group">
          <label htmlFor="cf-message">Message</label>
          <textarea
            id="cf-message"
            rows="5"
            className="form-control"
            {...register('message', { required: 'Please enter a message.' })}
          />
          {errors.message && <p style={{ color: '#b00', fontSize: 13 }}>{errors.message.message}</p>}
        </div>

        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send message'}
        </button>
      </form>
    </section>
  )
}
