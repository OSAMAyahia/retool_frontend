import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  LogOut,
  RefreshCw,
  RotateCw,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { FilterBar } from '../components/FilterBar'
import { JournalDetailPanel } from '../components/JournalDetailPanel'
import { JournalTable } from '../components/JournalTable'
import { SummaryCards, type SummaryCardSubFilter } from '../components/SummaryCards'
import { getJournalById, getJournals, sendJournalsToOdoo } from '../services/api'
import type { Journal, PageResponse, TransactionFilters, TransactionStatus, TransactionSummary } from '../types/transaction'
import { displayDate, journalColumnLabels } from '../utils/tableFields'

const initialJournalsPage: PageResponse<Journal> = {
  content: [],
  page: 0,
  size: 50,
  totalElements: 0,
  totalPages: 0,
}

const journalStatuses: TransactionStatus[] = [
  {
    code: 'NEW',
    label: 'New',
    description: null,
    color: '#0ea5e9',
    sortOrder: 10,
    systemStatus: true,
    editable: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    code: 'PENDING',
    label: 'Pending',
    description: null,
    color: '#f59e0b',
    sortOrder: 20,
    systemStatus: true,
    editable: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    code: 'PROCESSING',
    label: 'Processing',
    description: null,
    color: '#2563eb',
    sortOrder: 30,
    systemStatus: true,
    editable: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    code: 'SENT',
    label: 'Sent',
    description: null,
    color: '#059669',
    sortOrder: 40,
    systemStatus: true,
    editable: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    code: 'REJECTED',
    label: 'Rejected',
    description: null,
    color: '#dc2626',
    sortOrder: 50,
    systemStatus: true,
    editable: false,
    createdAt: '',
    updatedAt: '',
  },
]

const odooSendableStatuses = new Set(['NEW', 'REJECTED'])

// total/sent are counted independently of whatever filters the user currently has applied on
// the table (via dedicated size=1 requests, reading only totalElements) - summary cards should
// always reflect the true overall numbers, not just whatever page/filter happens to be loaded.
function buildJournalSummary(total: number, sent: number): TransactionSummary {
  const unCompleted = Math.max(total - sent, 0)

  return {
    total,
    completed: sent,
    unCompleted,
    journalRows: total,
  }
}

function getApiErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unknown error'
}

type ExportFormat = 'excel' | 'csv'

