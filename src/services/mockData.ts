import type { InternalStatus, PageResponse, Transaction, TransactionFilters } from '../types/transaction'

const demoTransactions: Transaction[] = [
  {
    transactionId: 'TXN-987654322',
    accountId: 'ACC-123456789',
    amount: 1500,
    currency: 'SAR',
    type: 'credit',
    sourceStatus: 'new',
    internalStatus: 'PENDING',
    description: 'Salary Deposit',
    valueDate: '2026-06-25T08:00:00Z',
    retryCount: 0,
    lastError: null,
    odooReferenceId: null,
    createdAt: '2026-06-25T08:01:00Z',
    updatedAt: '2026-06-25T08:01:00Z',
    rawPayload: {
      transactionId: 'TXN-987654322',
      accountId: 'ACC-123456789',
      amount: 1500,
      currency: 'SAR',
      type: 'credit',
      status: 'new',
    },
  },
  {
    transactionId: 'TXN-987654321',
    accountId: 'ACC-123456789',
    amount: 1500,
    currency: 'SAR',
    type: 'credit',
    sourceStatus: 'processing',
    internalStatus: 'PROCESSING',
    description: 'Salary Deposit',
    valueDate: '2026-06-25T08:00:00Z',
    retryCount: 1,
    lastError: null,
    odooReferenceId: null,
    createdAt: '2026-06-25T08:02:00Z',
    updatedAt: '2026-06-25T08:03:00Z',
    rawPayload: {
      transactionId: 'TXN-987654321',
      status: 'processing',
    },
  },
  {
    transactionId: 'TXN-987654320',
    accountId: 'ACC-987654321',
    amount: 840.75,
    currency: 'SAR',
    type: 'debit',
    sourceStatus: 'posted',
    internalStatus: 'SENT',
    description: 'Vendor Payment',
    valueDate: '2026-06-24T11:30:00Z',
    retryCount: 0,
    lastError: null,
    odooReferenceId: 'ODOO-MOVE-5831',
    createdAt: '2026-06-24T11:31:00Z',
    updatedAt: '2026-06-24T11:32:00Z',
    rawPayload: {
      transactionId: 'TXN-987654320',
      odooReferenceId: 'ODOO-MOVE-5831',
    },
  },
  {
    transactionId: 'TXN-987654319',
    accountId: 'ACC-456789123',
    amount: 320,
    currency: 'SAR',
    type: 'debit',
    sourceStatus: 'review',
    internalStatus: 'FAILED',
    description: 'Expense Reimbursement',
    valueDate: '2026-06-23T13:45:00Z',
    retryCount: 3,
    lastError: 'Odoo rejected the transaction because the journal_id field is missing.',
    odooReferenceId: null,
    createdAt: '2026-06-23T13:46:00Z',
    updatedAt: '2026-06-23T13:50:00Z',
    rawPayload: {
      transactionId: 'TXN-987654319',
      status: 'review',
      error: 'journal_id missing',
    },
  },
  {
    transactionId: 'TXN-987654318',
    accountId: 'ACC-222333444',
    amount: 2800,
    currency: 'SAR',
    type: 'credit',
    sourceStatus: 'posted',
    internalStatus: 'SENT',
    description: 'Client Settlement',
    valueDate: '2026-06-22T09:15:00Z',
    retryCount: 1,
    lastError: null,
    odooReferenceId: 'ODOO-PAY-8492',
    createdAt: '2026-06-22T09:16:00Z',
    updatedAt: '2026-06-22T09:20:00Z',
    rawPayload: {
      transactionId: 'TXN-987654318',
      status: 'posted',
    },
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
    const matchesAccount =
      !filters.accountId ||
      transaction.accountId.toLowerCase().includes(filters.accountId.toLowerCase())
    const matchesFrom = !dateFrom || (valueDate && valueDate >= dateFrom)
    const matchesTo = !dateTo || (valueDate && valueDate <= dateTo)

    return matchesStatus && matchesAccount && matchesFrom && matchesTo
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

