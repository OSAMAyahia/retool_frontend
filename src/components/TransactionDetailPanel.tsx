import { ChevronDown, ChevronRight, RefreshCw, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { TransactionGroupSummary } from '../services/api'
import type { Transaction } from '../types/transaction'
import { displayDate, transactionCrDr, transactionJournalId } from '../utils/tableFields'
import { StatusBadge } from './StatusBadge'

interface TransactionDetailPanelProps {
  transaction: Transaction | null
  // When the user clicks a merged/grouped row in the Dashboard table (a value_date +
  // account_number + Debit/Credit group, possibly combining several raw legs), this is set
  // instead of `transaction` - the panel shows the list of underlying rows (fetched
  // separately, since the group itself is just a server-side aggregate) rather than one row's
  // fields. Clicking one of those rows drills into the normal single-transaction view.
  group: TransactionGroupSummary | null
  groupMembers: Transaction[]
  isLoadingGroupMembers: boolean
  isRetrying: boolean
  retryMessage: string | null
  retryError: string | null
  onClose: () => void
  onRetry: (transaction: Transaction) => void
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

export function TransactionDetailPanel({
  transaction,
  group,
  groupMembers,
  isLoadingGroupMembers,
  isRetrying,
  retryMessage,
  retryError,
  onClose,
  onRetry,
  onSelectFromGroup,
}: TransactionDetailPanelProps) {
  const [rawOpen, setRawOpen] = useState(false)

  const rawJson = useMemo(() => {
    const payload = transaction?.rawPayload ?? transaction
    return JSON.stringify(payload, null, 2)
  }, [transaction])

  if (!transaction && group) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/30" role="dialog" aria-modal="true">
        <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-2xl">
          <header className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-slate-950">
                  {group.recordCount} merged row{group.recordCount === 1 ? '' : 's'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {group.accountId} · {group.type} · {displayDate(group.valueDate) || 'No date'} · total{' '}
                  {formatGroupAmount(group.totalAmount)}
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
              These rows share the same value date, account, and Debit/Credit direction, so they'll be
              combined into one line when sent to Odoo. Click any row below to see its full details.
            </p>
            {isLoadingGroupMembers ? (
              <div className="grid gap-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : groupMembers.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Could not load the underlying rows for this group.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                {groupMembers.map((item) => (
                  <li key={item.transactionId}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                      onClick={() => onSelectFromGroup(item)}
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-mono text-sm font-semibold text-slate-900">
                            {item.transactionId}
                          </span>
                          <ReasonTag reason={item.notCompletedReason} />
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          journal {transactionJournalId(item) || '-'} · {transactionCrDr(item)}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-sm font-bold text-slate-900">
                        {formatGroupAmount(item.amount)}
                      </span>
                    </button>
                  </li>
                ))}
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

        {transaction.internalStatus === 'REJECTED' ? (
          <footer className="border-t border-slate-200 px-5 py-4">
            <button
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={() => onRetry(transaction)}
              disabled={isRetrying}
            >
              <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} aria-hidden="true" />
              Retry Transaction
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  )
}
