import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  LogOut,
  RefreshCw,
  RotateCw,
  ShieldCheck,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { FilterBar } from '../components/FilterBar'
import { SummaryCards } from '../components/SummaryCards'
import { TransactionDetailPanel } from '../components/TransactionDetailPanel'
import { TransactionTable } from '../components/TransactionTable'
import {
  getSources,
  getStatuses,
  getTransactionById,
  getTransactions,
  retryTransaction,
} from '../services/api'
import { getMockTransactions } from '../services/mockData'
import type {
  PageResponse,
  Transaction,
  TransactionFilters,
  TransactionSummary,
  TransactionStatus,
} from '../types/transaction'

const initialPage: PageResponse<Transaction> = {
  content: [],
  page: 0,
  size: 10,
  totalElements: 0,
  totalPages: 0,
}

const fallbackStatuses: TransactionStatus[] = [
  {
    code: 'NEW',
    label: 'New',
    description: null,
    color: '#0ea5e9',
    sortOrder: 10,
    systemStatus: true,
    editable: true,
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
    editable: true,
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
    editable: true,
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
    editable: true,
    createdAt: '',
    updatedAt: '',
  },
  {
    code: 'REJECTED',
    label: 'rejected',
    description: null,
    color: '#dc2626',
    sortOrder: 50,
    systemStatus: true,
    editable: true,
    createdAt: '',
    updatedAt: '',
  },
]

const fallbackSources = ['Retool', 'Bank API', 'Partner Portal']

function getApiErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unknown error'
}

function buildSummary(page: PageResponse<Transaction>): TransactionSummary {
  const counts = page.content.reduce(
    (summary, transaction) => {
      if (transaction.internalStatus === 'NEW') {
        summary.new += 1
      }

      if (transaction.internalStatus === 'PENDING') {
        summary.pending += 1
      }

      if (transaction.internalStatus === 'SENT') {
        summary.sent += 1
      }

      if (transaction.internalStatus === 'REJECTED') {
        summary.rejected += 1
      }

      return summary
    },
    { total: page.totalElements, new: 0, pending: 0, sent: 0, rejected: 0 },
  )

  return counts
}

function exportTransactions(transactions: Transaction[]) {
  const headers = [
    'Transaction ID',
    'Account ID',
    'Amount',
    'Currency',
    'Type',
    'Source',
    'Internal Status',
    'Source Status',
    'Value Date',
    'Retry Count',
  ]
  const rows = transactions.map((transaction) => [
    transaction.transactionId,
    transaction.accountId,
    transaction.amount,
    transaction.currency,
    transaction.type,
    transaction.source,
    transaction.internalStatus,
    transaction.sourceStatus ?? '',
    transaction.valueDate ?? '',
    transaction.retryCount,
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'transactions-report.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [filters, setFilters] = useState<TransactionFilters>({})
  const [transactionsPage, setTransactionsPage] = useState<PageResponse<Transaction>>(initialPage)
  const [statuses, setStatuses] = useState<TransactionStatus[]>(fallbackStatuses)
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

  const loadTransactions = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setIsLoading(true)
      }

      try {
        const response = await getTransactions(filters, page, size)
        setTransactionsPage(response)
        setError(null)
      } catch (apiError) {
        setTransactionsPage(getMockTransactions(filters, page, size))
        setError(getApiErrorMessage(apiError))
      } finally {
        setIsLoading(false)
        setLastUpdated(new Date())
      }
    },
    [filters, page, size],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTransactions()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadTransactions])

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
        const [nextStatuses, nextSources] = await Promise.all([getStatuses(), getSources()])
        setStatuses(nextStatuses.length ? nextStatuses : fallbackStatuses)
        setSources(nextSources.length ? nextSources : fallbackSources)
      } catch {
        setStatuses(fallbackStatuses)
        setSources(fallbackSources)
      }
    }

    void loadMetadata()
  }, [])

  const summary = useMemo(() => buildSummary(transactionsPage), [transactionsPage])
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

  return (
    <main className="min-h-screen bg-[#f6f8fc] px-4 py-4 text-[#172452] sm:px-6">
      <section className="mx-auto min-h-[calc(100vh-2rem)] w-full max-w-[1840px] rounded-2xl border border-[#dfe6f4] bg-white/80 px-5 py-7 shadow-[0_18px_50px_rgba(35,48,85,0.08)] sm:px-8 lg:px-12">
        <header className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-normal text-[#111b45] lg:text-[34px]">
              Transactions Dashboard
            </h1>
            <p className="mt-2 text-base font-medium text-[#617096]">
              Monitor and sync all your Odoo transactions in real-time
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
              className="inline-flex h-14 items-center justify-center gap-3 rounded-xl border border-[#dfe6f4] bg-white/80 px-6 text-sm font-bold text-[#493ee8] shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5"
              type="button"
              onClick={() => exportTransactions(transactionsPage.content)}
            >
              <Download className="h-5 w-5" aria-hidden="true" />
              Export Report
            </button>
            <button
              className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-[#dfe6f4] bg-white/80 text-[#5748f5] shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5 disabled:opacity-60"
              type="button"
              onClick={() => void loadTransactions()}
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

        <div className="mt-6">
          <FilterBar
            filters={filters}
            statuses={statuses}
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

        <div className="mt-6 overflow-hidden rounded-xl border border-[#dfe6f4] bg-white/80 shadow-[0_12px_30px_rgba(31,48,96,0.06)]">
          <TransactionTable
            transactions={transactionsPage.content}
            isLoading={isLoading}
            isRetrying={isRetrying}
            onSelect={handleSelectTransaction}
            onRetry={handleRetry}
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
