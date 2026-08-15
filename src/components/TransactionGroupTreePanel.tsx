import { ArrowLeft, ChevronDown, ChevronRight, ExternalLink, Trash2 } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import { getJournalTransactions, type TransactionGroupSummary, type TransactionGroupTreeNode } from '../services/api'
import type { Transaction } from '../types/transaction'
import { dashboardColumnLabels, displayDate, transactionCrDr, transactionDate, transactionJournalId } from '../utils/tableFields'

interface TransactionGroupTreePanelProps {
  group: TransactionGroupSummary
  tree: TransactionGroupTreeNode[]
  isLoading: boolean
  isDeleting?: boolean
  onBack: () => void
  onSelectTransaction: (transaction: Transaction) => void
  onDelete?: (transaction: Transaction) => void
}

// Same columns as the Dashboard's Transaction table (dashboardColumnLabels), plus a trailing
// Actions column for the per-row delete button - so the tree reads as a drilldown of that same
// table (hierarchy shown via indentation) rather than a visually separate widget.
const columns = [...dashboardColumnLabels, 'actions'] as const

function formatMoney(value: number | null | undefined) {
  if (value == null) {
    return '-'
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
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

function journalKeyOf(node: TransactionGroupTreeNode, index: number) {
  return `${node.txnId}::${node.journal ?? ''}::${index}`
}

function reasonLabel(reason: Transaction['notCompletedReason']) {
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

// Inline, full-width tree replacing the Dashboard table when a (txn_id, journal) group row is
// clicked - laid out as a table with the exact same columns as the Dashboard's Transaction
// table, so the tree reads as a drilldown of that table rather than a separate widget. Rows
// nest journal (level 1, expandable) -> account_number (level 2, expandable) -> individual raw
// transaction rows (level 3, leaf), shown via indentation within the same txn_id column.
export function TransactionGroupTreePanel({
  group,
  tree,
  isLoading,
  isDeleting = false,
  onBack,
  onSelectTransaction,
  onDelete,
}: TransactionGroupTreePanelProps) {
  const [expandedJournals, setExpandedJournals] = useState<Set<string>>(new Set())
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set())
  const [leafTransactions, setLeafTransactions] = useState<Transaction[]>([])
  const [isLoadingLeaves, setIsLoadingLeaves] = useState(false)
  const [leafTxnId, setLeafTxnId] = useState<string | null>(null)

  useEffect(() => {
    // A fresh group was opened - collapse everything and drop any leaves fetched for the
    // previous group rather than showing stale rows under the new tree.
    setExpandedJournals(new Set())
    setExpandedAccounts(new Set())
    setLeafTransactions([])
    setLeafTxnId(null)
  }, [group.txnId, group.journal])

  const totals = tree.reduce(
    (acc, node) =>
      node.accounts.reduce(
        (inner, account) => ({
          debit: inner.debit + (account.totalDebit ?? 0),
          credit: inner.credit + (account.totalCredit ?? 0),
        }),
        acc,
      ),
    { debit: 0, credit: 0 },
  )

  const toggleJournal = (key: string) => {
    setExpandedJournals((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const toggleAccount = async (key: string, txnId: string) => {
    setExpandedAccounts((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })

    if (leafTxnId !== txnId) {
      setIsLoadingLeaves(true)
      try {
        const transactions = await getJournalTransactions(txnId)
        setLeafTransactions(transactions)
        setLeafTxnId(txnId)
      } catch {
        setLeafTransactions([])
        setLeafTxnId(txnId)
      } finally {
        setIsLoadingLeaves(false)
      }
    }
  }

  return (
    <div className="bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#dfe6f4] bg-[#f8fbff] px-6 py-4">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[#dfe6f4] bg-white px-4 text-sm font-bold text-[#172452] shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to table
          </button>
          <div className="min-w-0">
            <h3 className="truncate font-mono text-sm font-extrabold text-[#15214b]">txn_id: {group.txnId}</h3>
            <p className="mt-0.5 truncate text-xs font-semibold text-[#7a86a6]">
              {group.recordCount} row{group.recordCount === 1 ? '' : 's'} · {displayDate(group.valueDate) || 'No date'}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-sm font-bold tabular-nums text-[#33406f]">
          Debit {formatMoney(totals.debit)} · Credit {formatMoney(totals.credit)}
        </div>
      </div>

      <div className="max-h-[600px] overflow-auto">
        {isLoading ? (
          <div className="p-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="mb-2 h-12 animate-pulse rounded-lg bg-[#eef3fb]" />
            ))}
          </div>
        ) : tree.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm font-semibold text-[#657295]">
            Could not load the underlying rows for this group.
          </div>
        ) : (
          <table className="w-full min-w-[1100px] table-fixed border-separate border-spacing-0 text-left text-sm">
            <colgroup>
              <col className="w-[11%]" />
              <col className="w-[20%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[7%]" />
              <col className="w-[15%]" />
              <col className="w-[13%]" />
              <col className="w-[9%]" />
              <col className="w-[7%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-[#f8fbff] text-[#627194] shadow-[inset_0_-1px_0_#dfe6f4]">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column}
                    className="px-3 py-3 text-left text-xs font-extrabold uppercase leading-tight tracking-[0.03em]"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tree.map((node, nodeIndex) => {
                const jKey = journalKeyOf(node, nodeIndex)
                const isJournalOpen = expandedJournals.has(jKey)
                const journalDebit = node.accounts.reduce((sum, account) => sum + (account.totalDebit ?? 0), 0)
                const journalCredit = node.accounts.reduce((sum, account) => sum + (account.totalCredit ?? 0), 0)
                const journalRecordCount = node.accounts.reduce((sum, account) => sum + (account.recordCount ?? 0), 0)

                return (
                  <Fragment key={jKey}>
                    <tr
                      className="cursor-pointer border-b border-[#edf1f8] bg-white transition hover:bg-[#f8fbff]"
                      onClick={() => toggleJournal(jKey)}
                    >
                      <td className="h-[56px] px-3 align-middle text-xs font-semibold text-[#2d3b68]">
                        {displayDate(group.valueDate) || '-'}
                      </td>
                      <td className="px-3 align-middle">
                        <span className="flex min-w-0 items-center gap-2">
                          {isJournalOpen ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-[#5748f5]" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-[#5748f5]" aria-hidden="true" />
                          )}
                          <span className="truncate font-mono text-[13px] font-extrabold text-[#15214b]">
                            {node.txnId}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 align-middle font-mono text-[13px] font-bold text-[#2d3b68]">
                        {node.journal ?? '-'}
                      </td>
                      <td className="px-3 align-middle font-extrabold tabular-nums text-[#16214c]">
                        {formatMoney(journalDebit || journalCredit)}
                      </td>
                      <td className="px-3 align-middle">
                        <span className="inline-flex whitespace-nowrap rounded-lg bg-[#f1f5fb] px-2.5 py-1 text-xs font-extrabold uppercase text-[#33406f]">
                          {journalRecordCount}
                        </span>
                      </td>
                      <td className="px-3 align-middle text-xs font-semibold text-[#2d3b68]">
                        {formatDateTime(group.uploadedAt)}
                      </td>
                      <td className="px-3 align-middle text-xs font-semibold text-[#2d3b68]">
                        {formatDateTime(group.processedAt)}
                      </td>
                      <td className="px-3 align-middle">
                        <span className="flex min-w-0 items-center gap-1.5">
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
                      <td className="px-3 align-middle" />
                    </tr>

                    {isJournalOpen
                      ? node.accounts.length === 0
                        ? (
                          <tr key={`${jKey}-empty`} className="border-b border-[#edf1f8] bg-[#fbfcff]">
                            <td className="px-3 py-3 pl-11 text-xs font-semibold text-[#8290b4]" colSpan={columns.length}>
                              No account lines.
                            </td>
                          </tr>
                        )
                        : node.accounts.map((account, accountIndex) => {
                            const aKey = `${jKey}::${account.account ?? accountIndex}`
                            const isAccountOpen = expandedAccounts.has(aKey)
                            const accountTransactions = leafTxnId === node.txnId
                              ? leafTransactions.filter((item) => item.accountId === account.account)
                              : []

                            return (
                              <Fragment key={aKey}>
                                <tr
                                  className="cursor-pointer border-b border-[#edf1f8] bg-[#fbfcff] transition hover:bg-[#f1f5fb]"
                                  onClick={() => void toggleAccount(aKey, node.txnId)}
                                >
                                  <td className="h-[48px] px-3 align-middle text-xs text-[#b7c0d8]">-</td>
                                  <td className="px-3 align-middle">
                                    <span className="flex min-w-0 items-center gap-2 pl-6">
                                      {isAccountOpen ? (
                                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#5748f5]" aria-hidden="true" />
                                      ) : (
                                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#5748f5]" aria-hidden="true" />
                                      )}
                                      <span className="truncate font-mono text-xs font-bold text-[#44527b]">
                                        account: {account.account ?? '-'}
                                      </span>
                                    </span>
                                  </td>
                                  <td className="px-3 align-middle font-mono text-xs font-semibold text-[#7a86a6]">
                                    {node.journal ?? '-'}
                                  </td>
                                  <td className="px-3 align-middle font-mono text-xs font-bold tabular-nums text-[#16214c]">
                                    Dr {formatMoney(account.totalDebit)} / Cr {formatMoney(account.totalCredit)}
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
                                  ? isLoadingLeaves && leafTxnId !== node.txnId
                                    ? (
                                      <tr key={`${aKey}-loading`} className="border-b border-[#edf1f8]">
                                        <td className="px-3 py-3" colSpan={columns.length}>
                                          <div className="h-8 animate-pulse rounded-lg bg-[#eef3fb]" />
                                        </td>
                                      </tr>
                                    )
                                    : accountTransactions.length === 0
                                      ? (
                                        <tr key={`${aKey}-none`} className="border-b border-[#edf1f8]">
                                          <td className="px-3 py-3 pl-16 text-xs font-semibold text-[#8290b4]" colSpan={columns.length}>
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
                                            <td className="h-[46px] px-3 align-middle text-xs font-semibold text-[#2d3b68]">
                                              {displayDate(transactionDate(item)) || '-'}
                                            </td>
                                            <td className="px-3 align-middle">
                                              <span className="flex min-w-0 items-center pl-12">
                                                <span className="truncate font-mono text-xs font-bold text-[#15214b]">
                                                  {item.transactionId}
                                                </span>
                                                <ReasonTag reason={item.notCompletedReason} />
                                              </span>
                                            </td>
                                            <td className="px-3 align-middle font-mono text-xs font-semibold text-[#7a86a6]">
                                              {transactionJournalId(item) || '-'}
                                            </td>
                                            <td className="px-3 align-middle font-mono text-xs font-bold tabular-nums text-[#16214c]">
                                              {transactionCrDr(item)} {formatMoney(item.amount)}
                                            </td>
                                            <td className="px-3 align-middle text-xs font-semibold text-[#7a86a6]">1</td>
                                            <td className="px-3 align-middle text-xs font-semibold text-[#2d3b68]">
                                              {formatDateTime(item.uploadedAt)}
                                            </td>
                                            <td className="px-3 align-middle text-xs font-semibold text-[#2d3b68]">
                                              {formatDateTime(item.processedAt)}
                                            </td>
                                            <td className="px-3 align-middle font-mono text-xs font-semibold text-[#2d3b68]">
                                              {item.odooReferenceId ?? '-'}
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
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
