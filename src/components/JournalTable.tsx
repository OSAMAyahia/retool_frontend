import { BookOpen, CalendarDays, Hash } from 'lucide-react'
import type { Journal } from '../types/transaction'
import { StatusBadge } from './StatusBadge'

interface JournalTableProps {
  journals: Journal[]
  isLoading: boolean
  onSelect: (journal: Journal) => void
}

const columns = ['Date', 'Journal', 'Reference', 'Account', 'Debit', 'Credit', 'Status']

function formatDateParts(value: string | null) {
  if (!value) {
    return { date: '-', time: '' }
  }

  const date = new Date(value)
  return {
    date: new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(date),
    time: new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(date),
  }
}

function DateCell({ value }: { value: string | null }) {
  const parts = formatDateParts(value)

  return (
    <span className="inline-flex min-w-[112px] flex-col leading-tight">
      <span className="whitespace-nowrap font-bold text-[#24315f]">{parts.date}</span>
      {parts.time ? <span className="mt-1 whitespace-nowrap text-xs font-semibold text-[#7a86a6]">{parts.time}</span> : null}
    </span>
  )
}

function formatMoney(value: number | null) {
  if (value == null) {
    return '-'
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function MoneyCell({ value, tone }: { value: number | null; tone: 'debit' | 'credit' }) {
  const color = tone === 'debit' ? 'text-[#b45309]' : 'text-[#047857]'

  return (
    <span className={`block whitespace-nowrap text-left font-extrabold tabular-nums ${value == null ? 'text-[#9aa4bd]' : color}`}>
      {formatMoney(value)}
    </span>
  )
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-[#edf1f8]">
          {columns.map((column) => (
            <td key={column} className="h-[64px] px-5">
              <div className="h-4 w-full max-w-28 animate-pulse rounded bg-[#eef3fb]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function JournalTable({ journals, isLoading, onSelect }: JournalTableProps) {
  return (
    <div className="max-h-[720px] overflow-y-auto bg-white">
      <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
        <colgroup>
          <col className="w-[14%]" />
          <col className="w-[16%]" />
          <col className="w-[18%]" />
          <col className="w-[22%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-[#f8fbff] text-[#627194] shadow-[inset_0_-1px_0_#dfe6f4]">
          <tr>
            {columns.map((column) => (
              <th key={column} className="h-12 whitespace-nowrap px-5 text-xs font-extrabold uppercase tracking-[0.04em]">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <LoadingRows />
          ) : journals.length === 0 ? (
            <tr>
              <td className="px-5 py-14 text-center text-sm font-semibold text-[#657295]" colSpan={columns.length}>
                No journal rows found.
              </td>
            </tr>
          ) : (
            journals.map((journal, index) => (
              <tr
                key={`${journal.transactionId}-${index}`}
                className="cursor-pointer border-b border-[#edf1f8] bg-white transition hover:bg-[#f8fbff]"
                onClick={() => onSelect(journal)}
              >
                <td className="h-[64px] px-5 align-middle">
                  <span className="inline-flex items-start gap-2">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#7380a7]" aria-hidden="true" />
                    <DateCell value={journal.journalDate} />
                  </span>
                </td>
                <td className="px-5 align-middle">
                  <span className="inline-flex max-w-full items-center gap-2 rounded-lg bg-[#eef6ff] px-2.5 py-1 font-extrabold text-[#1f66ff]">
                    <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{journal.journal ?? '-'}</span>
                  </span>
                </td>
                <td className="px-5 align-middle">
                  <span className="flex min-w-0 items-center gap-2 font-mono text-[13px] font-bold text-[#2d3b68]">
                    <Hash className="h-4 w-4 shrink-0 text-[#7380a7]" aria-hidden="true" />
                    <span className="truncate">{journal.reference ?? '-'}</span>
                  </span>
                </td>
                <td className="px-5 align-middle">
                  <span className="block truncate font-bold text-[#2d3b68]" title={journal.itemAccount ?? undefined}>
                    {journal.itemAccount ?? '-'}
                  </span>
                  <span className="mt-1 block truncate text-xs font-bold text-[#7a86a6]">Click row for details</span>
                </td>
                <td className="px-5 align-middle"><MoneyCell value={journal.debit} tone="debit" /></td>
                <td className="px-5 align-middle"><MoneyCell value={journal.credit} tone="credit" /></td>
                <td className="px-5 align-middle"><StatusBadge status={journal.status} /></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

