import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useToastStore } from '../../store/toast.js'

/**
 * `#toast-container` — the fixed stack in the top-right corner.
 *
 * Ported from `.toast-container` / `.toast` in admin.css: 18px from the top and right,
 * 10px between cards, capped at `min(380px, 100vw - 24px)`. Each card is white at 8px
 * radius under `0 10px 30px rgba(0,0,0,.15)`, with a 4px left border that carries the tone
 * — #43a047 success, #e53935 error, #1e88e5 info.
 *
 * toast.js appended the element with `opacity:0; transform:translateY(-8px)` and added
 * `.toast-show` on the next frame, so the transition had a starting value to animate FROM.
 * Rendering the final state immediately would skip the animation entirely, which is why the
 * mount flag below exists rather than the classes being applied straight away.
 *
 * Portalled to `document.body` because toast.js appended there — inside the layout it would
 * sit under the sticky header's stacking context.
 */
const TONE_BORDER = {
  success: 'border-l-[#43a047]',
  error: 'border-l-[#e53935]',
  info: 'border-l-[#1e88e5]',
}

function Toast({ toast, onDismiss }) {
  const [shown, setShown] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    // requestAnimationFrame, as toast.js used — one frame after the element is in the DOM.
    const frame = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const hide = setTimeout(() => setLeaving(true), 4000)
    return () => clearTimeout(hide)
  }, [])

  // The 250ms in toast.js outlasts the 200ms transition, so the card is fully faded before
  // it leaves the DOM.
  useEffect(() => {
    if (!leaving) return undefined
    const remove = setTimeout(() => onDismiss(toast.id), 250)
    return () => clearTimeout(remove)
  }, [leaving, onDismiss, toast.id])

  const visible = shown && !leaving

  return (
    <div
      role="status"
      className={`flex items-start gap-2.5 rounded-lg border-l-4 bg-white p-3 pr-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.15)] transition-[opacity,transform] duration-200 ${
        TONE_BORDER[toast.tone] ?? 'border-l-[#999]'
      } ${visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`}
    >
      <span className="flex-1 text-[13px] leading-[1.4] text-[#333]">{toast.message}</span>
      <button
        type="button"
        aria-label="Close"
        onClick={() => setLeaving(true)}
        className="border-none bg-transparent px-0.5 text-[18px] leading-none text-[#999]"
      >
        ×
      </button>
    </div>
  )
}

export default function Toaster() {
  const toasts = useToastStore((state) => state.toasts)
  const dismiss = useToastStore((state) => state.dismiss)

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      id="toast-container"
      className="fixed right-[18px] top-[18px] z-[2000] flex w-[min(380px,calc(100vw-24px))] flex-col gap-2.5"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>,
    document.body,
  )
}
