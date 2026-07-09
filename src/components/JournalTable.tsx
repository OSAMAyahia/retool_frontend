import type { Journal } from '../types/transaction'
import { StatusBadge } from './StatusBadge'

interface JournalTableProps {
  journals: Journal[]
  isLoading: boolean
}

const columns = [
  'Date',
  'Journal',
  'Reference',
  'Journal Items/label',
  'Journal Items/Account',
  'Debit',
  'Credit',
  'Analytic',
  'Status',
  'Created At',
  'Updated At',
]

function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
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

export function JournalTable({ journals, isLoading }: JournalTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1680px] table-fixed text-left text-sm">
        <thead className="bg-[#f8fbff]/90 text-[#627194]">
          <tr>
            {columns.map((column) => (
              <th key={column} className="h-14 px-7 font-bold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#dfe6f4]">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column) => (
                  <td key={column} className="h-[58px] px-7">
                    <div className="h-4 w-full max-w-28 animate-pulse rounded bg-[#eef3fb]" />
                  </td>
                ))}
              </tr>
            ))
          ) : journals.length === 0 ? (
            <tr>
              <td className="px-7 py-12 text-center text-sm font-medium text-[#657295]" colSpan={columns.length}>
                No journal rows found.
              </td>
            </tr>
          ) : (
            journals.map((journal) => (
              <tr key={journal.transactionId} className="bg-white/70 transition hover:bg-[#f8fbff]">
                <td className="px-7 font-medium text-[#2d3b68]">{formatDate(journal.journalDate)}</td>
                <td className="truncate px-7 font-medium text-[#2d3b68]">{journal.journal ?? '-'}</td>
                <td className="truncate px-7 font-medium text-[#2d3b68]">{journal.reference ?? '-'}</td>
                <td className="truncate px-7 font-medium text-[#2d3b68]">{journal.itemLabel ?? '-'}</td>
                <td className="truncate px-7 font-medium text-[#2d3b68]">{journal.itemAccount ?? '-'}</td>
                <td className="px-7 font-medium text-[#2d3b68]">{formatMoney(journal.debit)}</td>
                <td className="px-7 font-medium text-[#2d3b68]">{formatMoney(journal.credit)}</td>
                <td className="truncate px-7 font-medium text-[#2d3b68]">{journal.analytic ?? '-'}</td>
                <td className="px-7"><StatusBadge status={journal.status} /></td>
                <td className="px-7 font-medium text-[#2d3b68]">{formatDate(journal.createdAt)}</td>
                <td className="px-7 font-medium text-[#2d3b68]">{formatDate(journal.updatedAt)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
