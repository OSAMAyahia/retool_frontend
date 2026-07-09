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
import { SummaryCards } from '../components/SummaryCards'
import { TransactionDetailPanel } from '../components/TransactionDetailPanel'
import { TransactionTable } from '../components/TransactionTable'
import {
  getJournals,
  getSources,
  getTransactionById,
  getTransactions,
  ingestTransactions,
  processJournals,
  retryTransaction,
} from '../services/api'
import { getMockTransactions } from '../services/mockData'
import { parseExcelToTransactions } from '../utils/xlsxImport'
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

const dashboardStatuses: TransactionStatus[] = [
  {
    code: 'un-completed',
    label: 'Un-completed',
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

function getApiErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unknown error'
}

function buildSummary(page: PageResponse<Transaction>, journalRows: number): TransactionSummary {
  return page.content.reduce(
    (summary, transaction) => {
      if (transaction.internalStatus === 'completed') {
        summary.completed += 1
      }

      if (transaction.internalStatus === 'un-completed') {
        summary.unCompleted += 1
      }

      return summary
    },
    { total: page.totalElements, completed: 0, unCompleted: 0, journalRows },
  )
}

function exportTransactionsExcel(transactions: Transaction[]) {
  const headers = [
    'Transaction ID',
    'Account ID',
    'Amount',
    'Currency',
    'Type',
    'Source',
    'Status',
    'Value Date',
    'Created At',
    'Updated At',
  ]
  const rows = transactions.map((transaction) => [
    transaction.transactionId,
    transaction.accountId,
    transaction.amount,
    transaction.currency,
    transaction.type,
    transaction.source,
    transaction.internalStatus,
    transaction.valueDate ?? '',
    transaction.createdAt,
    transaction.updatedAt,
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'application/vnd.ms-excel;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'transactions-dashboard-export.xls'
  link.click()
  URL.revokeObjectURL(url)
}

export function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [filters, setFilters] = useState<TransactionFilters>({})
  const [transactionsPage, setTransactionsPage] = useState<PageResponse<Transaction>>(initialTransactionsPage)
  const [journalRows, setJournalRows] = useState(0)
  const [sources, setSources] = useState<string[]>(fallbackSources)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
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

  const loadJournalCount = useCallback(async () => {
    try {
      const response: PageResponse<Journal> = await getJournals({}, 0, 1)
      setJournalRows(response.totalElements)
    } catch {
      setJournalRows(0)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTransactions()
      void loadJournalCount()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadJournalCount, loadTransactions])

  useEffect(() => {
    if (!autoRefresh) {
      return
    }

    const timer = window.setInterval(() => {
      void loadTransactions(false)
    }, 15000)

    return () => window.clearInterval(timer)
  }, [autoRefresh, loadTransactions])

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
    () => buildSummary(transactionsPage, journalRows),
    [journalRows, transactionsPage],
  )
  const canGoBack = page > 0
  const canGoForward = transactionsPage.totalPages > 0 && page + 1 < transactionsPage.totalPages

  const handleFiltersChange = (nextFilters: TransactionFilters) => {
    setFilters(nextFilters)
    setPage(0)
  }

  const handleResetFilters = () => {
    setFilters({})
    setPage(0)
  }

  const handleSourceSelect = (source: string) => {
    setFilters((current) => ({ ...current, source }))
    setPage(0)
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleSelectTransaction = async (transaction: Transaction) => {
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
    } catch (retryRequestError) {
      setRetryError(`Retry failed. ${getApiErrorMessage(retryRequestError)}`)
    } finally {
      setIsRetrying(false)
    }
  }

  const handleImportExcel = async (file: File | undefined) => {
    if (!file) {
      return
    }

    setIsActionLoading(true)
    setActionMessage(null)
    setActionError(null)

    try {
      const rows = await parseExcelToTransactions(file)
      setImportRows(rows)
      setIsImportPopupOpen(true)
    } catch (importError) {
      setActionError(`Import preview failed. ${getApiErrorMessage(importError)}`)
    } finally {
      setIsActionLoading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSubmitImportRows = async () => {
    setIsActionLoading(true)
    setActionMessage(null)
    setActionError(null)

    try {
      const result = await ingestTransactions(importRows)
      const nextFilters: TransactionFilters = {}
      setFilters(nextFilters)
      setPage(0)
      setIsImportPopupOpen(false)
      setImportRows([])

      if (result.received === 0) {
        const itemMessages = result.items
          .flatMap((item: unknown) => {
            if (item && typeof item === 'object' && 'messages' in item) {
              const messages = (item as { messages?: unknown }).messages
              return Array.isArray(messages) ? messages.map(String) : []
            }
            return []
          })
          .filter(Boolean)

        setActionError(
          itemMessages.length
            ? `Import did not add rows. ${itemMessages.join(' ')}`
            : 'Import did not add rows. The backend returned 0 imported rows, so nothing was added to the table.',
        )
      } else {
        setActionMessage(`Imported ${result.received} rows. Duplicates ${result.duplicates}. Failed ${result.failed}.`)
      }

      await loadTransactions(false, nextFilters, 0)
      await loadJournalCount()
    } catch (importError) {
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
      const result = await processJournals()
      setActionMessage(`Journal processing completed for ${result.processed} rows.`)
      await loadTransactions(false)
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
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept=".xlsx"
              onChange={(event) => void handleImportExcel(event.target.files?.[0])}
            />
            <button
              className="inline-flex h-14 items-center justify-center gap-3 rounded-xl border border-[#dfe6f4] bg-white/80 px-6 text-sm font-bold text-[#493ee8] shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5 disabled:opacity-60"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isActionLoading}
            >
              <Upload className="h-5 w-5" aria-hidden="true" />
              Import Excel
            </button>
            <button
              className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-[#dfe6f4] bg-white/80 text-[#5748f5] shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5 disabled:opacity-60"
              type="button"
              onClick={() => {
                void loadTransactions()
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

        <SummaryCards summary={summary} />

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
            onRefresh={() => void loadTransactions()}
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
              <button
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#dfe6f4] bg-white px-5 text-sm font-bold text-[#493ee8] shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5"
                type="button"
                onClick={() => exportTransactionsExcel(transactionsPage.content)}
              >
                <Download className="h-5 w-5" aria-hidden="true" />
                Export Excel
              </button>
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
            transactions={transactionsPage.content}
            isLoading={isLoading}
            onSelect={handleSelectTransaction}
            onSourceSelect={handleSourceSelect}
          />

          <div className="flex min-h-[76px] flex-col gap-4 border-t border-[#dfe6f4] px-6 py-4 text-sm font-medium text-[#657295] sm:flex-row sm:items-center sm:justify-between">
            <div>
              Showing {transactionsPage.content.length === 0 ? 0 : page * size + 1} to{' '}
              {Math.min((page + 1) * size, transactionsPage.totalElements)} of{' '}
              {transactionsPage.totalElements} results
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
                {transactionsPage.totalPages === 0 ? 0 : page + 1}
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
        isRetrying={isRetrying}
        retryMessage={retryMessage}
        retryError={retryError}
        onClose={() => setSelectedTransaction(null)}
        onRetry={handleRetry}
      />
    </main>
  )
}




