import { CalendarDays, Database } from 'lucide-react'
import type { Transaction } from '../types/transaction'
import { StatusBadge } from './StatusBadge'

interface TransactionTableProps {
  transactions: Transaction[]
  isLoading: boolean
  onSelect: (transaction: Transaction) => void
  onSourceSelect: (source: string) => void
}

const columns = ['Transaction', 'Account', 'Amount', 'Type', 'Source', 'Status', 'Value Date']

function formatAmount(transaction: Transaction) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(transaction.amount)
}

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
    <span className="inline-flex min-w-0 flex-col leading-tight">
      <span className="whitespace-nowrap font-bold text-[#24315f]">{parts.date}</span>
      {parts.time ? <span className="mt-1 whitespace-nowrap text-xs font-semibold text-[#7a86a6]">{parts.time}</span> : null}
    </span>
  )
}

function dotClass(status: Transaction['internalStatus']) {
  if (status === 'completed') {
    return 'bg-[#08b86f] shadow-[0_0_0_4px_rgba(8,184,111,0.12)]'
  }

  return 'bg-[#ff8a00] shadow-[0_0_0_4px_rgba(255,138,0,0.14)]'
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-[#edf1f8]">
          {columns.map((column, columnIndex) => (
            <td key={`${column}-${columnIndex}`} className="h-[60px] px-3">
              <div className="h-4 w-full max-w-28 animate-pulse rounded bg-[#eef3fb]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function TransactionTable({
  transactions,
  isLoading,
  onSelect,
  onSourceSelect,
}: TransactionTableProps) {
  return (
    <div className="max-h-[680px] overflow-y-auto overflow-x-hidden bg-white">
      <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
        <colgroup>
          <col className="w-[21%]" />
          <col className="w-[13%]" />
          <col className="w-[14%]" />
          <col className="w-[10%]" />
          <col className="w-[14%]" />
          <col className="w-[13%]" />
          <col className="w-[15%]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-[#f8fbff] text-[#627194] shadow-[inset_0_-1px_0_#dfe6f4]">
          <tr>
            {columns.map((column, index) => (
              <th key={`${column}-${index}`} className="h-11 whitespace-nowrap px-3 text-xs font-extrabold uppercase tracking-[0.03em]">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <LoadingRows />
          ) : transactions.length === 0 ? (
            <tr>
              <td className="px-3 py-14 text-center text-sm font-semibold text-[#657295]" colSpan={columns.length}>
                No transactions match the current filters.
              </td>
            </tr>
          ) : (
            transactions.map((transaction) => (
              <tr
                key={transaction.transactionId}
                className="group cursor-pointer border-b border-[#edf1f8] bg-white transition hover:bg-[#f8fbff]"
                onClick={() => onSelect(transaction)}
              >
                <td className="h-[60px] px-3 align-middle">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass(transaction.internalStatus)}`} />
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-[13px] font-extrabold text-[#15214b]">
                        {transaction.transactionId}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] font-bold text-[#7a86a6]">
                        Click row for details
                      </span>
                    </span>
                  </span>
                </td>
                <td className="px-3 align-middle">
                  <span className="block truncate font-mono text-[13px] font-bold text-[#2d3b68]">{transaction.accountId}</span>
                </td>
                <td className="px-3 text-right align-middle">
                  <span className="block whitespace-nowrap font-extrabold tabular-nums text-[#16214c]">
                    {formatAmount(transaction)} <span className="text-xs font-bold text-[#7a86a6]">{transaction.currency}</span>
                  </span>
                </td>
                <td className="px-3 align-middle">
                  <span className="inline-flex max-w-full truncate whitespace-nowrap rounded-lg bg-[#f1f5fb] px-2.5 py-1 text-xs font-extrabold capitalize text-[#33406f]">
                    {transaction.type}
                  </span>
                </td>
                <td className="px-3 align-middle">
                  <button
                    className="inline-flex max-w-full items-center gap-2 truncate whitespace-nowrap rounded-lg px-2 py-1 text-left font-bold text-[#2d3b68] transition hover:bg-[#eef4ff] hover:text-[#2563eb]"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onSourceSelect(transaction.source)
                    }}
                  >
                    <Database className="h-4 w-4 shrink-0 text-[#7380a7]" aria-hidden="true" />
                    <span className="truncate">{transaction.source}</span>
                  </button>
                </td>
                <td className="px-3 align-middle">
                  <StatusBadge status={transaction.internalStatus} />
                </td>
                <td className="px-3 align-middle">
                  <span className="inline-flex min-w-0 items-start gap-1.5">
                    <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7380a7]" aria-hidden="true" />
                    <DateCell value={transaction.valueDate} />
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

