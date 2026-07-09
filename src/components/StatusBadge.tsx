import type { InternalStatus } from '../types/transaction'

const statusStyles: Record<string, string> = {
  'un-completed': 'border-[#ffd39a] bg-[#fff0dc] text-[#ff8900]',
  completed: 'border-[#b8ead6] bg-[#dff8ec] text-[#009e63]',
  NEW: 'border-[#bae6fd] bg-[#e0f2fe] text-[#0284c7]',
  PENDING: 'border-[#ffd39a] bg-[#fff0dc] text-[#ff8900]',
  PROCESSING: 'border-[#bdd4ff] bg-[#eaf2ff] text-[#1f66ff]',
  SENT: 'border-[#b8ead6] bg-[#dff8ec] text-[#009e63]',
  REJECTED: 'border-[#ffb8c2] bg-[#ffe3e8] text-[#ff2644]',
}

function statusLabel(status: InternalStatus) {
  if (status === 'REJECTED') {
    return 'rejected'
  }

  return status
}

export function StatusBadge({ status }: { status: InternalStatus }) {
  return (
    <span
      className={`inline-flex h-7 min-w-[92px] items-center justify-center whitespace-nowrap rounded-full border px-3 text-xs font-extrabold ${statusStyles[status] ?? 'border-slate-200 bg-slate-50 text-slate-600'}`}
    >
      {statusLabel(status)}
    </span>
  )
}

