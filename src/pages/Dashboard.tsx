import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  ListChecks,
  LogOut,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ExcelImportModal } from '../components/ExcelImportModal'
import { FilterBar } from '../components/FilterBar'
import { ProgressBar } from '../components/ProgressBar'
import { SummaryCards } from '../components/SummaryCards'
import { TransactionDetailPanel } from '../components/TransactionDetailPanel'
import { TransactionTable } from '../components/TransactionTable'
import {
  getJournals,
  getSources,
  getTransactionById,
  getTransactionGroups,
  getTransactions,
  importTransactionsFile,
  ingestTransactions,
  processJournals,
  retryTransaction,
  type TransactionGroupSummary,
} from '../services/api'
import { getMockTransactions } from '../services/mockData'
import { parseExcelToTransactions } from '../utils/xlsxImport'
import {
  dashboardColumnLabels,
  displayDate,
  transactionCrDr,
  transactionDate,
  transactionJournalId,
} from '../utils/tableFields'
import type {
  Journal,
  PageResponse,
  Transaction,
  TransactionFilters,
  TransactionSummary,
  TransactionStatus,
  IngestTransactionPayload,
} from '../types/transaction'

const initialTransactionsPage: PageResponse<Transaction> = {
  content: [],
  page: 0,
  size: 10,
  totalElements: 0,
  totalPages: 0,
}

const initialGroupsPage: PageResponse<TransactionGroupSummary> = {
  content: [],
  page: 0,
  size: 10,
  totalElements: 0,
  totalPages: 0,
}

const dashboardStatuses: TransactionStatus[] = [
  {
    code: 'un-completed',
    label: 'Not completed',
    description: null,
    color: '#f59e0b',
    sortOrder: 10,
    systemStatus: true,
    editable: false,
    createdAt: '',
    updatedAt: '',
  },
  {
    code: 'completed',
    label: 'Completed',
    description: null,
    color: '#059669',
    sortOrder: 20,
    systemStatus: true,
    editable: false,
    createdAt: '',
    updatedAt: '',
  },
]

const fallbackSources = ['Excel', 'Retool', 'Bank API', 'Partner Portal']
const LARGE_FILE_THRESHOLD_BYTES = 8 * 1024 * 1024

function getApiErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unknown error'
}

// completed/unCompleted are counted independently of whatever filters the user currently has
// applied on the table (via dedicated size=1 requests, reading only totalElements) - summary
// cards should always reflect the true overall numbers, not just whatever page/filter happens
// to be loaded (the Dashboard defaults to filtering to "un-completed" only, so building this
// from the loaded page would always show 0 completed).
function buildSummary(completed: number, unCompleted: number, journalRows: number): TransactionSummary {
  return {
    total: completed + unCompleted,
    completed,
    unCompleted,
    journalRows,
  }
}

type ExportFormat = 'excel' | 'csv'

