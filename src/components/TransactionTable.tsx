import { CalendarDays, Database, MoreVertical, RotateCw } from 'lucide-react'
import type { Transaction } from '../types/transaction'
import { StatusBadge } from './StatusBadge'

interface TransactionTableProps {
  transactions: Transaction[]
  isLoading: boolean
  isRetrying: boolean
  onSelect: (transaction: Transaction) => void
  onRetry: (transaction: Transaction) => void
  onSourceSelect: (source: string) => void
}

const columns = [
  'Transaction ID',
  'Account ID',
  'Amount',
  'Type',
  'Source',
  'Internal Status',
  'Source Status',
  'Value Date',
  'Retry Count',
  '',
]

function formatAmount(transaction: Transaction) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(transaction.amount)
}

function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function dotClass(status: Transaction['internalStatus']) {
  if (status === 'NEW') {
    return 'bg-[#0ea5e9]'
  }

  if (status === 'SENT') {
    return 'bg-[#08b86f]'
  }

  if (status === 'REJECTED') {
    return 'bg-[#ff2644]'
  }

  return 'bg-[#6847f5]'
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {columns.map((column, columnIndex) => (
            <td key={`${column}-${columnIndex}`} className="h-[58px] px-7">
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
  isRetrying,
  onSelect,
  onRetry,
  onSourceSelect,
}: TransactionTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1280px] table-fixed text-left text-sm">
        <thead className="bg-[#f8fbff]/90 text-[#627194]">
          <tr>
            {columns.map((column, index) => (
              <th key={`${column}-${index}`} className="h-14 px-7 font-bold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#dfe6f4]">
          {isLoading ? (
            <LoadingRows />
          ) : transactions.length === 0 ? (
            <tr>
              <td className="px-7 py-12 text-center text-sm font-medium text-[#657295]" colSpan={columns.length}>
                No transactions match the current filters.
              </td>
            </tr>
          ) : (
            transactions.map((transaction) => (
              <tr
                key={transaction.transactionId}
                className="cursor-pointer bg-white/70 transition hover:bg-[#f8fbff]"
                onClick={() => onSelect(transaction)}
              >
                <td className="h-[58px] truncate px-7 font-extrabold text-[#15214b]">
                  <span className="inline-flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${dotClass(transaction.internalStatus)}`} />
                    {transaction.transactionId}
                  </span>
                </td>
                <td className="truncate px-7 font-medium text-[#2d3b68]">{transaction.accountId}</td>
                <td className="px-7 font-medium text-[#2d3b68]">
                  {formatAmount(transaction)} {transaction.currency}
                </td>
                <td className="px-7 font-medium capitalize text-[#2d3b68]">{transaction.type}</td>
                <td className="px-7 font-medium text-[#2d3b68]">
                  <button
                    className="inline-flex max-w-full items-center gap-2 truncate rounded-lg px-2 py-1 text-left transition hover:bg-[#eef4ff] hover:text-[#2563eb]"
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
                <td className="px-7">
                  <StatusBadge status={transaction.internalStatus} />
                </td>
                <td className="truncate px-7 font-medium text-[#2d3b68]">
                  {transaction.sourceStatus ?? '-'}
                </td>
                <td className="px-7 font-medium text-[#2d3b68]">
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-[#7380a7]" aria-hidden="true" />
                    {formatDate(transaction.valueDate)}
                  </span>
                </td>
                <td className="px-7 font-medium text-[#2d3b68]">{transaction.retryCount}</td>
                <td className="px-7">
                  <div className="flex items-center gap-2">
                    {transaction.internalStatus === 'REJECTED' ? (
                      <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                        type="button"
                        aria-label={`Retry ${transaction.transactionId}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          onRetry(transaction)
                        }}
                        disabled={isRetrying}
                      >
                        <RotateCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} aria-hidden="true" />
                      </button>
                    ) : null}
                    <button
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#dfe6f4] bg-white text-[#5748f5] transition hover:bg-[#f7f8ff]"
                      type="button"
                      aria-label={`Open ${transaction.transactionId}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        onSelect(transaction)
                      }}
                    >
                      <MoreVertical className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
