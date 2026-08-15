import { ChevronDown, ChevronRight, RefreshCw, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getJournalTransactions, type TransactionGroupSummary, type TransactionGroupTreeNode } from '../services/api'
import type { Transaction } from '../types/transaction'
import { displayDate } from '../utils/tableFields'
import { StatusBadge } from './StatusBadge'

interface TransactionDetailPanelProps {
  transaction: Transaction | null
  // When the user clicks a merged/grouped row in the Dashboard table (a txn_id + journal
  // group, possibly combining several raw legs across accounts), this is set instead of
  // `transaction` - the panel shows a txn_id -> journal -> account_number tree (fetched
  // separately, since the group itself is just a server-side aggregate) rather than one row's
  // fields. Clicking a leaf transaction drills into the normal single-transaction view.
  group: TransactionGroupSummary | null
  groupTree: TransactionGroupTreeNode[]
  isLoadingGroupTree: boolean
  isRetrying: boolean
  // True while a delete request for a transaction (single view or a group member) is in flight.
  isDeleting?: boolean
  retryMessage: string | null
  retryError: string | null
  onClose: () => void
  onRetry: (transaction: Transaction) => void
  // Deletes one raw transaction row. Optional so panels that don't offer deletion keep working.
  onDelete?: (transaction: Transaction) => void
  onSelectFromGroup: (transaction: Transaction) => void
}

function formatGroupAmount(amount: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
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
    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">
      {label}
    </span>
  )
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-3">
      <dt className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-900">{value ?? '-'}</dd>
    </div>
  )
}

// Formats using the raw stored value's own date/time components (UTC getters), never the
// browser's local timezone, so the value on screen always matches what's stored - no shifting.
function pad(value: number) {
  return String(value).padStart(2, '0')
}

