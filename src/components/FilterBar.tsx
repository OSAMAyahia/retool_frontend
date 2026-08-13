import { Filter, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { TransactionFilters, TransactionStatus } from '../types/transaction'

interface FilterBarProps {
  filters: TransactionFilters
  statuses: TransactionStatus[]
  sources: string[]
  autoRefresh?: boolean
  isLoading: boolean
  sourceLabel?: string
  accountLabel?: string
  accountPlaceholder?: string
  // Journal page only: turns the Source dropdown (exact match) into a free-text "Journal ID"
  // input bound to filters.journalId (partial, case-insensitive match) instead of filters.source.
  journalIdMode?: boolean
  // localStorage key used to persist which fields are visible - unique per page usage so the
  // Dashboard and Journal page filter bars remember their own field selection independently.
  storageKey: string
  // Bumped by the parent's "Reset" handler to force the visible-fields selection back to the
  // default (all fields visible), in addition to the filters/pagination reset it already does.
  resetSignal?: number
  onFiltersChange: (filters: TransactionFilters) => void
  onRefresh: () => void
  onAutoRefreshChange?: (enabled: boolean) => void
  onReset: () => void
}

const inputClass =
  'h-[52px] w-full rounded-xl border border-[#dfe6f4] bg-white/80 px-4 text-sm font-medium text-[#44527b] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_22px_rgba(52,68,110,0.04)] outline-none transition placeholder:text-[#8290b4] focus:border-[#5748f5] focus:ring-2 focus:ring-[#5748f5]/15'

type FieldKey = 'status' | 'source' | 'account' | 'transactionId' | 'dateFrom' | 'dateTo'

const ALL_FIELDS: FieldKey[] = ['status', 'source', 'account', 'transactionId', 'dateFrom', 'dateTo']

const FIELD_TOGGLE_LABELS: Record<FieldKey, string> = {
  status: 'Status',
  source: 'Source / Journal ID',
  account: 'Account',
  transactionId: 'Transaction ID',
  dateFrom: 'From Date',
  dateTo: 'To Date',
}

function loadVisibleFields(storageKey: string): FieldKey[] {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      return ALL_FIELDS
    }
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      const next = ALL_FIELDS.filter((field) => parsed.includes(field))
      return next.length > 0 ? next : ALL_FIELDS
    }
  } catch {
    // Ignore malformed/blocked storage and fall back to showing every field.
  }
  return ALL_FIELDS
}

