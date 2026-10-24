import { AlertCircle, CheckCircle2, CloudDownload, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ProgressBar } from './ProgressBar'
import {
  apiErrorMessage,
  getJournalApiStatus,
  startJournalApiFetch,
  type JournalApiFetchPayload,
  type JournalApiRunSummary,
} from '../services/api'

interface ApiFetchModalProps {
  onClose: () => void
  // Fired once a run started from this popup finishes successfully, so the Dashboard can reload.
  onCompleted: (run: JournalApiRunSummary) => void
}

const POLL_INTERVAL_MS = 2000

const inputClass =
  'h-11 w-full rounded-lg border border-[#dfe6f4] bg-white px-3 text-sm font-semibold text-[#172452] outline-none focus:border-[#5748f5] focus:ring-2 focus:ring-[#5748f5]/15'

// YYYY-MM-DD in the browser's local time (toISOString alone would give the UTC day).
function toLocalIsoDate(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10)
}

function todayIso() {
  return toLocalIsoDate(new Date())
}

// Default start date = the day of the most recent successful fetch, automatic or manual, so the
// popup picks up where the last fetch left off. No fetch yet (or it was today) = today.
function lastFetchDate(runs: (JournalApiRunSummary | null)[]) {
  const times = runs
    .filter((candidate): candidate is JournalApiRunSummary => candidate?.status === 'SUCCESS')
    .map((candidate) => new Date(candidate.startedAt).getTime())
    .filter((time) => Number.isFinite(time))
  if (times.length === 0) {
    return todayIso()
  }
  return toLocalIsoDate(new Date(Math.max(...times)))
}