function exportTransactionsFile(transactions: Transaction[], format: ExportFormat) {
  const headers = dashboardColumnLabels
  const rows = transactions.map((transaction) => [
    displayDate(transactionDate(transaction)),
    transaction.transactionId,
    transactionJournalId(transaction),
    transaction.accountId,
    transaction.amount,
    transactionCrDr(transaction),
    displayDate(transaction.valueDate),
    transaction.createdAt,
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const isExcel = format === 'excel'
  const url = URL.createObjectURL(new Blob([csv], {
    type: isExcel ? 'application/vnd.ms-excel;charset=utf-8' : 'text/csv;charset=utf-8',
  }))
  const link = document.createElement('a')
  link.href = url
  link.download = isExcel ? 'transactions-dashboard-export.xls' : 'transactions-dashboard-export.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const excelInputRef = useRef<HTMLInputElement | null>(null)
  const csvInputRef = useRef<HTMLInputElement | null>(null)
  const [filters, setFilters] = useState<TransactionFilters>({ internalStatus: 'un-completed' })
  const [transactionsPage, setTransactionsPage] = useState<PageResponse<Transaction>>(initialTransactionsPage)
  const [groupsPage, setGroupsPage] = useState<PageResponse<TransactionGroupSummary>>(initialGroupsPage)
  const [isGroupsLoading, setIsGroupsLoading] = useState(true)
  const [journalRows, setJournalRows] = useState(0)
  const [sources, setSources] = useState<string[]>(fallbackSources)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<TransactionGroupSummary | null>(null)
  const [groupMembers, setGroupMembers] = useState<Transaction[]>([])
  const [isLoadingGroupMembers, setIsLoadingGroupMembers] = useState(false)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryMessage, setRetryMessage] = useState<string | null>(null)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [importRows, setImportRows] = useState<IngestTransactionPayload[]>([])
  const [isImportPopupOpen, setIsImportPopupOpen] = useState(false)
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false)
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)
  const [statusCounts, setStatusCounts] = useState({ completed: 0, unCompleted: 0 })
  const [reasonCounts, setReasonCounts] = useState({ notMapped: 0, notBalanced: 0 })
  const [uploadProgress, setUploadProgress] = useState<{ label: string; subLabel?: string; percent: number | null } | null>(null)

  const loadTransactions = useCallback(
    async (showLoading = true, overrideFilters?: TransactionFilters, overridePage?: number) => {
      if (showLoading) {
        setIsLoading(true)
      }

      try {
        const response = await getTransactions(overrideFilters ?? filters, overridePage ?? page, size)
        setTransactionsPage(response)
        setError(null)
      } catch (apiError) {
        setTransactionsPage(getMockTransactions(overrideFilters ?? filters, overridePage ?? page, size))
        setError(getApiErrorMessage(apiError))
      } finally {
        setIsLoading(false)
        setLastUpdated(new Date())
      }
    },
    [filters, page, size],
  )

  // Grouped by value_date + account_id + type across the WHOLE filtered dataset in the
  // database (see /transactions/grouped) - this is what the Dashboard table actually renders.
  // Kept separate from loadTransactions above (which just backs the raw-row detail panel now)
  // since grouping only makes sense evaluated over everything matching the filters, not
  // whatever single page loadTransactions happens to have fetched.
  const loadTransactionGroups = useCallback(
    async (showLoading = true, overrideFilters?: TransactionFilters, overridePage?: number) => {
      if (showLoading) {
        setIsGroupsLoading(true)
      }

      try {
        const response = await getTransactionGroups(overrideFilters ?? filters, overridePage ?? page, size)
        setGroupsPage(response)
      } catch {
        setGroupsPage(initialGroupsPage)
      } finally {
        setIsGroupsLoading(false)
      }
    },
    [filters, page, size],
  )

  const loadJournalCount = useCallback(async () => {
    try {
      const response: PageResponse<Journal> = await getJournals({}, 0, 1)
      setJournalRows(response.totalElements)
    } catch {
      setJournalRows(0)
    }
  }, [])

  // Independent of `filters`/`page` on purpose - the summary cards should always show the true
  // overall completed/not-completed counts, not whatever subset the table happens to be
  // filtered/paginated to (the Dashboard defaults to filtering to "un-completed" only).
  // "Not mapped"/"Not balanced" are reasons a transaction never became a balanced Journal Table
  // entry - Journal Processing now checks and records both at the transaction level (lastError),
  // so these are transaction-table counts, not Journal-level ones.
  const loadTransactionStatusCounts = useCallback(async () => {
    try {
      const [completedResponse, unCompletedResponse, notMappedResponse, notBalancedResponse] = await Promise.all([
        getTransactions({ internalStatus: 'completed' }, 0, 1),
        getTransactions({ internalStatus: 'un-completed' }, 0, 1),
        getTransactions({ internalStatus: 'un-completed', rejectionReason: 'NOT_MAPPED' }, 0, 1),
        getTransactions({ internalStatus: 'un-completed', rejectionReason: 'NOT_BALANCED' }, 0, 1),
      ])
      setStatusCounts({
        completed: completedResponse.totalElements,
        unCompleted: unCompletedResponse.totalElements,
      })
      setReasonCounts({ notMapped: notMappedResponse.totalElements, notBalanced: notBalancedResponse.totalElements })
    } catch {
      setStatusCounts({ completed: 0, unCompleted: 0 })
      setReasonCounts({ notMapped: 0, notBalanced: 0 })
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTransactions()
      void loadTransactionGroups()
      void loadTransactionStatusCounts()
      void loadJournalCount()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadJournalCount, loadTransactionGroups, loadTransactionStatusCounts, loadTransactions])

  useEffect(() => {
    if (!autoRefresh) {
      return
    }

    const timer = window.setInterval(() => {
      void loadTransactions(false)
      void loadTransactionGroups(false)
      void loadTransactionStatusCounts()
    }, 15000)

    return () => window.clearInterval(timer)
  }, [autoRefresh, loadTransactionGroups, loadTransactionStatusCounts, loadTransactions])

  useEffect(() => {
    async function loadMetadata() {
      try {
        const nextSources = await getSources()
        setSources(nextSources.length ? nextSources : fallbackSources)
      } catch {
        setSources(fallbackSources)
      }
    }

    void loadMetadata()
  }, [])

  const summary = useMemo(
    () => buildSummary(statusCounts.completed, statusCounts.unCompleted, journalRows),
    [journalRows, statusCounts],
  )
  const canGoBack = page > 0
  const canGoForward = groupsPage.totalPages > 0 && page + 1 < groupsPage.totalPages

  const handleFiltersChange = (nextFilters: TransactionFilters) => {
    setFilters(nextFilters)
    setPage(0)
  }

  const handleResetFilters = () => {
    setFilters({})
    setPage(0)
  }

  // Clicking a summary card filters the table below to that bucket. "Journal Rows" isn't a
  // Transaction-table filter - it points at the Journal Table page instead.
  const handleSummaryCardClick = (key: 'total' | 'completed' | 'unCompleted' | 'journalRows') => {
    if (key === 'journalRows') {
      navigate('/journal')
      return
    }
    if (key === 'completed') {
      handleFiltersChange({ ...filters, internalStatus: 'completed', rejectionReason: undefined })
      return
    }
    if (key === 'unCompleted') {
      handleFiltersChange({ ...filters, internalStatus: 'un-completed', rejectionReason: undefined })
      return
    }
    handleFiltersChange({ ...filters, internalStatus: '', rejectionReason: undefined })
  }

  // "Not mapped" / "Not balanced" are reasons a transaction never became a balanced Journal
  // Table entry - Journal Processing checks and records both directly on the transaction
  // (lastError), so these filter the Transactions table itself rather than handing off to the
  // Journal Table page.
  const notCompletedSubFilters = useMemo(() => {
    const toggle = (reason: string) => {
      handleFiltersChange({
        ...filters,
        internalStatus: 'un-completed',
        rejectionReason: filters.rejectionReason === reason ? undefined : reason,
      })
    }

    return [
      {
        key: 'NOT_MAPPED',
        label: `Not mapped (${reasonCounts.notMapped})`,
        active: filters.rejectionReason === 'NOT_MAPPED',
        onClick: () => toggle('NOT_MAPPED'),
      },
      {
        key: 'NOT_BALANCED',
        label: `Not balanced (${reasonCounts.notBalanced})`,
        active: filters.rejectionReason === 'NOT_BALANCED',
        onClick: () => toggle('NOT_BALANCED'),
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, reasonCounts])

  const activeSummaryCard = useMemo(() => {
    if (filters.internalStatus === 'completed') {
      return 'completed' as const
    }
    if (filters.internalStatus === 'un-completed') {
      return 'unCompleted' as const
    }
    return null
  }, [filters])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleSelectTransaction = async (transaction: Transaction) => {
    setSelectedGroup(null)
    setSelectedTransaction(transaction)
    setRetryMessage(null)
    setRetryError(null)

    try {
      const latest = await getTransactionById(transaction.transactionId)
      setSelectedTransaction(latest)
    } catch {
      setSelectedTransaction(transaction)
    }
  }

  const handleSelectGroup = async (group: TransactionGroupSummary) => {
    setSelectedTransaction(null)
    setSelectedGroup(group)
    setGroupMembers([])
    setIsLoadingGroupMembers(true)

    try {
      const response = await getTransactions(
        {
          ...filters,
          accountId: group.accountId,
          dateFrom: group.valueDate ? group.valueDate.slice(0, 10) : undefined,
          dateTo: group.valueDate ? group.valueDate.slice(0, 10) : undefined,
        },
        0,
        200,
      )
      // The accountId filter above is a partial (LIKE) match on the backend, so narrow to an
      // exact account + Debit/Credit match here to guarantee only this group's real members
      // are shown, even if another account number happens to contain this one as a substring.
      const members = response.content.filter(
        (item) => item.accountId === group.accountId && (transactionCrDr(item) ?? '') === group.type,
      )
      setGroupMembers(members)
    } catch {
      setGroupMembers([])
    } finally {
      setIsLoadingGroupMembers(false)
    }
  }

  const handleRetry = async (transaction: Transaction) => {
    setIsRetrying(true)
    setRetryMessage(null)
    setRetryError(null)

    try {
      const retried = await retryTransaction(transaction.transactionId)
      setRetryMessage('Retry requested successfully.')

      if (retried) {
        setSelectedTransaction(retried)
      }

      await loadTransactions(false)
      await loadTransactionGroups(false)
      await loadTransactionStatusCounts()
    } catch (retryRequestError) {
      setRetryError(`Retry failed. ${getApiErrorMessage(retryRequestError)}`)
    } finally {
      setIsRetrying(false)
    }
  }

  const handleImportFile = async (file: File | undefined) => {
    if (!file) {
      return
    }

    setIsActionLoading(true)
    setActionMessage(null)
    setActionError(null)
    setUploadProgress(null)

    try {
      const extension = file.name.split('.').pop()?.toLowerCase()
      const useStreamingImport = file.size >= LARGE_FILE_THRESHOLD_BYTES
        && (extension === 'xlsx' || extension === 'csv')

      if (useStreamingImport) {
        setUploadProgress({ label: 'Uploading large file', subLabel: 'Sending retry-safe chunks…', percent: 0 })
        const result = await importTransactionsFile(file, (uploadedBytes, totalBytes, phase, rowsProcessed) => {
          if (phase === 'processing') {
            setUploadProgress({
              label: 'Processing on the server',
              subLabel: rowsProcessed
                ? `${rowsProcessed.toLocaleString()} rows processed so far…`
                : 'Splitting the file into memory-safe batches…',
              // No total row count is known until the server finishes counting, so this phase
              // is shown as an animated indeterminate bar rather than a fake percentage.
              percent: null,
            })
            return
          }
          const percent = totalBytes > 0 ? Math.min(Math.round((uploadedBytes / totalBytes) * 100), 100) : 0
          setUploadProgress({ label: 'Uploading large file', subLabel: 'Sending retry-safe chunks…', percent })
        })
        setUploadProgress(null)
        setActionMessage(
          `Large-file import completed. Imported ${result.received} rows, skipped ${result.duplicates} duplicates, and rejected ${result.failed}.`,
        )
        if (result.failed > 0) {
          setActionError(`Some rows were rejected. Open the row details or retry after correcting the source file.`)
        }
        setFilters({})
        setPage(0)
        await loadTransactions(false, {}, 0)
        await loadTransactionGroups(false, {}, 0)
        await loadTransactionStatusCounts()
        await loadJournalCount()
        return
      }

      const rows = await parseExcelToTransactions(file)
      setImportRows(rows)
      setIsImportPopupOpen(true)
    } catch (importError) {
      setUploadProgress(null)
      setActionError(`Import preview failed. ${getApiErrorMessage(importError)}`)
    } finally {
      setIsActionLoading(false)
      if (excelInputRef.current) {
        excelInputRef.current.value = ''
      }
      if (csvInputRef.current) {
        csvInputRef.current.value = ''
      }
    }
  }

  const handleSubmitImportRows = async () => {
    setIsActionLoading(true)
    setActionMessage(null)
    setActionError(null)
    setUploadProgress({ label: `Sending ${importRows.length} rows`, subLabel: '0 sent so far…', percent: 0 })

    try {
      const result = await ingestTransactions(importRows, (sent, total) => {
        setUploadProgress({
          label: `Sending ${total} rows`,
          subLabel: `${sent.toLocaleString()} of ${total.toLocaleString()} sent…`,
          percent: total > 0 ? Math.min(Math.round((sent / total) * 100), 100) : 0,
        })
      })
      setUploadProgress(null)
      const nextFilters: TransactionFilters = {}
      setFilters(nextFilters)
      setPage(0)
      setIsImportPopupOpen(false)
      setImportRows([])

      const resultSummary = `Imported ${result.received} new rows. Duplicates ${result.duplicates}. Failed ${result.failed}.`
      const itemMessages = result.items
        .flatMap((item: unknown) => {
          if (!item || typeof item !== 'object') {
            return []
          }

          const candidate = item as { errors?: unknown; messages?: unknown; transactionId?: unknown; status?: unknown }
          const messages = Array.isArray(candidate.errors)
            ? candidate.errors
            : Array.isArray(candidate.messages)
              ? candidate.messages
              : []
          const prefix = candidate.transactionId ? `${String(candidate.transactionId)}: ` : ''
          return messages.map((message) => `${prefix}${String(message)}`)
        })
        .filter(Boolean)

      if (result.received === 0 && result.duplicates > 0 && result.failed === 0) {
        setActionMessage(
          `No new rows imported. ${result.duplicates} duplicate rows already exist in the dashboard. The table was refreshed.`,
        )
      } else {
        setActionMessage(resultSummary)
      }

      if (result.failed > 0) {
        setActionError(
          itemMessages.length
            ? `Some rows failed: ${itemMessages.slice(0, 5).join(' | ')}`
            : `Some rows failed. ${resultSummary}`,
        )
      }

      await loadTransactions(false, nextFilters, 0)
      await loadTransactionGroups(false, nextFilters, 0)
      await loadTransactionStatusCounts()
      await loadJournalCount()
    } catch (importError) {
      setUploadProgress(null)
      setActionError(`Import failed. ${getApiErrorMessage(importError)}`)
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleProcessJournals = async () => {
    setIsActionLoading(true)
    setActionMessage(null)
    setActionError(null)

    try {
      setActionMessage('Processing journal entries on the server…')
      const result = await processJournals((status) => {
        if (status === 'RUNNING') {
          setActionMessage('Still processing journal entries on the server…')
        }
      })
      setActionMessage(`Journal processing created ${result.processed} balanced journal entries.`)
      await loadTransactions(false)
      await loadTransactionGroups(false)
      await loadTransactionStatusCounts()
      await loadJournalCount()
    } catch (processError) {
      setActionError(`Journal processing failed. ${getApiErrorMessage(processError)}`)
    } finally {
      setIsActionLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8fc] px-4 py-4 text-[#172452] sm:px-6">
      <section className="mx-auto min-h-[calc(100vh-2rem)] w-full max-w-[1840px] rounded-2xl border border-[#dfe6f4] bg-white/80 px-5 py-7 shadow-[0_18px_50px_rgba(35,48,85,0.08)] sm:px-8 lg:px-12">
        <header className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-normal text-[#111b45] lg:text-[34px]">
              Transactions Dashboard
            </h1>
            <p className="mt-2 text-base font-medium text-[#617096]">
              Import Excel rows and prepare them for journal processing
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
            <input
              ref={excelInputRef}
              className="hidden"
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) => void handleImportFile(event.target.files?.[0])}
            />
            <input
              ref={csvInputRef}
              className="hidden"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void handleImportFile(event.target.files?.[0])}
            />
            <div className="relative">
              <button
                className="inline-flex h-14 items-center justify-center gap-3 rounded-xl border border-[#dfe6f4] bg-white/80 px-6 text-sm font-bold text-[#493ee8] shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5 disabled:opacity-60"
                type="button"
                onClick={() => setIsImportMenuOpen((current) => !current)}
                disabled={isActionLoading}
              >
                <Upload className="h-5 w-5" aria-hidden="true" />
                Import File
              </button>
              {isImportMenuOpen ? (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-48 overflow-hidden rounded-xl border border-[#dfe6f4] bg-white shadow-[0_18px_40px_rgba(31,48,96,0.14)]">
                  <button
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-[#172452] transition hover:bg-[#f8fbff]"
                    type="button"
                    onClick={() => {
                      setIsImportMenuOpen(false)
                      excelInputRef.current?.click()
                    }}
                  >
                    <FileSpreadsheet className="h-4 w-4 text-[#493ee8]" aria-hidden="true" />
                    Excel file
                  </button>
                  <button
                    className="flex w-full items-center gap-3 border-t border-[#edf1f8] px-4 py-3 text-left text-sm font-bold text-[#172452] transition hover:bg-[#f8fbff]"
                    type="button"
                    onClick={() => {
                      setIsImportMenuOpen(false)
                      csvInputRef.current?.click()
                    }}
                  >
                    <Upload className="h-4 w-4 text-[#493ee8]" aria-hidden="true" />
                    CSV file
                  </button>
                </div>
              ) : null}
            </div>
            <button
              className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-[#dfe6f4] bg-white/80 text-[#5748f5] shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5 disabled:opacity-60"
              type="button"
              onClick={() => {
                void loadTransactions()
                void loadTransactionGroups()
                void loadTransactionStatusCounts()
                void loadJournalCount()
              }}
              disabled={isLoading}
              aria-label="Refresh transactions"
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
              onClick={handleLogout}
              aria-label="Logout"
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <SummaryCards
          summary={summary}
          onCardClick={handleSummaryCardClick}
          activeCard={activeSummaryCard}
          subFilters={{ unCompleted: notCompletedSubFilters }}
        />

        {uploadProgress ? (
          <div className="mt-6">
            <ProgressBar label={uploadProgress.label} subLabel={uploadProgress.subLabel} percent={uploadProgress.percent} />
          </div>
        ) : null}
        {actionMessage ? (
          <div className="mt-6 rounded-2xl border border-[#bfead9] bg-[#ecfdf5] px-5 py-4 text-sm font-bold text-[#047857]">
            {actionMessage}
          </div>
        ) : null}
        {actionError ? (
          <div className="mt-6 rounded-2xl border border-[#ffb8c2] bg-[#fff1f2] px-5 py-4 text-sm font-bold text-[#dc2626]">
            {actionError}
          </div>
        ) : null}

        <div className="mt-6">
          <FilterBar
            filters={filters}
            statuses={dashboardStatuses}
            sources={sources}
            autoRefresh={autoRefresh}
            isLoading={isLoading}
            onFiltersChange={handleFiltersChange}
            onRefresh={() => {
              void loadTransactions()
              void loadTransactionGroups()
              void loadTransactionStatusCounts()
            }}
            onAutoRefreshChange={setAutoRefresh}
            onReset={handleResetFilters}
          />
        </div>

        {error ? (
          <div className="mt-6 grid items-center gap-5 rounded-2xl border border-[#ffc987] bg-gradient-to-r from-[#ff972814] to-white/80 p-5 text-sm sm:grid-cols-[auto_1fr_auto]">
            <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-[#ff9a20] bg-[#fff7ec] text-[#ff8a00]">
              <AlertCircle className="h-8 w-8" aria-hidden="true" />
            </span>
            <div>
              <strong className="block text-base font-bold text-[#aa4a00]">
                Unable to connect to backend
              </strong>
              <p className="mt-1 font-medium text-[#4e5f8b]">
                /transactions endpoint is not available yet. Showing demo data. ({error})
              </p>
            </div>
            <button
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#dfe6f4] bg-white/80 px-5 font-bold text-[#493ee8] shadow-[0_8px_22px_rgba(52,68,110,0.04)]"
              type="button"
              onClick={() => void loadTransactions()}
            >
              <RefreshCw className="h-5 w-5" aria-hidden="true" />
              Retry Connection
            </button>
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-[#dfe6f4] bg-white/70 px-5 py-4 shadow-[0_12px_34px_rgba(31,48,96,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold text-[#111b45]">Transactions Dashboard Table</h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <button
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#dfe6f4] bg-white px-5 text-sm font-bold text-[#493ee8] shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5"
                  type="button"
                  onClick={() => setIsExportMenuOpen((current) => !current)}
                >
                  <Download className="h-5 w-5" aria-hidden="true" />
                  Export File
                </button>
                {isExportMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-48 overflow-hidden rounded-xl border border-[#dfe6f4] bg-white shadow-[0_18px_40px_rgba(31,48,96,0.14)]">
                    <button
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-[#172452] transition hover:bg-[#f8fbff]"
                      type="button"
                      onClick={() => {
                        setIsExportMenuOpen(false)
                        exportTransactionsFile(transactionsPage.content, 'excel')
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
                        exportTransactionsFile(transactionsPage.content, 'csv')
                      }}
                    >
                      <Download className="h-4 w-4 text-[#493ee8]" aria-hidden="true" />
                      CSV file
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#7254ff] to-[#5237e9] px-5 text-sm font-extrabold text-white shadow-[0_14px_24px_rgba(88,58,235,0.25)] transition hover:-translate-y-0.5 disabled:opacity-60"
                type="button"
                onClick={() => void handleProcessJournals()}
                disabled={isActionLoading}
              >
                <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
                Journal Processing
              </button>
              <Link
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#dfe6f4] bg-white px-5 text-sm font-bold text-[#172452] shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5"
                to="/journal"
              >
                <ListChecks className="h-5 w-5" aria-hidden="true" />
                Journal Table
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-[#dfe6f4] bg-white/80 shadow-[0_12px_30px_rgba(31,48,96,0.06)]">
          <TransactionTable
            groups={groupsPage.content}
            isLoading={isGroupsLoading}
            onSelectGroup={(group) => void handleSelectGroup(group)}
            activeReason={filters.internalStatus === 'un-completed' ? filters.rejectionReason : undefined}
          />

          <div className="flex min-h-[76px] flex-col gap-4 border-t border-[#dfe6f4] px-6 py-4 text-sm font-medium text-[#657295] sm:flex-row sm:items-center sm:justify-between">
            <div>
              Showing {groupsPage.content.length === 0 ? 0 : page * size + 1} to{' '}
              {Math.min((page + 1) * size, groupsPage.totalElements)} of{' '}
              {groupsPage.totalElements} grouped rows
            </div>
            <div className="flex items-center gap-3">
              <select
                className="h-11 rounded-xl border border-[#dfe6f4] bg-white px-3 text-sm font-semibold text-[#172452] outline-none focus:border-[#5748f5] focus:ring-2 focus:ring-[#5748f5]/15"
                value={size}
                onChange={(event) => {
                  setSize(Number(event.target.value))
                  setPage(0)
                }}
              >
                {[10, 25, 50].map((option) => (
                  <option key={option} value={option}>
                    {option} / page
                  </option>
                ))}
              </select>
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#dfe6f4] bg-white text-[#5748f5] transition hover:bg-[#f7f8ff] disabled:cursor-not-allowed disabled:opacity-40"
                type="button"
                onClick={() => setPage((current) => Math.max(current - 1, 0))}
                disabled={!canGoBack}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <strong className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#7354ff] to-[#563cee] text-white shadow-[0_10px_18px_rgba(88,58,235,0.22)]">
                {groupsPage.totalPages === 0 ? 0 : page + 1}
              </strong>
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#dfe6f4] bg-white text-[#5748f5] transition hover:bg-[#f7f8ff] disabled:cursor-not-allowed disabled:opacity-40"
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={!canGoForward}
                aria-label="Next page"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </section>


      {isImportPopupOpen ? (
        <ExcelImportModal
          rows={importRows}
          isSubmitting={isActionLoading}
          onRowsChange={setImportRows}
          onClose={() => {
            setIsImportPopupOpen(false)
            setImportRows([])
          }}
          onSubmit={() => void handleSubmitImportRows()}
        />
      ) : null}
      <TransactionDetailPanel
        transaction={selectedTransaction}
        group={selectedGroup}
        groupMembers={groupMembers}
        isLoadingGroupMembers={isLoadingGroupMembers}
        isRetrying={isRetrying}
        retryMessage={retryMessage}
        retryError={retryError}
        onClose={() => {
          setSelectedTransaction(null)
          setSelectedGroup(null)
        }}
        onRetry={handleRetry}
        onSelectFromGroup={(transaction) => void handleSelectTransaction(transaction)}
      />
    </main>
  )
}