export function FilterBar({
  filters,
  statuses,
  sources,
  isLoading,
  sourceLabel = 'Source',
  accountLabel = 'Account ID',
  accountPlaceholder = 'Search account ID...',
  journalIdMode = false,
  storageKey,
  resetSignal,
  onFiltersChange,
  onRefresh,
  onReset,
}: FilterBarProps) {
  const [visibleFields, setVisibleFields] = useState<FieldKey[]>(() => loadVisibleFields(storageKey))
  const [isFieldMenuOpen, setIsFieldMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const isFirstRender = useRef(true)

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(visibleFields))
  }, [storageKey, visibleFields])

  useEffect(() => {
    // Skip on mount - resetSignal being set initially shouldn't overwrite whatever was already
    // persisted; only an actual Reset click (a change to this value) should.
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setVisibleFields(ALL_FIELDS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal])

  useEffect(() => {
    if (!isFieldMenuOpen) {
      return
    }
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsFieldMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isFieldMenuOpen])

  const toggleField = (field: FieldKey) => {
    setVisibleFields((current) =>
      current.includes(field) ? current.filter((item) => item !== field) : [...current, field],
    )
  }

  const isVisible = (field: FieldKey) => visibleFields.includes(field)

  return (
    <section className="rounded-2xl border border-[#dfe6f4] bg-white/70 px-6 py-6 shadow-[0_12px_34px_rgba(31,48,96,0.05)]">
      <div className="flex flex-wrap items-end gap-7">
        {isVisible('status') ? (
          <label className="flex min-w-[180px] flex-1 flex-col gap-3 text-sm font-bold text-[#18234f]">
            Status
            <select
              className={inputClass}
              value={filters.internalStatus ?? ''}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  internalStatus: event.target.value,
                })
              }
            >
              <option value="">All Statuses</option>
              {statuses.map((status) => (
                <option key={status.code} value={status.code}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {isVisible('source') ? (
          journalIdMode ? (
            <label className="flex min-w-[180px] flex-1 flex-col gap-3 text-sm font-bold text-[#18234f]">
              Journal ID
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-4 h-5 w-5 text-[#7380a7]" />
                <input
                  className={`${inputClass} pl-12`}
                  placeholder="Search journal ID..."
                  value={filters.journalId ?? ''}
                  onChange={(event) =>
                    onFiltersChange({
                      ...filters,
                      journalId: event.target.value,
                    })
                  }
                />
              </div>
            </label>
          ) : (
            <label className="flex min-w-[180px] flex-1 flex-col gap-3 text-sm font-bold text-[#18234f]">
              {sourceLabel}
              <select
                className={inputClass}
                value={filters.source ?? ''}
                onChange={(event) =>
                  onFiltersChange({
                    ...filters,
                    source: event.target.value,
                  })
                }
              >
                <option value="">All {sourceLabel}s</option>
                {sources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </label>
          )
        ) : null}

        {isVisible('account') ? (
          <label className="flex min-w-[180px] flex-1 flex-col gap-3 text-sm font-bold text-[#18234f]">
            {accountLabel}
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-4 h-5 w-5 text-[#7380a7]" />
              <input
                className={`${inputClass} pl-12`}
                placeholder={accountPlaceholder}
                value={filters.accountId ?? ''}
                onChange={(event) =>
                  onFiltersChange({
                    ...filters,
                    accountId: event.target.value,
                  })
                }
              />
            </div>
          </label>
        ) : null}

        {isVisible('transactionId') ? (
          <label className="flex min-w-[180px] flex-1 flex-col gap-3 text-sm font-bold text-[#18234f]">
            Transaction ID
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-4 h-5 w-5 text-[#7380a7]" />
              <input
                className={`${inputClass} pl-12`}
                placeholder="Search transaction ID..."
                value={filters.transactionId ?? ''}
                onChange={(event) =>
                  onFiltersChange({
                    ...filters,
                    transactionId: event.target.value,
                  })
                }
              />
            </div>
          </label>
        ) : null}

        {isVisible('dateFrom') ? (
          <label className="flex min-w-[150px] flex-1 flex-col gap-3 text-sm font-bold text-[#18234f]">
            From Date
            <input
              className={inputClass}
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  dateFrom: event.target.value,
                })
              }
            />
          </label>
        ) : null}

        {isVisible('dateTo') ? (
          <label className="flex min-w-[150px] flex-1 flex-col gap-3 text-sm font-bold text-[#18234f]">
            To Date
            <input
              className={inputClass}
              type="date"
              value={filters.dateTo ?? ''}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  dateTo: event.target.value,
                })
              }
            />
          </label>
        ) : null}

        <div className="flex items-center gap-2">
          <button
            className="inline-flex h-[52px] items-center justify-center gap-3 rounded-xl bg-gradient-to-br from-[#7254ff] to-[#5237e9] px-6 text-sm font-extrabold text-white shadow-[0_14px_24px_rgba(88,58,235,0.25)] transition hover:-translate-y-0.5 disabled:opacity-60"
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <Filter className="h-5 w-5" aria-hidden="true" />
            Apply Filters
          </button>
          <button
            className="inline-flex h-[52px] items-center justify-center gap-2 rounded-xl px-2 text-sm font-bold text-[#5e50f2] transition hover:bg-[#f7f8ff]"
            type="button"
            onClick={onReset}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reset
          </button>
          <div className="relative" ref={menuRef}>
            <button
              className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-xl border border-[#dfe6f4] bg-white/80 text-[#5748f5] shadow-[0_8px_22px_rgba(52,68,110,0.04)] transition hover:-translate-y-0.5"
              type="button"
              onClick={() => setIsFieldMenuOpen((current) => !current)}
              aria-label="Choose visible search fields"
              title="Choose visible search fields"
            >
              <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
            </button>
            {isFieldMenuOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-64 rounded-xl border border-[#dfe6f4] bg-white p-3 shadow-[0_18px_40px_rgba(31,48,96,0.14)]">
                <p className="px-1 pb-2 text-xs font-extrabold uppercase tracking-[0.04em] text-[#7380a7]">
                  Visible search fields
                </p>
                {ALL_FIELDS.map((field) => (
                  <label
                    key={field}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-[#2d3b68] transition hover:bg-[#f8fbff]"
                  >
                    <input
                      type="checkbox"
                      checked={isVisible(field)}
                      onChange={() => toggleField(field)}
                    />
                    {FIELD_TOGGLE_LABELS[field]}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
