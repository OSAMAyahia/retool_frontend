import { ChevronDown, ChevronRight, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Journal } from '../types/transaction'
import { StatusBadge } from './StatusBadge'

interface JournalDetailPanelProps {
  journal: Journal | null
  onClose: () => void
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

function formatMoney(value: number | null) {
  if (value == null) {
    return null
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function JournalDetailPanel({ journal, onClose }: JournalDetailPanelProps) {
  const [rawOpen, setRawOpen] = useState(false)

  const rawJson = useMemo(() => {
    const payload = journal?.rawPayload ?? journal
    return JSON.stringify(payload, null, 2)
  }, [journal])

  if (!journal) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30" role="dialog" aria-modal="true">
      <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white shadow-2xl">
        <header className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2">
                <StatusBadge status={journal.status} />
              </div>
              <h2 className="truncate text-lg font-semibold text-slate-950">
                {journal.reference ?? journal.transactionId}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{journal.itemLabel ?? 'Journal row details'}</p>
            </div>
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              type="button"
              onClick={onClose}
              aria-label="Close journal detail panel"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Transaction ID" value={journal.transactionId} />
            <Field label="Journal Date" value={formatDate(journal.journalDate)} />
            <Field label="Journal" value={journal.journal} />
            <Field label="Reference" value={journal.reference} />
            <Field label="Journal Items/label" value={journal.itemLabel} />
            <Field label="Journal Items/Account" value={journal.itemAccount} />
            <Field label="Debit" value={formatMoney(journal.debit)} />
            <Field label="Credit" value={formatMoney(journal.credit)} />
            <Field label="Analytic" value={journal.analytic} />
            <Field label="Odoo Reference ID" value={journal.odooReferenceId} />
            <Field label="Created At" value={formatDate(journal.createdAt)} />
            <Field label="Updated At" value={formatDate(journal.updatedAt)} />
          </dl>

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
      </div>
    </div>
  )
}
