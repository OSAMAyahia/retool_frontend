import { ChevronDown, ChevronRight, RefreshCw, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Transaction } from '../types/transaction'
import { StatusBadge } from './StatusBadge'

interface TransactionDetailPanelProps {
  transaction: Transaction | null
  isRetrying: boolean
  retryMessage: string | null
  retryError: string | null
  onClose: () => void
  onRetry: (transaction: Transaction) => void
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-3">
      <dt className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-900">{value ?? '-'}</dd>
    </div>
  )
}

function formatDate(value: string | null) {
  if (!value) {
    return null
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value))
}

export function TransactionDetailPanel({
  transaction,
  isRetrying,
  retryMessage,
  retryError,
  onClose,
  onRetry,
}: TransactionDetailPanelProps) {
  const [rawOpen, setRawOpen] = useState(false)

  const rawJson = useMemo(() => {
    const payload = transaction?.rawPayload ?? transaction
    return JSON.stringify(payload, null, 2)
  }, [transaction])

  if (!transaction) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30" role="dialog" aria-modal="true">
      <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-2xl">
        <header className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2">
                <StatusBadge status={transaction.internalStatus} />
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
            <Field label="Source Status" value={transaction.sourceStatus} />
            <Field label="Retry Count" value={transaction.retryCount} />
            <Field label="Odoo Reference ID" value={transaction.odooReferenceId} />
            <Field label="Value Date" value={formatDate(transaction.valueDate)} />
            <Field label="Created At" value={formatDate(transaction.createdAt)} />
            <Field label="Updated At" value={formatDate(transaction.updatedAt)} />
          </dl>

          {transaction.lastError ? (
            <section className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <h3 className="font-semibold text-red-800">Last Error</h3>
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

        {transaction.internalStatus === 'FAILED' ? (
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