function formatDateOnly(value: string | null) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`
}

// Unlike formatDateOnly above (used for value_date, a literal value from the imported file that
// must never shift), createdAt/updatedAt are system-generated "now" timestamps with no original
// literal to preserve - showing them in the viewer's own local time (what their wall clock says
// "now" was) is what users expect, so this intentionally uses local getters, not UTC ones.
function formatDateTime(value: string | null) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const hours24 = date.getHours()
  const period = hours24 >= 12 ? 'PM' : 'AM'
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12

  const datePart = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
  const timePart = `${hours12}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${period}`

  return `${datePart} ${timePart}`
}

// Key for the journal level within the tree - a Dashboard group is already scoped to one
// (txnId, journal) pair per Task 1's grouping, so there is usually exactly one journal node,
// but the key still disambiguates in case a txnId ever spans more than one journal.
function journalKeyOf(node: TransactionGroupTreeNode, index: number) {
  return `${node.txnId}::${node.journal ?? ''}::${index}`
}

export function TransactionDetailPanel({
  transaction,
  group,
  groupTree,
  isLoadingGroupTree,
  isRetrying,
  isDeleting = false,
  retryMessage,
  retryError,
  onClose,
  onRetry,
  onDelete,
  onSelectFromGroup,
}: TransactionDetailPanelProps) {
  const [rawOpen, setRawOpen] = useState(false)
  const [expandedJournals, setExpandedJournals] = useState<Set<string>>(new Set())
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set())
  const [leafTransactions, setLeafTransactions] = useState<Transaction[]>([])
  const [isLoadingLeaves, setIsLoadingLeaves] = useState(false)
  const [leafTxnId, setLeafTxnId] = useState<string | null>(null)

  const rawJson = useMemo(() => {
    const payload = transaction?.rawPayload ?? transaction
    return JSON.stringify(payload, null, 2)
  }, [transaction])

  // Reset expand/collapse state whenever a different group is opened.
  useEffect(() => {
    setExpandedJournals(new Set())
    setExpandedAccounts(new Set())
    setLeafTransactions([])
    setLeafTxnId(null)
  }, [group])

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

  if (!transaction && group) {
    const totals = groupTree.reduce(
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

    return (
      <div className="fixed inset-0 z-50 bg-slate-950/30" role="dialog" aria-modal="true">
        <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-2xl">
          <header className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-slate-950">txn_id: {group.txnId}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {group.recordCount} row{group.recordCount === 1 ? '' : 's'} ·{' '}
                  {displayDate(group.valueDate) || 'No date'} · debit {formatGroupAmount(totals.debit)} · credit{' '}
                  {formatGroupAmount(totals.credit)}
                </p>
              </div>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                type="button"
                onClick={onClose}
                aria-label="Close detail panel"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <p className="mb-3 text-xs font-medium text-slate-500">
              These rows share the same txn_id and journal, so they'll be combined into one entry when sent
              to Odoo. Expand a journal, then an account, to see and manage its individual rows.
            </p>
            {isLoadingGroupTree ? (
              <div className="grid gap-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : groupTree.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Could not load the underlying rows for this group.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                {groupTree.map((node, nodeIndex) => {
                  const jKey = journalKeyOf(node, nodeIndex)
                  const isJournalOpen = expandedJournals.has(jKey)
                  return (
                    <li key={jKey}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                        onClick={() => toggleJournal(jKey)}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {isJournalOpen ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                          )}
                          <span className="truncate text-sm font-semibold text-slate-900">
                            journal: {node.journal ?? '-'}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-slate-500">
                          {node.accounts.length} account{node.accounts.length === 1 ? '' : 's'}
                        </span>
                      </button>

                      {isJournalOpen ? (
                        <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/50 pl-6">
                          {node.accounts.map((account, accountIndex) => {
                            const aKey = `${jKey}::${account.account ?? accountIndex}`
                            const isAccountOpen = expandedAccounts.has(aKey)
                            const accountTransactions = leafTxnId === node.txnId
                              ? leafTransactions.filter((item) => item.accountId === account.account)
                              : []
                            return (
                              <li key={aKey}>
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-slate-100"
                                  onClick={() => void toggleAccount(aKey, node.txnId)}
                                >
                                  <span className="flex min-w-0 items-center gap-2">
                                    {isAccountOpen ? (
                                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                                    ) : (
                                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                                    )}
                                    <span className="truncate font-mono text-xs font-semibold text-slate-800">
                                      account: {account.account ?? '-'}
                                    </span>
                                  </span>
                                  <span className="shrink-0 font-mono text-xs font-bold text-slate-800">
                                    Debit {formatGroupAmount(account.totalDebit)} · Credit{' '}
                                    {formatGroupAmount(account.totalCredit)}
                                  </span>
                                </button>

                                {isAccountOpen ? (
                                  isLoadingLeaves && leafTxnId !== node.txnId ? (
                                    <div className="px-6 py-3">
                                      <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
                                    </div>
                                  ) : accountTransactions.length === 0 ? (
                                    <p className="px-6 py-3 text-xs text-slate-500">
                                      No individual rows found for this account leg.
                                    </p>
                                  ) : (
                                    <ul className="divide-y divide-slate-100 bg-white">
                                      {accountTransactions.map((item) => (
                                        <li key={item.transactionId} className="flex items-center">
                                          <button
                                            type="button"
                                            className="flex flex-1 min-w-0 items-center justify-between gap-3 py-2.5 pl-10 pr-3 text-left transition hover:bg-slate-50"
                                            onClick={() => onSelectFromGroup(item)}
                                          >
                                            <span className="min-w-0">
                                              <span className="flex items-center gap-2">
                                                <span className="truncate font-mono text-xs font-semibold text-slate-900">
                                                  {item.transactionId}
                                                </span>
                                                <ReasonTag reason={item.notCompletedReason} />
                                              </span>
                                            </span>
                                            <span className="shrink-0 font-mono text-xs font-bold text-slate-900">
                                              {formatGroupAmount(item.amount)}
                                            </span>
                                          </button>
                                          {onDelete ? (
                                            <button
                                              type="button"
                                              className="mr-3 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
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
                                        </li>
                                      ))}
                                    </ul>
                                  )
                                ) : null}
                              </li>
                            )
                          })}
                        </ul>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!transaction) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30" role="dialog" aria-modal="true">
      <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-2xl">
        <header className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={transaction.internalStatus} />
                <ReasonTag reason={transaction.notCompletedReason} />
              </div>
              <h2 className="truncate text-lg font-semibold text-slate-950">
                {transaction.transactionId}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{transaction.description ?? 'No description'}</p>
            </div>
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              type="button"
              onClick={onClose}
              aria-label="Close detail panel"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Account ID" value={transaction.accountId} />
            <Field label="Amount" value={`${transaction.amount.toFixed(2)} ${transaction.currency}`} />
            <Field label="Type" value={transaction.type} />
            <Field label="Source" value={transaction.source} />
            <Field label="Source Status" value={transaction.sourceStatus} />
            <Field label="Retry Count" value={transaction.retryCount} />
            <Field label="Odoo Reference ID" value={transaction.odooReferenceId} />
            <Field label="Value Date" value={formatDateOnly(transaction.valueDate)} />
            <Field label="Uploaded Date (Receiving Date)" value={formatDateTime(transaction.uploadedAt ?? null)} />
            <Field label="Processing Date" value={formatDateTime(transaction.processedAt ?? null)} />
            <Field label="Created At" value={formatDateTime(transaction.createdAt)} />
            <Field label="Updated At" value={formatDateTime(transaction.updatedAt)} />
          </dl>

          {transaction.lastError ? (
            <section className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <h3 className="font-semibold text-red-800">
                Last Error
                {reasonLabel(transaction.notCompletedReason) ? ` — ${reasonLabel(transaction.notCompletedReason)}` : ''}
              </h3>
              <p className="mt-1 whitespace-pre-wrap">{transaction.lastError}</p>
            </section>
          ) : null}

          {retryMessage ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
              {retryMessage}
            </div>
          ) : null}

          {retryError ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
              {retryError}
            </div>
          ) : null}

          <section className="mt-4 rounded-lg border border-slate-200">
            <button
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-900"
              type="button"
              onClick={() => setRawOpen((current) => !current)}
            >
              Raw JSON Payload
              {rawOpen ? (
                <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
              )}
            </button>
            {rawOpen ? (
              <pre className="max-h-80 overflow-auto border-t border-slate-200 bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
                <code>{rawJson}</code>
              </pre>
            ) : null}
          </section>
        </div>

        {transaction.internalStatus === 'REJECTED' || onDelete ? (
          <footer className="flex items-center gap-3 border-t border-slate-200 px-5 py-4">
            {transaction.internalStatus === 'REJECTED' ? (
              <button
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={() => onRetry(transaction)}
                disabled={isRetrying}
              >
                <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} aria-hidden="true" />
                Retry Transaction
              </button>
            ) : null}
            {onDelete ? (
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={() => onDelete(transaction)}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete Transaction
              </button>
            ) : null}
          </footer>
        ) : null}
      </div>
    </div>
  )
}