// Manual "Fetch from API" popup: the user picks exactly which journal entries to pull from the
// Journal Entries (compass-query) API. The fetch itself runs in the background on the server; this
// popup just polls /journal-api/status for progress.
export function ApiFetchModal({ onClose, onCompleted }: ApiFetchModalProps) {
  const [form, setForm] = useState({
    accountNumber: '',
    txnId: '',
    startDate: todayIso(),
    endDate: todayIso(),
    maxRecords: '',
  })
  const [run, setRun] = useState<JournalApiRunSummary | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Only report completion for a run this popup started - not an automatic run that happened to
  // be in flight when it opened.
  const startedHereRef = useRef(false)
  // Only prefill the start date from the last fetch until the user edits it themselves.
  const startDateTouchedRef = useRef(false)

  const loadStatus = useCallback(async () => {
    try {
      const status = await getJournalApiStatus()
      setRun(status.currentRun)
      setIsRunning(status.running)
      if (!startDateTouchedRef.current) {
        const startDate = lastFetchDate([status.lastAutoRun, status.lastManualRun])
        setForm((current) => ({ ...current, startDate }))
      }
      if (!status.running && startedHereRef.current && status.currentRun) {
        startedHereRef.current = false
        if (status.currentRun.status === 'SUCCESS') {
          onCompleted(status.currentRun)
        }
      }
    } catch (pollError) {
      setError(apiErrorMessage(pollError))
    }
  }, [onCompleted])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadStatus(), 0)
    return () => window.clearTimeout(timer)
  }, [loadStatus])

  // Poll only while a run is in flight.
  useEffect(() => {
    if (!isRunning) {
      return
    }
    const timer = window.setInterval(() => void loadStatus(), POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [isRunning, loadStatus])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      setError('Start date must be on or before end date.')
      return
    }
    const maxRecords = form.maxRecords.trim() ? Number(form.maxRecords) : undefined
    if (maxRecords !== undefined && (!Number.isInteger(maxRecords) || maxRecords < 1)) {
      setError('Max records must be a whole number greater than 0.')
      return
    }

    const payload: JournalApiFetchPayload = {
      accountNumber: form.accountNumber.trim() || undefined,
      txnId: form.txnId.trim() || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      maxRecords,
    }

    setIsSubmitting(true)
    try {
      const status = await startJournalApiFetch(payload)
      startedHereRef.current = true
      startDateTouchedRef.current = true
      setRun(status.currentRun)
      setIsRunning(true)
    } catch (submitError) {
      setError(apiErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const progressPercent =
    run && run.totalPages > 0 ? Math.min(Math.round((run.pagesFetched / run.totalPages) * 100), 100) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111b45]/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[#dfe6f4] bg-white shadow-[0_24px_80px_rgba(17,27,69,0.25)]">
        <header className="flex items-center justify-between gap-4 border-b border-[#dfe6f4] px-6 py-5">
          <div>
            <h2 className="text-lg font-extrabold text-[#111b45]">Fetch from API</h2>
            <p className="mt-1 text-sm font-medium text-[#617096]">
              Pull journal entries from the datalake. Leave a filter empty to skip it.
            </p>
          </div>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#dfe6f4] text-[#172452] transition hover:bg-[#f7f8ff]"
            type="button"
            onClick={onClose}
            aria-label="Close fetch from API popup"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <form className="flex-1 overflow-y-auto px-6 py-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-[#18234f]">
              Start date
              <input
                className={inputClass}
                type="date"
                value={form.startDate}
                onChange={(event) => {
                  startDateTouchedRef.current = true
                  setForm((current) => ({ ...current, startDate: event.target.value }))
                }}
                disabled={isRunning}
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#18234f]">
              End date
              <input
                className={inputClass}
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                disabled={isRunning}
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#18234f]">
              Account number
              <input
                className={inputClass}
                maxLength={64}
                placeholder="All accounts"
                value={form.accountNumber}
                onChange={(event) => setForm((current) => ({ ...current, accountNumber: event.target.value }))}
                disabled={isRunning}
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#18234f]">
              Transaction ID
              <input
                className={inputClass}
                maxLength={128}
                placeholder="All transactions"
                value={form.txnId}
                onChange={(event) => setForm((current) => ({ ...current, txnId: event.target.value }))}
                disabled={isRunning}
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#18234f] sm:col-span-2">
              Max records
              <input
                className={inputClass}
                type="number"
                min={1}
                placeholder="No limit (fetch every page)"
                value={form.maxRecords}
                onChange={(event) => setForm((current) => ({ ...current, maxRecords: event.target.value }))}
                disabled={isRunning}
              />
            </label>
          </div>
          <p className="mt-3 text-xs font-medium text-[#6b7794]">
            Start date defaults to the day of the last fetch (automatic or manual), or today if none.
            Empty dates fall back to the API defaults (last 3 months up to today). Rows already in the
            dashboard are skipped as duplicates.
          </p>

          {run ? (
            <div className="mt-5 rounded-xl border border-[#dfe6f4] bg-[#f8fbff] p-4 text-sm text-[#172452]">
              {isRunning ? (
                <>
                  <ProgressBar
                    label={run.trigger === 'AUTO' ? 'Automatic sync in progress' : 'Fetching from API'}
                    subLabel={`Page ${run.pagesFetched} of ${run.totalPages || '?'} · ${run.fetched.toLocaleString()} rows fetched · ${run.imported.toLocaleString()} imported`}
                    percent={progressPercent}
                  />
                  <p className="mt-2 text-xs font-medium text-[#6b7794]">
                    You can close this popup - the fetch keeps running on the server.
                  </p>
                </>
              ) : (
                <div className={`flex items-start gap-3 ${run.status === 'FAILED' ? 'text-red-700' : 'text-emerald-700'}`}>
                  {run.status === 'FAILED' ? (
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  )}
                  <div>
                    <p className="font-bold">
                      Last {run.trigger === 'AUTO' ? 'automatic' : 'manual'} fetch {run.status === 'FAILED' ? 'failed' : 'finished'}
                      {run.finishedAt ? ` · ${new Date(run.finishedAt).toLocaleString()}` : ''}
                    </p>
                    {run.message ? <p className="mt-1 font-medium">{run.message}</p> : null}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          ) : null}

          <div className="mt-6 flex justify-end gap-3">
            <button
              className="rounded-xl border border-[#dfe6f4] px-5 py-3 text-sm font-bold text-[#172452] transition hover:bg-[#f7f8ff]"
              type="button"
              onClick={onClose}
            >
              Close
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#7254ff] to-[#5237e9] px-5 py-3 text-sm font-extrabold text-white shadow-[0_14px_24px_rgba(88,58,235,0.25)] disabled:opacity-60"
              type="submit"
              disabled={isRunning || isSubmitting}
            >
              <CloudDownload className="h-4 w-4" aria-hidden="true" />
              {isRunning ? 'Fetching…' : 'Fetch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
