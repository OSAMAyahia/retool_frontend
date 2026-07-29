import { useMemo } from 'react'
import type { Transaction } from '../types/transaction'
import {
  dashboardColumnLabels,
  displayDate,
  transactionCrDr,
  transactionDate,
  transactionJournalId,
} from '../utils/tableFields'
import { groupTransactionsForDisplay, type TransactionGroup } from '../utils/groupTransactions'

interface TransactionTableProps {
  transactions: Transaction[]
  isLoading: boolean
  onSelect: (transaction: Transaction) => void
  onSelectGroup: (group: TransactionGroup) => void
}

const columns = dashboardColumnLabels

function formatAmountValue(amount: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
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

function groupJournalId(group: TransactionGroup) {
  const ids = new Set(group.transactions.map((transaction) => transactionJournalId(transaction) || ''))
  if (ids.size === 1) {
    return Array.from(ids)[0] || '-'
  }
  return 'Multiple'
}

function groupStatus(group: TransactionGroup): Transaction['internalStatus'] {
  return group.transactions.every((transaction) => transaction.internalStatus === 'completed')
    ? 'completed'
    : 'un-completed'
}

function groupLatestCreatedAt(group: TransactionGroup) {
  return group.transactions.reduce(
    (latest, transaction) => (transaction.createdAt > latest ? transaction.createdAt : latest),
    group.transactions[0]?.createdAt ?? '',
  )
}

export function TransactionTable({
  transactions,
  isLoading,
  onSelect,
  onSelectGroup,
}: TransactionTableProps) {
  const groups = useMemo(() => groupTransactionsForDisplay(transactions), [transactions])

  return (
    <div className="max-h-[680px] overflow-y-auto overflow-x-hidden bg-white">
      <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
        <colgroup>
          <col className="w-[13%]" />
          <col className="w-[20%]" />
          <col className="w-[20%]" />
          <col className="w-[12%]" />
          <col className="w-[10%]" />
          <col className="w-[8%]" />
          <col className="w-[9%]" />
          <col className="w-[8%]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-[#f8fbff] text-[#627194] shadow-[inset_0_-1px_0_#dfe6f4]">
          <tr>
            {columns.map((column, index) => (
              <th
                key={`${column}-${index}`}
                className={`h-11 whitespace-nowrap px-3 text-xs font-extrabold uppercase tracking-[0.03em] text-left`}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <LoadingRows />
          ) : groups.length === 0 ? (
            <tr>
              <td className="px-3 py-14 text-center text-sm font-semibold text-[#657295]" colSpan={columns.length}>
                No transactions match the current filters.
              </td>
            </tr>
          ) : (
            groups.map((group) => {
              if (group.transactions.length === 1) {
                const transaction = group.transactions[0]
                return (
                  <tr
                    key={transaction.transactionId}
                    className="group cursor-pointer border-b border-[#edf1f8] bg-white transition hover:bg-[#f8fbff]"
                    onClick={() => onSelect(transaction)}
                  >
                    <td className="h-[60px] px-3 align-middle">
                      <span className="block truncate font-semibold text-[#2d3b68]">
                        {displayDate(transactionDate(transaction)) || '-'}
                      </span>
                    </td>
                    <td className="px-3 align-middle">
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
                      <span className="block truncate font-mono text-[13px] font-bold text-[#2d3b68]">
                        {transactionJournalId(transaction) || '-'}
                      </span>
                    </td>
                    <td className="px-3 align-middle">
                      <span className="block truncate font-mono text-[13px] font-bold text-[#2d3b68]">
                        {transaction.accountId}
                      </span>
                    </td>
                    <td className="px-3 text-left align-middle">
                      <span className="block whitespace-nowrap font-extrabold tabular-nums text-[#16214c]">
                        {formatAmountValue(transaction.amount)}
                      </span>
                    </td>
                    <td className="px-3 align-middle">
                      <span className="inline-flex max-w-full truncate whitespace-nowrap rounded-lg bg-[#f1f5fb] px-2.5 py-1 text-xs font-extrabold uppercase text-[#33406f]">
                        {transactionCrDr(transaction)}
                      </span>
                    </td>
                    <td className="px-3 align-middle">
                      <span className="block truncate font-semibold text-[#2d3b68]">
                        {displayDate(transaction.valueDate) || '-'}
                      </span>
                    </td>
                    <td className="px-3 align-middle">
                      <span className="block truncate font-semibold text-[#2d3b68]">
                        {displayDate(transaction.createdAt) || '-'}
                      </span>
                    </td>
                  </tr>
                )
              }

              return (
                <tr
                  key={group.key}
                  className="group cursor-pointer border-b border-[#edf1f8] bg-[#f8fbff] transition hover:bg-[#eef3ff]"
                  onClick={() => onSelectGroup(group)}
                >
                  <td className="h-[60px] px-3 align-middle">
                    <span className="block truncate font-semibold text-[#2d3b68]">
                      {displayDate(group.valueDate) || '-'}
                    </span>
                  </td>
                  <td className="px-3 align-middle">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass(groupStatus(group))}`} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <span className="rounded-md bg-[#5748f5] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                            ×{group.transactions.length}
                          </span>
                          <span className="truncate font-mono text-[13px] font-extrabold text-[#15214b]">
                            Grouped rows
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] font-bold text-[#7a86a6]">
                          Click to view the {group.transactions.length} merged rows
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 align-middle">
                    <span className="block truncate font-mono text-[13px] font-bold text-[#2d3b68]">
                      {groupJournalId(group)}
                    </span>
                  </td>
                  <td className="px-3 align-middle">
                    <span className="block truncate font-mono text-[13px] font-bold text-[#2d3b68]">
                      {group.accountId}
                    </span>
                  </td>
                  <td className="px-3 text-left align-middle">
                    <span className="block whitespace-nowrap font-extrabold tabular-nums text-[#16214c]">
                      {formatAmountValue(group.totalAmount)}
                    </span>
                  </td>
                  <td className="px-3 align-middle">
                    <span className="inline-flex max-w-full truncate whitespace-nowrap rounded-lg bg-[#f1f5fb] px-2.5 py-1 text-xs font-extrabold uppercase text-[#33406f]">
                      {group.crDr}
                    </span>
                  </td>
                  <td className="px-3 align-middle">
                    <span className="block truncate font-semibold text-[#2d3b68]">
                      {displayDate(group.valueDate) || '-'}
                    </span>
                  </td>
                  <td className="px-3 align-middle">
                    <span className="block truncate font-semibold text-[#2d3b68]">
                      {displayDate(groupLatestCreatedAt(group)) || '-'}
                    </span>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}




