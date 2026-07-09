import { ArrowLeft, LogOut, RefreshCw, RotateCw, Send, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { FilterBar } from '../components/FilterBar'
import { JournalTable } from '../components/JournalTable'
import { getJournals, sendJournalsToOdoo } from '../services/api'
import type { Journal, PageResponse, TransactionFilters, TransactionStatus } from '../types/transaction'

const initialJournalsPage: PageResponse<Journal> = {
  content: [],
  page: 0,
  size: 100,
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

function getApiErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unknown error'
}

export function JournalPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [filters, setFilters] = useState<TransactionFilters>({})
  const [journalsPage, setJournalsPage] = useState<PageResponse<Journal>>(initialJournalsPage)
  const [isLoading, setIsLoading] = useState(true)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

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
        const response = await getJournals(filters, 0, 100)
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
    [filters],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadJournals()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadJournals])

  const handleFiltersChange = (nextFilters: TransactionFilters) => {
    setFilters(nextFilters)
  }

  const handleResetFilters = () => {
    setFilters({})
  }

  const handleSendToOdoo = async () => {
    setIsActionLoading(true)
    setActionMessage(null)
    setActionError(null)

    try {
      const result = await sendJournalsToOdoo()
      setActionMessage(`Updated ${result.processed} journal rows as sent to Odoo.`)
      await loadJournals(false)
    } catch (error) {
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
        <header className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-normal text-[#111b45] lg:text-[34px]">
              Journal Table
            </h1>
            <p className="mt-2 text-base font-medium text-[#617096]">
              Processed journal rows with the original processing statuses
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
            <Link
              className="inline-flex h-14 items-center justify-center gap-3 rounded-xl border border-[#dfe6f4] bg-white/80 px-6 text-sm font-bold text-[#172452] shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5"
              to="/"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              Back to Dashboard
            </Link>
            <button
              className="inline-flex h-14 items-center justify-center gap-3 rounded-xl bg-gradient-to-br from-[#7254ff] to-[#5237e9] px-6 text-sm font-extrabold text-white shadow-[0_14px_24px_rgba(88,58,235,0.25)] transition hover:-translate-y-0.5 disabled:opacity-60"
              type="button"
              onClick={() => void handleSendToOdoo()}
              disabled={isActionLoading}
            >
              <Send className="h-5 w-5" aria-hidden="true" />
              Send to Odoo
            </button>
            <button
              className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-[#dfe6f4] bg-white/80 text-[#5748f5] shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5 disabled:opacity-60"
              type="button"
              onClick={() => void loadJournals()}
              disabled={isLoading}
              aria-label="Refresh journals"
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
            onRefresh={() => void loadJournals()}
            onReset={handleResetFilters}
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-[#dfe6f4] bg-white/80 shadow-[0_12px_30px_rgba(31,48,96,0.06)]">
          <JournalTable journals={journalsPage.content} isLoading={isLoading} />
          <div className="border-t border-[#dfe6f4] px-6 py-4 text-sm font-medium text-[#657295]">
            Showing {journalsPage.content.length} of {journalsPage.totalElements} journal rows
          </div>
        </div>
      </section>
    </main>
  )
}
