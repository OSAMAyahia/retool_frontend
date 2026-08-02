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

type SummaryCardKey = (typeof cards)[number]['key']

export interface SummaryCardSubFilter {
  key: string
  label: string
  active: boolean
  onClick: () => void
}

interface SummaryCardsProps {
  summary: TransactionSummary
  // Clicking a card applies that card's implied filter to the table below. Omit to keep cards
  // non-interactive (e.g. if a page hasn't wired up filtering).
  onCardClick?: (key: SummaryCardKey) => void
  activeCard?: SummaryCardKey | null
  // Small filter chips nested under one specific card (used for "Not completed" -> Not mapped /
  // Not balanced on the Journal Table).
  subFilters?: Partial<Record<SummaryCardKey, SummaryCardSubFilter[]>>
}

export function SummaryCards({ summary, onCardClick, activeCard, subFilters }: SummaryCardsProps) {
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
        const isClickable = Boolean(onCardClick)
        const isActive = activeCard === card.key
        const cardSubFilters = subFilters?.[card.key]

        return (
          <article
            key={card.key}
            className={`min-h-[184px] rounded-2xl border bg-gradient-to-br from-white to-white/75 p-5 ${card.frame} ${
              isActive ? 'ring-2 ring-offset-2 ring-[#6847f5]' : ''
            }`}
          >
            <button
              type="button"
              className={`flex w-full items-center gap-4 text-left ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={() => onCardClick?.(card.key)}
              disabled={!isClickable}
            >
              <span className={`grid h-14 w-14 place-items-center rounded-2xl ${card.iconClass}`}>
                <Icon className="h-7 w-7" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-[#566283]">{card.label}</h2>
                <strong className="mt-2 block text-3xl font-extrabold leading-none text-[#111b45]">
                  {value}
                </strong>
              </div>
            </button>
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
            {cardSubFilters && cardSubFilters.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-black/5 pt-3">
                {cardSubFilters.map((sub) => (
                  <button
                    key={sub.key}
                    type="button"
                    onClick={sub.onClick}
                    className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                      sub.active
                        ? 'border-[#6847f5] bg-[#6847f5] text-white'
                        : 'border-[#dfe6f4] bg-white text-[#566283] hover:border-[#6847f5]'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            ) : null}
          </article>
        )
      })}
    </section>
  )
}
