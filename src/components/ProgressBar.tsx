interface ProgressBarProps {
  label: string
  subLabel?: string
  // Provide `percent` for a determinate bar (0-100). Omit it (or pass null) for an
  // indeterminate bar - used when the backend can't report a live numerator/denominator (e.g.
  // the send-to-Odoo background job only reports a final count, not a running total).
  percent?: number | null
  tone?: 'default' | 'success' | 'error'
}

const toneGradient: Record<NonNullable<ProgressBarProps['tone']>, string> = {
  default: 'from-[#7254ff] to-[#5237e9]',
  success: 'from-[#10b981] to-[#059669]',
  error: 'from-[#f87171] to-[#dc2626]',
}

export function ProgressBar({ label, subLabel, percent, tone = 'default' }: ProgressBarProps) {
  const isDeterminate = typeof percent === 'number' && Number.isFinite(percent)
  const clamped = isDeterminate ? Math.min(Math.max(percent as number, 0), 100) : 0

  return (
    <div className="rounded-2xl border border-[#dfe6f4] bg-white/90 px-5 py-4 shadow-[0_12px_30px_rgba(31,48,96,0.06)]">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-bold text-[#172452]">{label}</span>
        {isDeterminate ? (
          <span className="whitespace-nowrap text-sm font-extrabold tabular-nums text-[#5748f5]">
            {Math.round(clamped)}%
          </span>
        ) : (
          <span className="whitespace-nowrap text-xs font-bold uppercase tracking-wide text-[#8a94b8]">
            In progress…
          </span>
        )}
      </div>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[#eef1fa]">
        {isDeterminate ? (
          <div
            className={`h-full rounded-full bg-gradient-to-r ${toneGradient[tone]} transition-[width] duration-500 ease-out`}
            style={{ width: `${clamped}%` }}
          />
        ) : (
          <div
            className={`h-full w-1/3 animate-[progress-indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r ${toneGradient[tone]}`}
          />
        )}
      </div>

      {subLabel ? <p className="mt-2 text-xs font-semibold text-[#7a86a6]">{subLabel}</p> : null}
    </div>
  )
}