function exportJournalsFile(journals: Journal[], format: ExportFormat) {
  const rows = journals.map((journal) => [
    displayDate(journal.journalDate),
    journal.transactionId,
    journal.journal ?? '',
    journal.totalDebit,
    journal.totalCredit,
    journal.lineCount,
    journal.createdAt,
    journal.status,
  ])
  const csv = [journalColumnLabels, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const isExcel = format === 'excel'
  const url = URL.createObjectURL(new Blob([csv], {
    type: isExcel ? 'application/vnd.ms-excel;charset=utf-8' : 'text/csv;charset=utf-8',
  }))
  const link = document.createElement('a')
  link.href = url
  link.download = isExcel ? 'journal-export.xls' : 'journal-export.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export function JournalPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [filters, setFilters] = useState<TransactionFilters>({})
  const [journalsPage, setJournalsPage] = useState<PageResponse<Journal>>(initialJournalsPage)
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null)
  const [page, setPage] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [statusCounts, setStatusCounts] = useState({ total: 0, sent: 0 })

  const summary = useMemo(
    () => buildJournalSummary(statusCounts.total, statusCounts.sent),
    [statusCounts],
  )
  const sendableJournalCount = useMemo(
    () => journalsPage.content.filter((journal) => odooSendableStatuses.has(journal.status)).length,
    [journalsPage.content],
  )
  const selectedSendableIds = useMemo(
    () =>
      journalsPage.content
        .filter((journal) => selectedIds.has(journal.transactionId) && odooSendableStatuses.has(journal.status))
        .map((journal) => journal.transactionId),
    [journalsPage.content, selectedIds],
  )

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

  const journalOptions = useMemo(
    () => Array.from(new Set(journalsPage.content.map((journal) => journal.journal).filter(Boolean))) as string[],
    [journalsPage.content],
  )

  const loadJournals = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setIsLoading(true)
      }

      try {
        const response = await getJournals(filters, page, 50)
        setJournalsPage(response)
        setActionError(null)
      } catch (error) {
        setJournalsPage(initialJournalsPage)
        setActionError(`Unable to load journals. ${getApiErrorMessage(error)}`)
      } finally {
        setIsLoading(false)
        setLastUpdated(new Date())
      }
    },
    [filters, page],
  )

  // Independent of `filters`/`page` on purpose - the summary cards should always show the true
  // overall counts, not whatever subset the table happens to be filtered/paginated to.
  const loadStatusCounts = useCallback(async () => {
    try {
      const [totalResponse, sentResponse] = await Promise.all([
        getJournals({}, 0, 1),
        getJournals({ internalStatus: 'SENT' }, 0, 1),
      ])
      setStatusCounts({ total: totalResponse.totalElements, sent: sentResponse.totalElements })
    } catch {
      setStatusCounts({ total: 0, sent: 0 })
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadJournals()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadJournals])

  useEffect(() => {
    void loadStatusCounts()
  }, [loadStatusCounts])

  const handleFiltersChange = (nextFilters: TransactionFilters) => {
    setFilters(nextFilters)
    setPage(0)
  }

  const handleResetFilters = () => {
    setFilters({})
    setPage(0)
  }

  // Clicking a summary card filters the table below to that bucket. "Not completed" has no
  // single backend status - "NOT_SENT" is a synthetic value meaning "status != SENT".
  const handleSummaryCardClick = (key: 'total' | 'completed' | 'unCompleted' | 'journalRows') => {
    if (key === 'completed') {
      handleFiltersChange({ ...filters, internalStatus: 'SENT', rejectionReason: undefined })
      return
    }
    if (key === 'unCompleted') {
      handleFiltersChange({ ...filters, internalStatus: 'NOT_SENT', rejectionReason: undefined })
      return
    }
    handleFiltersChange({ ...filters, internalStatus: '', rejectionReason: undefined })
  }

  const activeSummaryCard = useMemo(() => {
    if (filters.internalStatus === 'SENT') {
      return 'completed' as const
    }
    if (filters.internalStatus === 'NOT_SENT' || filters.rejectionReason) {
      return 'unCompleted' as const
    }
    return null
  }, [filters])

  const notCompletedSubFilters = useMemo<SummaryCardSubFilter[]>(() => {
    const toggle = (reason: string) => {
      handleFiltersChange({
        ...filters,
        internalStatus: 'NOT_SENT',
        rejectionReason: filters.rejectionReason === reason ? undefined : reason,
      })
    }

    return [
      { key: 'NOT_MAPPED', label: 'Not mapped', active: filters.rejectionReason === 'NOT_MAPPED', onClick: () => toggle('NOT_MAPPED') },
      { key: 'NOT_BALANCED', label: 'Not balanced', active: filters.rejectionReason === 'NOT_BALANCED', onClick: () => toggle('NOT_BALANCED') },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  const handleSelectJournal = async (journal: Journal) => {
    setSelectedJournal(journal)
    try {
      setSelectedJournal(await getJournalById(journal.transactionId))
    } catch {
      setSelectedJournal(journal)
    }
  }

  const handleSendToOdoo = async () => {
    // Empty selection = no rows checked, keep the old "send everything eligible" behavior.
    const transactionIds = selectedSendableIds.length > 0 ? selectedSendableIds : undefined
    const targetIds = transactionIds ? new Set(transactionIds) : null

    setIsActionLoading(true)
    setActionMessage(null)
    setActionError(null)
    setJournalsPage((current) => ({
      ...current,
      content: current.content.map((journal) => (
        odooSendableStatuses.has(journal.status) && (targetIds === null || targetIds.has(journal.transactionId))
          ? { ...journal, status: 'PROCESSING', errorMessage: null }
          : journal
      )),
    }))

    try {
      setActionMessage(
        transactionIds
          ? `Sending ${transactionIds.length} selected journal entries to Odoo…`
          : 'Sending journal entries to Odoo…',
      )
      const result = await sendJournalsToOdoo((status) => {
        if (status === 'RUNNING') {
          setActionMessage('Still sending journal entries to Odoo…')
        }
      }, transactionIds)
      setActionMessage(
        `Sent ${result.processed} journal entries to Odoo. Rejected entries include the exact error and can be retried.`,
      )
      setSelectedIds(new Set())
      await loadJournals(false)
      await loadStatusCounts()
    } catch (error) {
      await loadJournals(false)
      await loadStatusCounts()
      setActionError(`Odoo update failed. ${getApiErrorMessage(error)}`)
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="min-h-screen bg-[#f6f8fc] px-4 py-4 text-[#172452] sm:px-6">
      <section className="mx-auto min-h-[calc(100vh-2rem)] w-full max-w-[1840px] rounded-2xl border border-[#dfe6f4] bg-white/80 px-5 py-7 shadow-[0_18px_50px_rgba(35,48,85,0.08)] sm:px-8 lg:px-12">
        <header className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-normal text-[#111b45] lg:text-[32px]">
              Journal Table
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-[#617096]">
              One balanced record per txn_id. Click any record to inspect every debit and credit line.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 xl:flex-nowrap">
            <div className="flex h-11 min-w-[168px] items-center gap-2 rounded-lg border border-[#dfe6f4] bg-white/80 px-3 shadow-[0_8px_22px_rgba(52,68,110,0.04)]">
              <RotateCw className="h-4 w-4 text-[#5748f5]" aria-hidden="true" />
              <span>
                <span className="block text-xs font-semibold text-[#617096]">Last updated</span>
                <strong className="block whitespace-nowrap text-xs font-bold text-[#2d3866]">
                  {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Loading data'}
                </strong>
              </span>
            </div>
            <Link
              className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#dfe6f4] bg-white/80 px-4 text-xs font-bold text-[#172452] shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5"
              to="/"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Dashboard
            </Link>
            <div className="relative">
              <button
                className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#dfe6f4] bg-white/80 px-4 text-xs font-bold text-[#493ee8] shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5"
                type="button"
                onClick={() => setIsExportMenuOpen((current) => !current)}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Export File
              </button>
              {isExportMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-48 overflow-hidden rounded-xl border border-[#dfe6f4] bg-white shadow-[0_18px_40px_rgba(31,48,96,0.14)]">
                  <button
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-[#172452] transition hover:bg-[#f8fbff]"
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false)
                      exportJournalsFile(journalsPage.content, 'excel')
                    }}
                  >
                    <FileSpreadsheet className="h-4 w-4 text-[#493ee8]" aria-hidden="true" />
                    Excel file
                  </button>
                  <button
                    className="flex w-full items-center gap-3 border-t border-[#edf1f8] px-4 py-3 text-left text-sm font-bold text-[#172452] transition hover:bg-[#f8fbff]"
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false)
                      exportJournalsFile(journalsPage.content, 'csv')
                    }}
                  >
                    <Download className="h-4 w-4 text-[#493ee8]" aria-hidden="true" />
                    CSV file
                  </button>
                </div>
              ) : null}
            </div>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-gradient-to-br from-[#7254ff] to-[#5237e9] px-4 text-xs font-extrabold text-white shadow-[0_14px_24px_rgba(88,58,235,0.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={() => void handleSendToOdoo()}
              disabled={isActionLoading}
              title={
                selectedSendableIds.length > 0
                  ? `Send ${selectedSendableIds.length} selected journal entries to Odoo`
                  : sendableJournalCount > 0
                    ? `${sendableJournalCount} visible new or rejected journal entries can be sent to Odoo`
                    : 'Send all eligible journal entries'
              }
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {selectedSendableIds.length > 0 ? `Send Selected (${selectedSendableIds.length})` : 'Send to Odoo'}
            </button>
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#dfe6f4] bg-white/80 text-[#5748f5] shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5 disabled:opacity-60"
              type="button"
              onClick={() => {
                void loadJournals()
                void loadStatusCounts()
              }}
              disabled={isLoading}
              aria-label="Refresh journals"
            >
              <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
            {user?.role === 'ADMIN' ? (
              <Link
                className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#dfe6f4] bg-white/80 px-3 text-xs font-bold text-[#172452] shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5"
                to="/admin"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Admin
              </Link>
            ) : null}
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#dfe6f4] bg-white/80 text-[#172452] shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5"
              type="button"
              onClick={handleLogout}
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <SummaryCards
          summary={summary}
          onCardClick={handleSummaryCardClick}
          activeCard={activeSummaryCard}
          subFilters={{ unCompleted: notCompletedSubFilters }}
        />

        {actionMessage ? (
          <div className="rounded-2xl border border-[#bfead9] bg-[#ecfdf5] px-5 py-4 text-sm font-bold text-[#047857]">
            {actionMessage}
          </div>
        ) : null}
        {actionError ? (
          <div className="rounded-2xl border border-[#ffb8c2] bg-[#fff1f2] px-5 py-4 text-sm font-bold text-[#dc2626]">
            {actionError}
          </div>
        ) : null}

        <div className="mt-6">
          <FilterBar
            filters={filters}
            statuses={journalStatuses}
            sources={journalOptions}
            sourceLabel="Journal"
            accountLabel="Journal Items/Account"
            accountPlaceholder="Search journal account..."
            isLoading={isLoading}
            onFiltersChange={handleFiltersChange}
            onRefresh={() => {
              void loadJournals()
              void loadStatusCounts()
            }}
            onReset={handleResetFilters}
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-[#dfe6f4] bg-white/80 shadow-[0_12px_30px_rgba(31,48,96,0.06)]">
          <JournalTable
            journals={journalsPage.content}
            isLoading={isLoading}
            onSelect={handleSelectJournal}
            selectedIds={selectedIds}
            onToggleRow={handleToggleRow}
            onToggleAll={handleToggleAll}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#dfe6f4] px-6 py-4 text-sm font-medium text-[#657295]">
            <span>
              Showing {journalsPage.content.length} of {journalsPage.totalElements} journal entries
            </span>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#dfe6f4] bg-white px-3 font-bold text-[#172452] disabled:opacity-40"
                type="button"
                disabled={page === 0 || isLoading}
                onClick={() => setPage((current) => Math.max(current - 1, 0))}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Previous
              </button>
              <span className="px-2 font-bold">
                Page {page + 1} of {Math.max(journalsPage.totalPages, 1)}
              </span>
              <button
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#dfe6f4] bg-white px-3 font-bold text-[#172452] disabled:opacity-40"
                type="button"
                disabled={page + 1 >= journalsPage.totalPages || isLoading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </section>
      <JournalDetailPanel journal={selectedJournal} onClose={() => setSelectedJournal(null)} />
    </main>
  )
}



