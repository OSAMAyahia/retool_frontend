import { AlertTriangle, ChevronDown, ChevronRight, X } from 'lucide-react'
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

// Unlike formatDateOnly above (used for journal_date, a literal value derived from the imported
// file that must never shift), updatedAt is a system-generated "now" timestamp with no original
// literal to preserve - showing it in the viewer's own local time (what their wall clock says
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

function formatMoney(value: number | null) {
  if (value == null) {
    return '-'
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function JournalDetailPanel({ journal, onClose }: JournalDetailPanelProps) {
  const [rawOpen, setRawOpen] = useState(false)

  const rawJson = useMemo(
    () => JSON.stringify(journal?.lines.map((line) => line.rawPayload ?? line) ?? [], null, 2),
    [journal],
  )

  if (!journal) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30" role="dialog" aria-modal="true">
      <div className="absolute inset-y-0 right-0 flex w-full max-w-5xl flex-col bg-white shadow-2xl">
        <header className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2">
                <StatusBadge status={journal.status} />
              </div>
              <h2 className="truncate text-lg font-semibold text-slate-950">{journal.transactionId}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {journal.lineCount} journal lines · Debit {formatMoney(journal.totalDebit)} · Credit {formatMoney(journal.totalCredit)}
              </p>
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
          {journal.errorMessage ? (
            <div className="mb-5 flex gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <strong className="block font-extrabold">
                  Odoo rejection details
                  {journal.rejectionReason === 'NOT_MAPPED' ? ' — Not mapped' : null}
                  {journal.rejectionReason === 'NOT_BALANCED' ? ' — Not balanced' : null}
                </strong>
                <p className="mt-1 break-words font-medium">{journal.errorMessage}</p>
              </div>
            </div>
          ) : null}

          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="txn_id" value={journal.transactionId} />
            <Field label="Journal Date" value={formatDateOnly(journal.journalDate)} />
            <Field label="Journal" value={journal.journal} />
            <Field label="Reference" value={journal.reference} />
            <Field label="Total Debit" value={formatMoney(journal.totalDebit)} />
            <Field label="Total Credit" value={formatMoney(journal.totalCredit)} />
            <Field label="Odoo Reference ID" value={journal.odooReferenceId} />
            <Field label="Updated At" value={formatDateTime(journal.updatedAt)} />
          </dl>

          <section className="mt-5 overflow-hidden rounded-lg border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="text-sm font-extrabold text-slate-900">Complete journal lines</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full text-left text-sm">
                <thead className="bg-white text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Journal Items/label</th>
                    <th className="px-4 py-3">Journal Items/Account</th>
                    <th className="px-4 py-3">Debit</th>
                    <th className="px-4 py-3">Credit</th>
                    <th className="px-4 py-3">Journal Items/Analytic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {journal.lines.length ? journal.lines.map((line) => (
                    <tr key={line.transactionId} className={line.difference ? 'bg-amber-50' : undefined}>
                      <td className="max-w-64 break-words px-4 py-3 font-medium text-slate-900">
                        {line.itemLabel ?? '-'}
                        {line.difference ? (
                          <span className="ml-2 inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                            Difference
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-800">{line.itemAccount || '-'}</td>
                      <td className="px-4 py-3 font-bold tabular-nums text-slate-900">{formatMoney(line.debit)}</td>
                      <td className="px-4 py-3 font-bold tabular-nums text-slate-900">{formatMoney(line.credit)}</td>
                      <td className="max-w-72 break-all px-4 py-3 font-mono text-xs text-slate-700">{line.analytic ?? '-'}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>Loading journal lines…</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-4 rounded-lg border border-slate-200">
            <button
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-900"
              type="button"
              onClick={() => setRawOpen((current) => !current)}
            >
              Raw JSON Payloads
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
