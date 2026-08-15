import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ExternalLink, Trash2 } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import { getJournalTransactions, getTransactionGroupTree, type TransactionGroupSummary, type TransactionGroupTreeNode } from '../services/api'
import type { SortDirection, Transaction, TransactionFilters } from '../types/transaction'
import { dashboardColumnLabels, displayDate, sanitizeOdooReference, transactionCrDr, transactionDate, transactionJournalId, transactionTxnId } from '../utils/tableFields'

interface TransactionTableProps {
  groups: TransactionGroupSummary[]
  isLoading: boolean
  // Needed to scope the txn_id -> journal -> account tree fetch (GET /transactions/grouped-tree)
  // to whatever filters are currently applied, same as the top-level grouped rows themselves.
  filters: TransactionFilters
  // Bumped by the parent after any delete so every currently-expanded row refetches its tree/
  // leaves - this table owns its own expand/fetch state, so the parent has no other way to tell
  // it "the underlying data changed, go refresh what you're showing."
  refreshSignal?: number
  isDeleting?: boolean
  // When the Dashboard's "Not mapped"/"Not balanced" sub-filter is active, every visible row
  // already matches that reason (it's the query's WHERE clause) - shown as a small tag next to
  // each row so it's clear why these rows never became a Journal Table entry.
  activeReason?: string
  sortBy?: string
  sortDir?: SortDirection
  onSort?: (field: string) => void
  onSelectTransaction: (transaction: Transaction) => void
  onDelete?: (transaction: Transaction) => void
  // Deletes every selected leaf transaction (across any number of expanded txn_id rows) in one
  // confirm. Optional so the checkbox column and "Delete Selected" bar only render when wired up.
  onBulkDelete?: (transactionIds: string[]) => void
}

// Same columns as before, plus a leading checkbox column (only meaningful at leaf rows) and a
// trailing Actions column for the per-row delete button - the txn_id/journal/account tree is
// rendered as indented rows within this SAME table, one screen, no separate view to navigate to.
const columns = ['', ...dashboardColumnLabels, 'actions'] as const

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

function reasonLabel(reason: Transaction['notCompletedReason']) {
  return reasonTagLabel(reason ?? undefined)
}

function ReasonTag({ reason }: { reason: Transaction['notCompletedReason'] }) {
  const label = reasonLabel(reason)
  if (!label) {
    return null
  }
  return (
    <span className="ml-1.5 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">
      {label}
    </span>
  )
}

