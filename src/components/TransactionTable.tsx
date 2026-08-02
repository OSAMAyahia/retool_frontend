import type { TransactionGroupSummary } from '../services/api'
import { dashboardColumnLabels, displayDate } from '../utils/tableFields'

interface TransactionTableProps {
  groups: TransactionGroupSummary[]
  isLoading: boolean
  onSelectGroup: (group: TransactionGroupSummary) => void
  // When the Dashboard's "Not mapped"/"Not balanced" sub-filter is active, every visible row
  // already matches that reason (it's the query's WHERE clause) - shown as a small tag next to
  // each row so it's clear why these rows never became a Journal Table entry.
  activeReason?: string
}

function reasonTagLabel(reason?: string) {
  if (reason === 'NOT_MAPPED') {
    return 'Not mapped'
  }
  if (reason === 'NOT_BALANCED') {
    return 'Not balanced'
  }
  return null
}

const columns = dashboardColumnLabels

function formatAmountValue(amount: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function dotClass(recordCount: number) {
  // No per-row internal_status is available once rows are grouped/summed server-side, so this
  // is purely a visual cue for "merged" vs. "single" rows rather than completion status.
  return recordCount > 1
    ? 'bg-[#5748f5] shadow-[0_0_0_4px_rgba(87,72,245,0.14)]'
    : 'bg-[#94a3c4] shadow-[0_0_0_4px_rgba(148,163,196,0.14)]'
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

export function TransactionTable({ groups, isLoading, onSelectGroup, activeReason }: TransactionTableProps) {
  const reasonLabel = reasonTagLabel(activeReason)
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
              const key = `${group.valueDate ?? ''}|${group.accountId}|${group.type}`
              return (
                <tr
                  key={key}
                  className={`group cursor-pointer border-b border-[#edf1f8] transition hover:bg-[#f8fbff] ${
                    group.recordCount > 1 ? 'bg-[#f8fbff]' : 'bg-white'
                  }`}
                  onClick={() => onSelectGroup(group)}
                >
                  <td className="h-[60px] px-3 align-middle">
                    <span className="block truncate font-semibold text-[#2d3b68]">
                      {displayDate(group.valueDate) || '-'}
                    </span>
                  </td>
                  <td className="px-3 align-middle">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass(group.recordCount)}`} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          {group.recordCount > 1 ? (
                            <span className="rounded-md bg-[#5748f5] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                              ×{group.recordCount}
                            </span>
                          ) : null}
                          <span className="truncate font-mono text-[13px] font-extrabold text-[#15214b]">
                            {group.recordCount > 1 ? 'Grouped rows' : '1 row'}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] font-bold text-[#7a86a6]">
                          Click row for details
                          {reasonLabel ? (
                            <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-amber-800">
                              {reasonLabel}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 align-middle">
                    <span className="block truncate font-mono text-[13px] font-bold text-[#2d3b68]">
                      {group.recordCount > 1 ? 'Multiple' : '-'}
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
                      {group.type}
                    </span>
                  </td>
                  <td className="px-3 align-middle">
                    <span className="block truncate font-semibold text-[#2d3b68]">
                      {displayDate(group.valueDate) || '-'}
                    </span>
                  </td>
                  <td className="px-3 align-middle">
                    <span className="block truncate font-semibold text-[#2d3b68]">-</span>
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
