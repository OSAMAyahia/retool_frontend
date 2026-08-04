import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { useEffect } from 'react'

export interface ToastMessage {
  tone: 'error' | 'success'
  text: string
}

interface ToastProps {
  toast: ToastMessage | null
  onDismiss: () => void
  // Auto-dismiss after this many ms. Set to 0 to require a manual close.
  durationMs?: number
}

const toneStyles: Record<ToastMessage['tone'], { frame: string; icon: typeof AlertTriangle; iconClass: string }> = {
  error: { frame: 'border-[#ffb8c2] bg-[#fff1f2] text-[#dc2626]', icon: AlertTriangle, iconClass: 'text-[#dc2626]' },
  success: { frame: 'border-[#bfead9] bg-[#ecfdf5] text-[#047857]', icon: CheckCircle2, iconClass: 'text-[#047857]' },
}

// Small, self-contained toast that floats over the page and auto-dismisses - used for
// validation feedback that needs to interrupt the user immediately (e.g. "you can't archive
// rows that haven't been sent yet"), as opposed to the inline banners used for action results.
export function Toast({ toast, onDismiss, durationMs = 4000 }: ToastProps) {
  useEffect(() => {
    if (!toast || durationMs <= 0) {
      return
    }
    const timer = window.setTimeout(onDismiss, durationMs)
    return () => window.clearTimeout(timer)
  }, [toast, durationMs, onDismiss])

  if (!toast) {
    return null
  }

  const { frame, icon: Icon, iconClass } = toneStyles[toast.tone]

  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4">
      <div
        role="alert"
        className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border px-5 py-4 text-sm font-bold shadow-[0_18px_40px_rgba(31,48,96,0.18)] ${frame}`}
      >
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} aria-hidden="true" />
        <span className="flex-1">{toast.text}</span>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md p-0.5 opacity-70 transition hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
