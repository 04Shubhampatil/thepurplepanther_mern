import { useState } from 'react'
import { useForm } from 'react-hook-form'
import * as api from '../../services/endpoints.js'
import { useAuthStore } from '../../store/index.js'
import Button from '../../components/ui/Button.jsx'
import Alert from '../../components/ui/Alert.jsx'
import { Field, Input, Textarea } from '../../components/ui/Field.jsx'

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
    <section className="mt-12 max-w-2xl border-t border-line pt-8">
      <h2 className="text-[19px] font-semibold text-ink">Still need help?</h2>

      {status && (
        <Alert tone={status.ok ? 'success' : 'error'} className="mt-4">
          {status.message}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Your name" htmlFor="cf-name" required error={errors.name?.message}>
            <Input
              id="cf-name"
              autoComplete="name"
              error={errors.name}
              {...register('name', { required: 'Please enter your name.' })}
            />
          </Field>

          <Field label="Your email" htmlFor="cf-email" required error={errors.email?.message}>
            <Input
              id="cf-email"
              type="email"
              autoComplete="email"
              error={errors.email}
              {...register('email', { required: 'Please enter a valid email address.' })}
            />
          </Field>
        </div>

        <Field label="Subject" htmlFor="cf-subject">
          <Input id="cf-subject" {...register('subject')} />
        </Field>

        <Field label="Message" htmlFor="cf-message" required error={errors.message?.message}>
          <Textarea
            id="cf-message"
            rows={5}
            error={errors.message}
            {...register('message', { required: 'Please enter a message.' })}
          />
        </Field>

        <Button type="submit" size="sm" loading={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send message'}
        </Button>
      </form>
    </section>
  )
}
