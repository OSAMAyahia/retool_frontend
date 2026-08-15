import { ArrowDown, ArrowUp, ExternalLink } from 'lucide-react'
import type { TransactionGroupSummary } from '../services/api'
import type { SortDirection } from '../types/transaction'
import { dashboardColumnLabels, displayDate } from '../utils/tableFields'

// Unlike value_date (a literal date-only value from the imported file), uploadedAt/processedAt
// are system timestamps with no original literal to preserve, so this intentionally shows the
// viewer's own local time (what their wall clock says "now" was), including time-of-day.
function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  const hours24 = date.getHours()
  const period = hours24 >= 12 ? 'PM' : 'AM'
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()} ${hours12}:${pad(date.getMinutes())} ${period}`
}

interface TransactionTableProps {
  groups: TransactionGroupSummary[]
  isLoading: boolean
  onSelectGroup: (group: TransactionGroupSummary) => void
  // When the Dashboard's "Not mapped"/"Not balanced" sub-filter is active, every visible row
  // already matches that reason (it's the query's WHERE clause) - shown as a small tag next to
  // each row so it's clear why these rows never became a Journal Table entry.
  activeReason?: string
  sortBy?: string
  sortDir?: SortDirection
  onSort?: (field: string) => void
}

// Whitelisted on the backend for GET /transactions/grouped (see
// TransactionService.findTransactionGroups) - anything else falls back to the valueDate default.
const SORTABLE_FIELDS: Partial<Record<(typeof dashboardColumnLabels)[number], string>> = {
  'transaction date': 'valueDate',
  txn_id: 'txnId',
}

function reasonTagLabel(reason?: string) {
  if (reason === 'NOT_MAPPED') {
    return 'Not mapped'
  }
  if (reason === 'NOT_BALANCED') {
    return 'Not balanced'
  }
  if (reason === 'DIFFERENCE_ACCOUNT_MISSING') {
    return 'Difference account missing'
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

export function TransactionTable({
  groups,
  isLoading,
  onSelectGroup,
  activeReason,
  sortBy,
  sortDir,
  onSort,
}: TransactionTableProps) {
  const reasonLabel = reasonTagLabel(activeReason)
  return (
    <div className="max-h-[680px] overflow-y-auto overflow-x-hidden bg-white">
      <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
        <colgroup>
          <col className="w-[11%]" />
          <col className="w-[18%]" />
          <col className="w-[12%]" />
          <col className="w-[10%]" />
          <col className="w-[7%]" />
          <col className="w-[17%]" />
          <col className="w-[14%]" />
          <col className="w-[11%]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-[#f8fbff] text-[#627194] shadow-[inset_0_-1px_0_#dfe6f4]">
          <tr>
            {columns.map((column, index) => {
              const sortField = SORTABLE_FIELDS[column]
              const isActive = sortField != null && sortBy === sortField
              return (
                <th
                  key={`${column}-${index}`}
                  className={`min-h-11 px-3 py-3 text-left text-xs font-extrabold uppercase leading-tight tracking-[0.03em] ${
                    sortField && onSort ? 'cursor-pointer select-none hover:text-[#33406f]' : ''
                  }`}
                  onClick={sortField && onSort ? () => onSort(sortField) : undefined}
                >
                  <span className="inline-flex max-w-full flex-wrap items-center gap-x-1 gap-y-0.5 break-words">
                    {column}
                    {sortField ? (
                      isActive && sortDir === 'desc' ? (
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : isActive ? (
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : null
                    ) : null}
                  </span>
                </th>
              )
            })}
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
              const key = `${group.txnId}|${group.journal ?? ''}`
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
                            {group.txnId}
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
                      {group.journal ?? '-'}
                    </span>
                  </td>
                  <td className="px-3 text-left align-middle">
                    <span className="block whitespace-nowrap font-extrabold tabular-nums text-[#16214c]">
                      {formatAmountValue(group.totalAmount)}
                    </span>
                  </td>
                  <td className="px-3 align-middle">
                    <span className="inline-flex max-w-full truncate whitespace-nowrap rounded-lg bg-[#f1f5fb] px-2.5 py-1 text-xs font-extrabold uppercase text-[#33406f]">
                      {group.recordCount}
                    </span>
                  </td>
                  <td className="px-3 align-middle">
                    <span className="block truncate text-xs font-semibold text-[#2d3b68]">
                      {formatDateTime(group.uploadedAt)}
                    </span>
                  </td>
                  <td className="px-3 align-middle">
                    <span className="block truncate text-xs font-semibold text-[#2d3b68]">
                      {formatDateTime(group.processedAt)}
                    </span>
                  </td>
                  <td className="px-3 align-middle">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate font-mono text-xs font-semibold text-[#2d3b68]">
                        {group.odooReferenceId ?? '-'}
                      </span>
                      {group.odooEntryUrl ? (
                        <button
                          type="button"
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#5748f5] transition hover:bg-[#f1f5fb]"
                          title="Open this entry in Odoo"
                          onClick={(event) => {
                            event.stopPropagation()
                            window.open(group.odooEntryUrl ?? '', '_blank')
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      ) : null}
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
