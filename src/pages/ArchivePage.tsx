import { ArrowLeft, ChevronLeft, ChevronRight, Download, LogOut, RefreshCw, RotateCw, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { JournalDetailPanel } from '../components/JournalDetailPanel'
import { JournalTable } from '../components/JournalTable'
import { getJournalById, getJournals } from '../services/api'
import type { Journal, PageResponse } from '../types/transaction'

const initialJournalsPage: PageResponse<Journal> = {
  content: [],
  page: 0,
  size: 50,
  totalElements: 0,
  totalPages: 0,
}

function getApiErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unknown error'
}

// Own label set (not journalColumnLabels) - the archive's most useful extra column is the Odoo
// reference id (proof the entry was actually received), which journalColumnLabels doesn't have.
const archiveColumnLabels = [
  'journal date',
  'txn_id',
  'journal_id',
  'total debit',
  'total credit',
  'lines',
  'odoo reference id',
  'sent at',
] as const

function exportArchiveCsv(journals: Journal[]) {
  const rows = journals.map((journal) => [
    journal.journalDate,
    journal.transactionId,
    journal.journal ?? '',
    journal.totalDebit,
    journal.totalCredit,
    journal.lineCount,
    journal.odooReferenceId ?? '',
    journal.updatedAt,
  ])
  const csv = [archiveColumnLabels, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'archive-export.csv'
  link.click()
  URL.revokeObjectURL(url)
}

// Read-only view over every journal entry successfully sent to Odoo (status SENT). These rows
// are never deleted from the journal_entries/journals tables - this page is just a permanently
// filtered lens onto that same storage, so it always reflects the full send history without
// duplicating any data into a second table.
export function ArchivePage() {
  const { user, logout } = useAuth()
  const [journalsPage, setJournalsPage] = useState<PageResponse<Journal>>(initialJournalsPage)
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null)
  const [page, setPage] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Individual or select-all, same pattern as the Journal Table - used to narrow the CSV export
  // to just the checked rows (an empty selection exports every row on the current page).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const loadArchive = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true)
    }
    try {
      const response = await getJournals({ internalStatus: 'SENT' }, page, 50)
      setJournalsPage(response)
      setLoadError(null)
    } catch (error) {
      setJournalsPage(initialJournalsPage)
      setLoadError(`Unable to load the archive. ${getApiErrorMessage(error)}`)
    } finally {
      setIsLoading(false)
      setLastUpdated(new Date())
    }
  }, [page])

  useEffect(() => {
    void loadArchive()
  }, [loadArchive])

  const handleSelectJournal = async (journal: Journal) => {
    try {
      const full = await getJournalById(journal.transactionId)
      setSelectedJournal(full)
    } catch {
      setSelectedJournal(journal)
    }
  }

  const handleToggleRow = (transactionId: string) => {
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

  const handleToggleAll = () => {
    setSelectedIds((current) => {
      const allSelected = journalsPage.content.every((journal) => current.has(journal.transactionId))
      if (allSelected) {
        const next = new Set(current)
        journalsPage.content.forEach((journal) => next.delete(journal.transactionId))
        return next
      }
      const next = new Set(current)
      journalsPage.content.forEach((journal) => next.add(journal.transactionId))
      return next
    })
  }

  const canGoBack = page > 0
  const canGoForward = journalsPage.totalPages > 0 && page + 1 < journalsPage.totalPages

  return (
    <main className="min-h-screen bg-[#f6f8fc] px-4 py-4 text-[#172452] sm:px-6">
      <section className="mx-auto min-h-[calc(100vh-2rem)] w-full max-w-[1840px] rounded-2xl border border-[#dfe6f4] bg-white/80 px-5 py-7 shadow-[0_18px_50px_rgba(35,48,85,0.08)] sm:px-8 lg:px-12">
        <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link className="mb-2 inline-flex items-center gap-2 text-sm font-bold text-[#493ee8]" to="/journal">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Journal Table
            </Link>
            <h1 className="text-3xl font-extrabold tracking-normal text-[#111b45] lg:text-[34px]">Archive</h1>
            <p className="mt-2 text-base font-medium text-[#617096]">
              Every journal entry successfully sent to Odoo ({journalsPage.totalElements} total)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-14 min-w-[212px] items-center gap-3 rounded-xl border border-[#dfe6f4] bg-white/80 px-5 shadow-[0_8px_22px_rgba(52,68,110,0.04)]">
              <RotateCw className="h-5 w-5 text-[#5748f5]" aria-hidden="true" />
              <span>
                <span className="block text-xs font-semibold text-[#617096]">Last updated</span>
                <strong className="block text-sm font-bold text-[#2d3866]">
                  {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Loading data'}
                </strong>
              </span>
            </div>
            <button
              className="inline-flex h-14 items-center justify-center gap-3 rounded-xl border border-[#dfe6f4] bg-white/80 px-5 text-sm font-bold text-[#172452] shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5 disabled:opacity-60"
              type="button"
              onClick={() => exportArchiveCsv(
                selectedIds.size > 0
                  ? journalsPage.content.filter((journal) => selectedIds.has(journal.transactionId))
                  : journalsPage.content,
              )}
              disabled={journalsPage.content.length === 0}
            >
              <Download className="h-5 w-5" aria-hidden="true" />
              {selectedIds.size > 0 ? `Export Selected (${selectedIds.size})` : 'Export CSV'}
            </button>
            <button
              className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-[#dfe6f4] bg-white/80 text-[#5748f5] shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5 disabled:opacity-60"
              type="button"
              onClick={() => void loadArchive()}
              disabled={isLoading}
              aria-label="Refresh archive"
            >
              <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
            {user?.role === 'ADMIN' ? (
              <Link
                className="inline-flex h-14 items-center justify-center gap-3 rounded-xl border border-[#dfe6f4] bg-white/80 px-5 text-sm font-bold text-[#172452] shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5"
                to="/admin"
              >
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                Admin
              </Link>
            ) : null}
            <button
              className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-[#dfe6f4] bg-white/80 text-[#172452] shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5"
              type="button"
              onClick={logout}
              aria-label="Logout"
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        {loadError ? (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {loadError}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-[#dfe6f4]">
          <JournalTable
            journals={journalsPage.content}
            isLoading={isLoading}
            onSelect={(journal) => void handleSelectJournal(journal)}
            selectedIds={selectedIds}
            onToggleRow={handleToggleRow}
            onToggleAll={handleToggleAll}
          />
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm font-medium text-[#617096]">
            Page {journalsPage.totalPages === 0 ? 0 : page + 1} of {journalsPage.totalPages}
          </span>
          <div className="flex items-center gap-3">
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#dfe6f4] bg-white/80 text-[#172452] transition hover:-translate-y-0.5 disabled:opacity-40"
              type="button"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={!canGoBack}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#dfe6f4] bg-white/80 text-[#172452] transition hover:-translate-y-0.5 disabled:opacity-40"
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={!canGoForward}
              aria-label="Next page"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      <JournalDetailPanel journal={selectedJournal} onClose={() => setSelectedJournal(null)} />
    </main>
  )
}