function formatAmountValue(amount: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

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

function dotClass(recordCount: number) {
  return recordCount > 1
    ? 'bg-[#5748f5] shadow-[0_0_0_4px_rgba(87,72,245,0.14)]'
    : 'bg-[#94a3c4] shadow-[0_0_0_4px_rgba(148,163,196,0.14)]'
}

function journalKeyOf(node: TransactionGroupTreeNode, index: number) {
  return `${node.txnId}::${node.journal ?? ''}::${index}`
}

interface TxnRowState {
  isLoadingTree: boolean
  tree: TransactionGroupTreeNode[]
  expandedJournals: Set<string>
  expandedAccounts: Set<string>
  leafTransactions: Transaction[]
  isLoadingLeaves: boolean
  leavesLoaded: boolean
  // True only when the leaves fetch itself errored (network/5xx) - kept distinct from "loaded,
  // genuinely empty" so a transient failure shows a "couldn't load, click to retry" message
  // instead of the misleading "No individual rows found for this account leg."
  leavesFailed: boolean
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
  filters,
  refreshSignal,
  isDeleting = false,
  activeReason,
  sortBy,
  sortDir,
  onSort,
  onSelectTransaction,
  onDelete,
  onBulkDelete,
}: TransactionTableProps) {
  const reasonLabelForBadge = reasonTagLabel(activeReason)
  const [rowStates, setRowStates] = useState<Map<string, TxnRowState>>(new Map())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const updateRow = (txnId: string, updater: (state: TxnRowState) => TxnRowState) => {
    setRowStates((current) => {
      const existing = current.get(txnId)
      if (!existing) {
        return current
      }
      const next = new Map(current)
      next.set(txnId, updater(existing))
      return next
    })
  }

  const fetchTree = async (txnId: string) => {
    updateRow(txnId, (state) => ({ ...state, isLoadingTree: true }))
    try {
      const tree = await getTransactionGroupTree(filters, txnId)
      updateRow(txnId, (state) => ({ ...state, tree, isLoadingTree: false }))
    } catch {
      updateRow(txnId, (state) => ({ ...state, tree: [], isLoadingTree: false }))
    }
  }

  const fetchLeaves = async (txnId: string) => {
    updateRow(txnId, (state) => ({ ...state, isLoadingLeaves: true, leavesFailed: false }))
    try {
      const transactions = await getJournalTransactions(txnId)
      updateRow(txnId, (state) => ({ ...state, leafTransactions: transactions, isLoadingLeaves: false, leavesLoaded: true, leavesFailed: false }))
    } catch {
      // Don't cache this as "loaded, empty" - leavesLoaded stays false so the next toggle (or
      // the Retry action) tries again, instead of permanently showing a misleading "No
      // individual rows found" for what was actually just a failed request.
      updateRow(txnId, (state) => ({ ...state, leafTransactions: [], isLoadingLeaves: false, leavesLoaded: false, leavesFailed: true }))
    }
  }

  // Refetch tree/leaves for every currently-expanded row after a delete elsewhere invalidates
  // the underlying data - this table owns its own fetch state, so nothing else will do this.
  useEffect(() => {
    if (refreshSignal === undefined) {
      return
    }
    for (const [txnId, state] of rowStates) {
      void fetchTree(txnId)
      if (state.leavesLoaded) {
        void fetchLeaves(txnId)
      }
    }
    // Only re-run when the signal itself changes - re-running on every rowStates change would
    // refetch on every expand/collapse too, which is unnecessary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal])

  const toggleTxn = (txnId: string) => {
    if (rowStates.has(txnId)) {
      setRowStates((current) => {
        const next = new Map(current)
        next.delete(txnId)
        return next
      })
      return
    }
    setRowStates((current) => {
      const next = new Map(current)
      next.set(txnId, {
        isLoadingTree: true,
        tree: [],
        expandedJournals: new Set(),
        expandedAccounts: new Set(),
        leafTransactions: [],
        isLoadingLeaves: false,
        leavesLoaded: false,
        leavesFailed: false,
      })
      return next
    })
    void fetchTree(txnId)
  }

  const toggleJournal = (txnId: string, key: string) => {
    updateRow(txnId, (state) => {
      const next = new Set(state.expandedJournals)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return { ...state, expandedJournals: next }
    })
  }

  const toggleAccount = (txnId: string, key: string) => {
    let needsLeaves = false
    updateRow(txnId, (state) => {
      const next = new Set(state.expandedAccounts)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      needsLeaves = !state.leavesLoaded
      return { ...state, expandedAccounts: next }
    })
    if (needsLeaves) {
      void fetchLeaves(txnId)
    }
  }

  const toggleSelected = (transactionId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(transactionId)) {
        next.delete(transactionId)
      } else {
        next.add(transactionId)
      }
      return next
    })
  }

  return (
    <div className="bg-white">
      {onBulkDelete && selectedIds.size > 0 ? (
        <div className="flex items-center justify-between gap-4 border-b border-[#dfe6f4] bg-[#fff7f7] px-6 py-3">
          <span className="text-sm font-bold text-[#7a0f24]">{selectedIds.size} transaction(s) selected</span>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-bold text-red-600 shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDeleting}
            onClick={() => {
              onBulkDelete(Array.from(selectedIds))
              setSelectedIds(new Set())
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete Selected ({selectedIds.size})
          </button>
        </div>
      ) : null}

      <div className="max-h-[680px] overflow-auto">
        <table className="w-full min-w-[1150px] table-fixed border-separate border-spacing-0 text-left text-sm">
          <colgroup>
            <col className="w-[3%]" />
            <col className="w-[10%]" />
            <col className="w-[19%]" />
            <col className="w-[11%]" />
            <col className="w-[9%]" />
            <col className="w-[7%]" />
            <col className="w-[14%]" />
            <col className="w-[12%]" />
            <col className="w-[9%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-[#f8fbff] text-[#627194] shadow-[inset_0_-1px_0_#dfe6f4]">
            <tr>
              {columns.map((column, index) => {
                const sortField = SORTABLE_FIELDS[column as (typeof dashboardColumnLabels)[number]]
                const isActive = sortField != null && sortBy === sortField
                return (
                  <th
                    key={`${column}-${index}`}
                    className={`px-3 py-3 text-left text-xs font-extrabold uppercase leading-tight tracking-[0.03em] ${
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
                const rowState = rowStates.get(group.txnId)
                const isOpen = rowState !== undefined
                return (
                  <Fragment key={group.txnId}>
                    <tr
                      className={`group cursor-pointer border-b border-[#edf1f8] transition hover:bg-[#f8fbff] ${
                        group.recordCount > 1 ? 'bg-[#f8fbff]' : 'bg-white'
                      }`}
                      onClick={() => toggleTxn(group.txnId)}
                    >
                      <td className="px-3 align-middle" />
                      <td className="h-[60px] px-3 align-middle">
                        <span className="block truncate font-semibold text-[#2d3b68]">
                          {displayDate(group.valueDate) || '-'}
                        </span>
                      </td>
                      <td className="px-3 align-middle">
                        <span className="flex min-w-0 items-center gap-2">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-[#5748f5]" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-[#5748f5]" aria-hidden="true" />
                          )}
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
                              {reasonLabelForBadge ? (
                                <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-amber-800">
                                  {reasonLabelForBadge}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="px-3 align-middle text-xs text-[#b7c0d8]">-</td>
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
                            {sanitizeOdooReference(group.odooReferenceId) ?? '-'}
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
                      <td className="px-3 align-middle" />
                    </tr>

                    {isOpen ? (
                      rowState.isLoadingTree ? (
                        <tr className="border-b border-[#edf1f8]">
                          <td className="px-3 py-3" colSpan={columns.length}>
                            <div className="h-10 animate-pulse rounded-lg bg-[#eef3fb]" />
                          </td>
                        </tr>
                      ) : rowState.tree.length === 0 ? (
                        <tr className="border-b border-[#edf1f8]">
                          <td className="px-3 py-6 pl-11 text-xs font-semibold text-[#8290b4]" colSpan={columns.length}>
                            Could not load the underlying rows for this group.
                          </td>
                        </tr>
                      ) : (
                        rowState.tree.map((node, nodeIndex) => {
                          const jKey = journalKeyOf(node, nodeIndex)
                          const isJournalOpen = rowState.expandedJournals.has(jKey)
                          const journalDebit = node.accounts.reduce((sum, account) => sum + (account.totalDebit ?? 0), 0)
                          const journalCredit = node.accounts.reduce((sum, account) => sum + (account.totalCredit ?? 0), 0)
                          const journalRecordCount = node.accounts.reduce((sum, account) => sum + (account.recordCount ?? 0), 0)

                          return (
                            <Fragment key={jKey}>
                              <tr
                                className="cursor-pointer border-b border-[#edf1f8] bg-[#fbfcff] transition hover:bg-[#f1f5fb]"
                                onClick={() => toggleJournal(group.txnId, jKey)}
                              >
                                <td className="px-3 align-middle" />
                                <td className="h-[48px] px-3 align-middle text-xs text-[#b7c0d8]">-</td>
                                <td className="px-3 align-middle">
                                  <span className="flex min-w-0 items-center gap-2 pl-6">
                                    {isJournalOpen ? (
                                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#5748f5]" aria-hidden="true" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#5748f5]" aria-hidden="true" />
                                    )}
                                    <span className="truncate font-mono text-xs font-bold text-[#44527b]">
                                      journal: {node.journal ?? '-'}
                                    </span>
                                  </span>
                                </td>
                                <td className="px-3 align-middle font-mono text-xs font-bold text-[#2d3b68]">
                                  {node.journal ?? '-'}
                                </td>
                                <td className="px-3 align-middle font-mono text-xs font-bold tabular-nums text-[#16214c]">
                                  Dr {formatAmountValue(journalDebit)} / Cr {formatAmountValue(journalCredit)}
                                </td>
                                <td className="px-3 align-middle">
                                  <span className="inline-flex whitespace-nowrap rounded-lg bg-[#eef1fa] px-2 py-0.5 text-[11px] font-extrabold uppercase text-[#33406f]">
                                    {journalRecordCount}
                                  </span>
                                </td>
                                <td className="px-3 align-middle text-xs text-[#b7c0d8]">-</td>
                                <td className="px-3 align-middle text-xs text-[#b7c0d8]">-</td>
                                <td className="px-3 align-middle text-xs text-[#b7c0d8]">-</td>
                                <td className="px-3 align-middle" />
                              </tr>

                              {isJournalOpen
                                ? node.accounts.length === 0
                                  ? (
                                    <tr className="border-b border-[#edf1f8] bg-[#fbfcff]">
                                      <td className="px-3 py-3 pl-16 text-xs font-semibold text-[#8290b4]" colSpan={columns.length}>
                                        No account lines.
                                      </td>
                                    </tr>
                                  )
                                  : node.accounts.map((account, accountIndex) => {
                                      const aKey = `${jKey}::${account.account ?? accountIndex}`
                                      const isAccountOpen = rowState.expandedAccounts.has(aKey)
                                      const accountTransactions = rowState.leavesLoaded
                                        ? rowState.leafTransactions.filter((item) => item.accountId === account.account)
                                        : []

                                      return (
                                        <Fragment key={aKey}>
                                          <tr
                                            className="cursor-pointer border-b border-[#edf1f8] bg-white transition hover:bg-[#f8fbff]"
                                            onClick={() => toggleAccount(group.txnId, aKey)}
                                          >
                                            <td className="px-3 align-middle" />
                                            <td className="h-[44px] px-3 align-middle text-xs text-[#b7c0d8]">-</td>
                                            <td className="px-3 align-middle">
                                              <span className="flex min-w-0 items-center gap-2 pl-11">
                                                {isAccountOpen ? (
                                                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#5748f5]" aria-hidden="true" />
                                                ) : (
                                                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#5748f5]" aria-hidden="true" />
                                                )}
                                                <span className="truncate font-mono text-xs font-semibold text-[#44527b]">
                                                  account: {account.account ?? '-'}
                                                </span>
                                              </span>
                                            </td>
                                            <td className="px-3 align-middle font-mono text-xs font-semibold text-[#7a86a6]">
                                              {node.journal ?? '-'}
                                            </td>
                                            <td className="px-3 align-middle font-mono text-xs font-bold tabular-nums text-[#16214c]">
                                              Dr {formatAmountValue(account.totalDebit ?? 0)} / Cr {formatAmountValue(account.totalCredit ?? 0)}
                                            </td>
                                            <td className="px-3 align-middle">
                                              <span className="inline-flex whitespace-nowrap rounded-lg bg-[#eef1fa] px-2 py-0.5 text-[11px] font-extrabold uppercase text-[#33406f]">
                                                {account.recordCount}
                                              </span>
                                            </td>
                                            <td className="px-3 align-middle text-xs text-[#b7c0d8]">-</td>
                                            <td className="px-3 align-middle text-xs text-[#b7c0d8]">-</td>
                                            <td className="px-3 align-middle text-xs text-[#b7c0d8]">-</td>
                                            <td className="px-3 align-middle" />
                                          </tr>

                                          {isAccountOpen
                                            ? rowState.isLoadingLeaves && !rowState.leavesLoaded
                                              ? (
                                                <tr className="border-b border-[#edf1f8]">
                                                  <td className="px-3 py-3" colSpan={columns.length}>
                                                    <div className="h-8 animate-pulse rounded-lg bg-[#eef3fb]" />
                                                  </td>
                                                </tr>
                                              )
                                              : rowState.leavesFailed
                                                ? (
                                                  <tr className="border-b border-[#edf1f8]">
                                                    <td className="px-3 py-3 pl-20 text-xs font-semibold text-[#dc2626]" colSpan={columns.length}>
                                                      Couldn't load these rows.{' '}
                                                      <button
                                                        type="button"
                                                        className="font-bold underline underline-offset-2"
                                                        onClick={(event) => {
                                                          event.stopPropagation()
                                                          void fetchLeaves(group.txnId)
                                                        }}
                                                      >
                                                        Retry
                                                      </button>
                                                    </td>
                                                  </tr>
                                                )
                                                : accountTransactions.length === 0
                                                  ? (
                                                    <tr className="border-b border-[#edf1f8]">
                                                      <td className="px-3 py-3 pl-20 text-xs font-semibold text-[#8290b4]" colSpan={columns.length}>
                                                        No individual rows found for this account leg.
                                                      </td>
                                                    </tr>
                                                  )
                                                  : accountTransactions.map((item) => (
                                                    <tr
                                                      key={item.transactionId}
                                                      className="cursor-pointer border-b border-[#edf1f8] bg-white transition hover:bg-[#f8fbff]"
                                                      onClick={() => onSelectTransaction(item)}
                                                    >
                                                      <td className="px-3 align-middle" onClick={(event) => event.stopPropagation()}>
                                                        {onBulkDelete ? (
                                                          <input
                                                            type="checkbox"
                                                            className="h-4 w-4 rounded border-[#dfe6f4] accent-[#5748f5]"
                                                            checked={selectedIds.has(item.transactionId)}
                                                            onChange={() => toggleSelected(item.transactionId)}
                                                            aria-label={`Select transaction ${item.transactionId}`}
                                                          />
                                                        ) : null}
                                                      </td>
                                                      <td className="h-[42px] px-3 align-middle text-xs font-semibold text-[#2d3b68]">
                                                        {displayDate(transactionDate(item)) || '-'}
                                                      </td>
                                                      <td className="px-3 align-middle">
                                                        <span className="flex min-w-0 items-center pl-16">
                                                          <span className="truncate font-mono text-xs font-bold text-[#15214b]">
                                                            {transactionTxnId(item)}
                                                          </span>
                                                          <ReasonTag reason={item.notCompletedReason} />
                                                        </span>
                                                      </td>
                                                      <td className="px-3 align-middle font-mono text-xs font-semibold text-[#7a86a6]">
                                                        {transactionJournalId(item) || '-'}
                                                      </td>
                                                      <td className="px-3 align-middle font-mono text-xs font-bold tabular-nums text-[#16214c]">
                                                        {transactionCrDr(item)} {formatAmountValue(item.amount)}
                                                      </td>
                                                      <td className="px-3 align-middle text-xs font-semibold text-[#7a86a6]">1</td>
                                                      <td className="px-3 align-middle text-xs font-semibold text-[#2d3b68]">
                                                        {formatDateTime(item.uploadedAt)}
                                                      </td>
                                                      <td className="px-3 align-middle text-xs font-semibold text-[#2d3b68]">
                                                        {formatDateTime(item.processedAt)}
                                                      </td>
                                                      <td className="px-3 align-middle font-mono text-xs font-semibold text-[#2d3b68]">
                                                        {sanitizeOdooReference(item.odooReferenceId) ?? '-'}
                                                      </td>
                                                      <td className="px-3 align-middle">
                                                        {onDelete ? (
                                                          <button
                                                            type="button"
                                                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#94a3c4] transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                                            title="Delete this transaction"
                                                            aria-label={`Delete transaction ${item.transactionId}`}
                                                            disabled={isDeleting}
                                                            onClick={(event) => {
                                                              event.stopPropagation()
                                                              onDelete(item)
                                                            }}
                                                          >
                                                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                                          </button>
                                                        ) : null}
                                                      </td>
                                                    </tr>
                                                  ))
                                            : null}
                                        </Fragment>
                                      )
                                    })
                                : null}
                            </Fragment>
                          )
                        })
                      )
                    ) : null}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
