import type { Journal } from '../types/transaction'
import { displayDate, journalColumnLabels } from '../utils/tableFields'
import { StatusBadge } from './StatusBadge'

interface JournalTableProps {
  journals: Journal[]
  isLoading: boolean
  onSelect: (journal: Journal) => void
  selectedIds: Set<string>
  onToggleRow: (transactionId: string) => void
  onToggleAll: () => void
}

const columns = journalColumnLabels

function formatMoney(value: number | null) {
  if (value == null) {
    return '-'
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-[#edf1f8]">
          <td className="h-[64px] px-5">
            <div className="h-4 w-4 animate-pulse rounded bg-[#eef3fb]" />
          </td>
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

export function JournalTable({ journals, isLoading, onSelect, selectedIds, onToggleRow, onToggleAll }: JournalTableProps) {
  const allSelected = journals.length > 0 && journals.every((journal) => selectedIds.has(journal.transactionId))

  return (
    <div className="max-h-[720px] overflow-y-auto bg-white">
      <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
        <colgroup>
          <col className="w-[4%]" />
          <col className="w-[12%]" />
          <col className="w-[19%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[11%]" />
          <col className="w-[8%]" />
          <col className="w-[11%]" />
          <col className="w-[11%]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-[#f8fbff] text-[#627194] shadow-[inset_0_-1px_0_#dfe6f4]">
          <tr>
            <th className="h-12 whitespace-nowrap px-5 text-xs font-extrabold uppercase tracking-[0.04em]">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                aria-label="Select all visible journal entries"
                disabled={journals.length === 0}
              />
            </th>
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
              <td className="px-5 py-14 text-center text-sm font-semibold text-[#657295]" colSpan={columns.length + 1}>
                No balanced journal entries found.
              </td>
            </tr>
          ) : (
            journals.map((journal) => (
              <tr
                key={journal.transactionId}
                className="cursor-pointer border-b border-[#edf1f8] bg-white transition hover:bg-[#f8fbff]"
                onClick={() => onSelect(journal)}
              >
                <td className="h-[64px] px-5 align-middle" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(journal.transactionId)}
                    onChange={() => onToggleRow(journal.transactionId)}
                    aria-label={`Select journal entry ${journal.transactionId}`}
                  />
                </td>
                <td className="h-[64px] px-5 align-middle">
                  <span className="block truncate font-semibold text-[#2d3b68]">
                    {displayDate(journal.journalDate) || '-'}
                  </span>
                </td>
                <td className="px-5 align-middle">
                  <span className="block truncate font-mono text-[13px] font-extrabold text-[#15214b]">
                    {journal.transactionId}
                  </span>
                  <span className="mt-1 block truncate text-xs font-bold text-[#7a86a6]">
                    Click to view all journal lines
                  </span>
                </td>
                <td className="px-5 align-middle">
                  <span className="block truncate font-mono text-[13px] font-bold text-[#2d3b68]">
                    {journal.journal ?? '-'}
                  </span>
                </td>
                <td className="px-5 align-middle">
                  <span className="block whitespace-nowrap font-extrabold tabular-nums text-[#16214c]">
                    {formatMoney(journal.totalDebit)}
                  </span>
                </td>
                <td className="px-5 align-middle">
                  <span className="block whitespace-nowrap font-extrabold tabular-nums text-[#16214c]">
                    {formatMoney(journal.totalCredit)}
                  </span>
                </td>
                <td className="px-5 align-middle">
                  <span className="inline-flex min-w-10 justify-center rounded-lg bg-[#f1f5fb] px-2.5 py-1 text-xs font-extrabold text-[#33406f]">
                    {journal.lineCount}
                  </span>
                </td>
                <td className="px-5 align-middle">
                  <span className="block truncate font-semibold text-[#2d3b68]">
                    {displayDate(journal.createdAt) || '-'}
                  </span>
                </td>
                <td className="px-5 align-middle">
                  <StatusBadge status={journal.status} />
                  {journal.status === 'REJECTED' && journal.errorMessage ? (
                    <span
                      className="mt-1 block max-w-[220px] truncate text-[11px] font-bold text-[#dc2626]"
                      title={journal.errorMessage}
                    >
                      {journal.rejectionReason === 'NOT_MAPPED'
                        ? 'Not mapped'
                        : journal.rejectionReason === 'NOT_BALANCED'
                          ? 'Not balanced'
                          : journal.errorMessage}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
