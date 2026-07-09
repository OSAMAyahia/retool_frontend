import type { InternalStatus, PageResponse, Transaction, TransactionFilters } from '../types/transaction'

const demoTransactions: Transaction[] = [
  {
    transactionId: 'EXCEL-DEMO-1',
    accountId: '111201 Credit Balanced Suspense/Hold Accounts',
    amount: 12,
    currency: 'SAR',
    type: 'debit',
    sourceStatus: 'IMPORTED',
    source: 'Excel',
    internalStatus: 'un-completed',
    description: 'Core Banking Operations Journals46026',
    valueDate: '2026-01-04T00:00:00Z',
    retryCount: 0,
    lastError: null,
    odooReferenceId: null,
    createdAt: '2026-07-09T10:00:00Z',
    updatedAt: '2026-07-09T10:00:00Z',
  },
  {
    transactionId: 'EXCEL-DEMO-2',
    accountId: '310101 Wallets Balances',
    amount: 12,
    currency: 'SAR',
    type: 'credit',
    sourceStatus: 'IMPORTED',
    source: 'Excel',
    internalStatus: 'completed',
    description: 'Core Banking Operations Journals46026',
    valueDate: '2026-01-04T00:00:00Z',
    retryCount: 0,
    lastError: null,
    odooReferenceId: null,
    createdAt: '2026-07-09T10:01:00Z',
    updatedAt: '2026-07-09T10:05:00Z',
  },
]

function statusMatches(value: InternalStatus, filter?: InternalStatus | '') {
  return !filter || value === filter
}

export function getMockTransactions(
  filters: TransactionFilters,
  page: number,
  size: number,
): PageResponse<Transaction> {
  const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : null
  const dateTo = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`) : null

  const filtered = demoTransactions.filter((transaction) => {
    const valueDate = transaction.valueDate ? new Date(transaction.valueDate) : null
    const matchesStatus = statusMatches(transaction.internalStatus, filters.internalStatus)
    const matchesSource = !filters.source || transaction.source === filters.source
    const matchesAccount =
      !filters.accountId ||
      transaction.accountId.toLowerCase().includes(filters.accountId.toLowerCase())
    const matchesFrom = !dateFrom || (valueDate && valueDate >= dateFrom)
    const matchesTo = !dateTo || (valueDate && valueDate <= dateTo)

    return matchesStatus && matchesSource && matchesAccount && matchesFrom && matchesTo
  })

  const start = page * size
  const content = filtered.slice(start, start + size)

  return {
    content,
    page,
    size,
    totalElements: filtered.length,
    totalPages: Math.ceil(filtered.length / size),
  }
}
