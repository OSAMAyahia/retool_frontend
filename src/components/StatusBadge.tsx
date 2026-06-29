import type { InternalStatus } from '../types/transaction'

const statusStyles: Record<InternalStatus, string> = {
  PENDING: 'border-[#ffd39a] bg-[#fff0dc] text-[#ff8900]',
  PROCESSING: 'border-[#bdd4ff] bg-[#eaf2ff] text-[#1f66ff]',
  SENT: 'border-[#b8ead6] bg-[#dff8ec] text-[#009e63]',
  FAILED: 'border-[#ffb8c2] bg-[#ffe3e8] text-[#ff2644]',
}

export function StatusBadge({ status }: { status: InternalStatus }) {
  return (
    <span
      className={`inline-flex h-7 min-w-[74px] items-center justify-center rounded-full border px-3 text-xs font-extrabold ${statusStyles[status]}`}
    >
      {status}
    </span>
  )
}
