import { AlertCircle, CheckCircle2, Info } from 'lucide-react'

const TONES = {
  error: { cls: 'border-red-200 bg-red-50 text-red-800', Icon: AlertCircle },
  success: { cls: 'border-brand/20 bg-brand-tint text-brand', Icon: CheckCircle2 },
  info: { cls: 'border-line bg-sand text-ink', Icon: Info },
}

/** Status message. `role` is alert for errors so screen readers announce them promptly. */
export default function Alert({ tone = 'info', children, className = '' }) {
  if (!children) return null
  const { cls, Icon } = TONES[tone] ?? TONES.info

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 border px-4 py-3 text-[14px] ${cls} ${className}`}
    >
      <Icon size={17} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}
