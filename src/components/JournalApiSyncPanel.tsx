import { AlertCircle, CheckCircle2, CloudDownload, Play, Save } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  apiErrorMessage,
  getJournalApiStatus,
  runJournalApiAutoNow,
  updateJournalApiConfig,
  type JournalApiRunSummary,
  type JournalApiStatus,
} from '../services/api'

const inputClass =
  'h-11 rounded-lg border border-[#dfe6f4] bg-white px-3 text-sm font-semibold text-[#172452] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15'

const buttonClass =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-extrabold transition disabled:opacity-60'

const POLL_INTERVAL_MS = 5000

// ISO instant -> value for <input type="datetime-local"> in the browser's local time.
function toLocalInputValue(iso: string | null) {
  if (!iso) {
    return ''
  }
  const date = new Date(iso)
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function formatDateTime(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString() : '—'
}

function RunLine({ title, run }: { title: string; run: JournalApiRunSummary | null }) {
  if (!run) {
    return (
      <div className="rounded-lg border border-[#edf1f8] p-3 text-sm">
        <p className="font-bold text-[#18234f]">{title}</p>
        <p className="mt-1 text-[#6b7794]">Never ran.</p>
      </div>
    )
  }
  const failed = run.status === 'FAILED'
  return (
    <div className="rounded-lg border border-[#edf1f8] p-3 text-sm">
      <p className="flex items-center gap-2 font-bold text-[#18234f]">
        {failed ? (
          <AlertCircle className="h-4 w-4 text-red-600" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        )}
        {title} · {run.status}
      </p>
      <p className="mt-1 text-[#6b7794]">
        {formatDateTime(run.startedAt)}
        {run.startDate ? ` · range ${run.startDate} → ${run.endDate ?? 'today'}` : ''}
        {run.triggeredBy ? ` · by ${run.triggeredBy}` : ''}
      </p>
      {run.message ? <p className={`mt-1 font-medium ${failed ? 'text-red-700' : 'text-[#18234f]'}`}>{run.message}</p> : null}
    </div>
  )
}

// Admin-only settings for the automatic Journal Entries API sync: on/off, interval in minutes and
// the watermark ("sync from") the next automatic run continues from.
export function JournalApiSyncPanel() {
  const [status, setStatus] = useState<JournalApiStatus | null>(null)
  const [draft, setDraft] = useState({ autoSyncEnabled: false, intervalMinutes: 60, syncFrom: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const applyStatus = useCallback((next: JournalApiStatus, resetDraft: boolean) => {
    setStatus(next)
    if (resetDraft) {
      setDraft({
        autoSyncEnabled: next.autoSyncEnabled,
        intervalMinutes: next.intervalMinutes,
        syncFrom: toLocalInputValue(next.lastSyncedAt),
      })
    }
  }, [])

  const refresh = useCallback(
    async (resetDraft: boolean) => {
      try {
        applyStatus(await getJournalApiStatus(), resetDraft)
      } catch (loadError) {
        setError(apiErrorMessage(loadError))
      }
    },
    [applyStatus],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(true), 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  const running = status?.running ?? false

  // Poll only while a run is in flight, without touching the admin's unsaved draft.
  useEffect(() => {
    if (!running) {
      return
    }
    const timer = window.setInterval(() => void refresh(false), POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [running, refresh])

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setMessage(null)

    const storedSyncFrom = toLocalInputValue(status?.lastSyncedAt ?? null)
    try {
      const next = await updateJournalApiConfig({
        autoSyncEnabled: draft.autoSyncEnabled,
        intervalMinutes: draft.intervalMinutes,
        // Only send the watermark when the admin actually changed it.
        syncFrom: draft.syncFrom && draft.syncFrom !== storedSyncFrom ? new Date(draft.syncFrom).toISOString() : undefined,
      })
      applyStatus(next, true)
      setMessage(next.autoSyncEnabled ? 'Auto sync saved and enabled.' : 'Auto sync saved and stopped.')
    } catch (saveError) {
      setError(apiErrorMessage(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  const handleRunNow = async () => {
    setError(null)
    setMessage(null)
    try {
      const next = await runJournalApiAutoNow()
      applyStatus(next, false)
      setMessage('Sync started.')
    } catch (runError) {
      setError(apiErrorMessage(runError))
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-[#dfe6f4] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dfe6f4] px-5 py-4">
        <div className="flex items-center gap-3">
          <CloudDownload className="h-5 w-5 text-[#2563eb]" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-extrabold text-[#111b45]">Journal API Sync</h2>
            <p className="text-xs font-medium text-[#6b7794]">Fetching transactions from the Journal Entries API (incoming)</p>
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-extrabold ${
            running
              ? 'bg-blue-50 text-blue-700'
              : status?.autoSyncEnabled
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-100 text-slate-600'
          }`}
        >
          {running ? 'Running…' : status?.autoSyncEnabled ? 'Auto sync ON' : 'Auto sync OFF'}
        </span>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <form className="grid content-start gap-5" onSubmit={handleSave}>
          <label className="flex items-center gap-3 text-sm font-bold text-[#18234f]">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={draft.autoSyncEnabled}
              onChange={(event) => setDraft((current) => ({ ...current, autoSyncEnabled: event.target.checked }))}
            />
            Fetch new data automatically
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#18234f]">
            Every (minutes)
            <input
              className={inputClass}
              type="number"
              min={1}
              max={10080}
              value={draft.intervalMinutes}
              onChange={(event) => setDraft((current) => ({ ...current, intervalMinutes: Number(event.target.value) }))}
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#18234f]">
            Continue from (last synced)
            <input
              className={inputClass}
              type="datetime-local"
              value={draft.syncFrom}
              onChange={(event) => setDraft((current) => ({ ...current, syncFrom: event.target.value }))}
            />
            <span className="text-xs font-normal text-[#6b7794]">
              Updated automatically after each run to the newest created_at imported. Move it back to
              re-sync older data. Empty = the first run starts from today.
            </span>
          </label>

          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
              {message}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button className={`${buttonClass} bg-[#2563eb] text-white hover:bg-[#1d4ed8]`} type="submit" disabled={isSaving}>
              <Save className="h-5 w-5" aria-hidden="true" />
              Save Sync Config
            </button>
            <button
              className={`${buttonClass} border border-[#dfe6f4] text-[#2563eb] hover:bg-[#f8fbff]`}
              type="button"
              onClick={() => void handleRunNow()}
              disabled={running}
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              Run now
            </button>
          </div>
        </form>

        <div className="grid content-start gap-3">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-[#f8fbff] p-3">
              <dt className="text-xs font-semibold text-[#617096]">Last synced up to</dt>
              <dd className="mt-1 font-bold text-[#18234f]">{formatDateTime(status?.lastSyncedAt)}</dd>
            </div>
            <div className="rounded-lg bg-[#f8fbff] p-3">
              <dt className="text-xs font-semibold text-[#617096]">Next automatic run</dt>
              <dd className="mt-1 font-bold text-[#18234f]">
                {status?.autoSyncEnabled ? formatDateTime(status.nextAutoRunAt) : 'Stopped'}
              </dd>
            </div>
          </dl>
          {running && status?.currentRun ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm font-medium text-blue-800">
              {status.currentRun.trigger === 'AUTO' ? 'Automatic' : 'Manual'} fetch running · page{' '}
              {status.currentRun.pagesFetched} of {status.currentRun.totalPages || '?'} ·{' '}
              {status.currentRun.fetched.toLocaleString()} rows fetched
            </div>
          ) : null}
          <RunLine title="Last automatic run" run={status?.lastAutoRun ?? null} />
          <RunLine title="Last manual fetch" run={status?.lastManualRun ?? null} />
        </div>
      </div>
    </section>
  )
}
