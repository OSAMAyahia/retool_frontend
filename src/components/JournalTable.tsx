import { ArrowDown, ArrowUp, ExternalLink, Trash2 } from 'lucide-react'
import type { Journal, SortDirection } from '../types/transaction'
import { displayDate, journalColumnLabels, sanitizeOdooReference } from '../utils/tableFields'
import { StatusBadge } from './StatusBadge'

interface JournalTableProps {
  journals: Journal[]
  isLoading: boolean
  onSelect: (journal: Journal) => void
  selectedIds: Set<string>
  onToggleRow: (transactionId: string) => void
  onToggleAll: () => void
  sortBy?: string
  sortDir?: SortDirection
  // Optional - pages that reuse this table without a sortable/deletable context (e.g. the
  // read-only Archive view) can omit these and the corresponding affordances are hidden.
  onSort?: (field: string) => void
  onDeleteJournal?: (journal: Journal) => void
}

const columns = journalColumnLabels

// Whitelisted on the backend (see JournalService.resolveJournalSort) - anything else falls back
// to the createdAt DESC default, so only these two columns get sort affordances.
const SORTABLE_FIELDS: Partial<Record<(typeof columns)[number], string>> = {
  'journal date': 'journalDate',
  created_at: 'createdAt',
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

function baseTxnId(transactionId: string) {
  return transactionId.replace(/-d\d+$/, '')
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
          <td className="h-[64px] px-5">
            <div className="h-4 w-full max-w-16 animate-pulse rounded bg-[#eef3fb]" />
          </td>
        </tr>
      ))}
    </>
  )
}

export function JournalTable({
  journals,
  isLoading,
  onSelect,
  selectedIds,
  onToggleRow,
  onToggleAll,
  sortBy,
  sortDir,
  onSort,
  onDeleteJournal,
}: JournalTableProps) {
  const allSelected = journals.length > 0 && journals.every((journal) => selectedIds.has(journal.transactionId))

  return (
    <div className="max-h-[720px] overflow-y-auto bg-white">
      <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
        <colgroup>
          <col className="w-[3%]" />
          <col className="w-[9%]" />
          <col className="w-[13%]" />
          <col className="w-[8%]" />
          <col className="w-[8%]" />
          <col className="w-[8%]" />
          <col className="w-[6%]" />
          <col className="w-[8%]" />
          <col className="w-[8%]" />
          <col className="w-[12%]" />
          <col className="w-[17%]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-[#f8fbff] text-[#627194] shadow-[inset_0_-1px_0_#dfe6f4]">
          <tr>
            <th className="min-h-12 px-5 py-3 text-xs font-extrabold uppercase leading-tight tracking-[0.04em]">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                aria-label="Select all visible journal entries"
                disabled={journals.length === 0}
              />
            </th>
            {columns.map((column) => {
              const sortField = SORTABLE_FIELDS[column]
              const isActive = sortField != null && sortBy === sortField
              const isSortable = sortField != null && onSort != null
              return (
                <th
                  key={column}
                  className={`min-h-12 px-5 py-3 text-xs font-extrabold uppercase leading-tight tracking-[0.04em] ${
                    isSortable ? 'cursor-pointer select-none hover:text-[#33406f]' : ''
                  }`}
                  onClick={isSortable ? () => onSort?.(sortField as string) : undefined}
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
            <th className="min-h-12 px-5 py-3 text-xs font-extrabold uppercase leading-tight tracking-[0.04em]">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <LoadingRows />
          ) : journals.length === 0 ? (
            <tr>
              <td className="px-5 py-14 text-center text-sm font-semibold text-[#657295]" colSpan={columns.length + 2}>
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
                  <span className="block truncate font-semibold text-[#2d3b68]">{displayDate(journal.journalDate) || '-'}</span>
                </td>
                <td className="px-5 align-middle">
                  <span className="block truncate font-mono text-[13px] font-extrabold text-[#15214b]">
                    {baseTxnId(journal.transactionId)}
                  </span>
                  <span className="mt-1 block truncate text-xs font-bold text-[#7a86a6]">Click to view all journal lines</span>
                </td>
                <td className="px-5 align-middle">
                  <span className="block truncate font-mono text-[13px] font-bold text-[#2d3b68]">{journal.journal ?? '-'}</span>
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
                  <span className="block truncate font-semibold text-[#2d3b68]">{displayDate(journal.createdAt) || '-'}</span>
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
                <td className="px-5 align-middle">
                  <span className="block truncate font-mono text-xs font-bold text-[#2d3b68]" title={journal.odooReferenceId ?? undefined}>
                    {sanitizeOdooReference(journal.odooReferenceId) ?? '-'}
                  </span>
                </td>
                <td className="px-5 align-middle" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dfe6f4] bg-white px-2.5 text-xs font-bold text-[#493ee8] transition hover:bg-[#f7f8ff] disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => journal.odooEntryUrl && window.open(journal.odooEntryUrl, '_blank')}
                      disabled={!journal.odooEntryUrl}
                      title={journal.odooEntryUrl ? 'Open this entry in Odoo' : 'Not sent to Odoo yet'}
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      Odoo
                    </button>
                    {onDeleteJournal ? (
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#ffb8c2] bg-white text-[#dc2626] transition hover:bg-[#fff1f2] disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => onDeleteJournal(journal)}
                        disabled={journal.status === 'SENT'}
                        aria-label={`Delete journal entry ${journal.transactionId}`}
                        title={journal.status === 'SENT' ? 'Sent entries cannot be deleted' : 'Delete this journal entry'}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    ) : null}
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
