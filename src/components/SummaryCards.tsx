import { CheckCircle2, Clock3, ListChecks, WalletCards } from 'lucide-react'
import type { TransactionSummary } from '../types/transaction'

const cards = [
  {
    key: 'total',
    label: 'Total Transactions',
    caption: 'All time',
    icon: WalletCards,
    frame: 'border-[#e5d9ff] shadow-[0_12px_30px_rgba(104,71,245,0.09)]',
    iconClass: 'bg-[#eee6ff] text-[#6847f5]',
    accent: 'text-[#6847f5]',
  },
  {
    key: 'unCompleted',
    label: 'Not completed',
    caption: 'of total',
    icon: Clock3,
    frame: 'border-[#ffdcb8] shadow-[0_12px_30px_rgba(255,138,0,0.08)]',
    iconClass: 'bg-[#ffedda] text-[#ff8a00]',
    accent: 'text-[#ff8a00]',
  },
  {
    key: 'completed',
    label: 'Completed',
    caption: 'of total',
    icon: CheckCircle2,
    frame: 'border-[#bfead9] shadow-[0_12px_30px_rgba(8,184,111,0.08)]',
    iconClass: 'bg-[#d9f6e8] text-[#08b86f]',
    accent: 'text-[#08b86f]',
  },
  {
    key: 'journalRows',
    label: 'Journal Rows',
    caption: 'processed',
    icon: ListChecks,
    frame: 'border-[#bdd4ff] shadow-[0_12px_30px_rgba(31,102,255,0.08)]',
    iconClass: 'bg-[#eaf2ff] text-[#1f66ff]',
    accent: 'text-[#1f66ff]',
  },
] as const

function percent(value: number, total: number) {
  if (!total) {
    return '0%'
  }

  return `${Math.round((value / total) * 100)}%`
}

export function SummaryCards({ summary }: { summary: TransactionSummary }) {
  return (
    <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        const value = summary[card.key]
        const caption =
          card.key === 'total'
            ? card.caption
            : card.key === 'journalRows'
              ? card.caption
              : `${percent(value, summary.total)} ${card.caption}`

        return (
          <article
            key={card.key}
            className={`min-h-[184px] rounded-2xl border bg-gradient-to-br from-white to-white/75 p-5 ${card.frame}`}
          >
            <div className="flex items-center gap-4">
              <span className={`grid h-14 w-14 place-items-center rounded-2xl ${card.iconClass}`}>
                <Icon className="h-7 w-7" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-[#566283]">{card.label}</h2>
                <strong className="mt-2 block text-3xl font-extrabold leading-none text-[#111b45]">
                  {value}
                </strong>
              </div>
            </div>
            <div className="mt-8 flex items-end justify-between gap-4">
              <span className="font-semibold text-[#566283]">{caption}</span>
              <svg className={`h-10 w-[44%] min-w-[110px] fill-none ${card.accent}`} viewBox="0 0 130 36">
                <path
                  d="M2 29 C14 28 21 21 34 20 C47 19 51 29 64 26 C76 23 81 31 93 24 C104 15 111 17 128 8"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                />
              </svg>
            </div>
          </article>
        )
      })}
    </section>
  )
}
