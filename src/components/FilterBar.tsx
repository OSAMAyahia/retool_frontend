import { Filter, RefreshCw, Search } from 'lucide-react'
import type { TransactionFilters, TransactionStatus } from '../types/transaction'

interface FilterBarProps {
  filters: TransactionFilters
  statuses: TransactionStatus[]
  sources: string[]
  autoRefresh: boolean
  isLoading: boolean
  onFiltersChange: (filters: TransactionFilters) => void
  onRefresh: () => void
  onAutoRefreshChange: (enabled: boolean) => void
  onReset: () => void
}

const inputClass =
  'h-[52px] w-full rounded-xl border border-[#dfe6f4] bg-white/80 px-4 text-sm font-medium text-[#44527b] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_22px_rgba(52,68,110,0.04)] outline-none transition placeholder:text-[#8290b4] focus:border-[#5748f5] focus:ring-2 focus:ring-[#5748f5]/15'

export function FilterBar({
  filters,
  statuses,
  sources,
  isLoading,
  onFiltersChange,
  onRefresh,
  onReset,
}: FilterBarProps) {
  return (
    <section className="rounded-2xl border border-[#dfe6f4] bg-white/70 px-6 py-6 shadow-[0_12px_34px_rgba(31,48,96,0.05)]">
      <div className="grid gap-7 lg:grid-cols-[1.1fr_1.1fr_1.45fr_1fr_1fr_auto] lg:items-end">
        <label className="flex flex-col gap-3 text-sm font-bold text-[#18234f]">
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

        <label className="flex flex-col gap-3 text-sm font-bold text-[#18234f]">
          Source
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
            <option value="">All Sources</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-3 text-sm font-bold text-[#18234f]">
          Account ID
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-4 h-5 w-5 text-[#7380a7]" />
            <input
              className={`${inputClass} pl-12`}
              placeholder="Search account ID..."
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

        <label className="flex flex-col gap-3 text-sm font-bold text-[#18234f]">
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

        <label className="flex flex-col gap-3 text-sm font-bold text-[#18234f]">
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

        <div className="flex items-center gap-3">
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
        </div>
      </div>
    </section>
  )
}
