export type InternalStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED'

export interface Transaction {
  transactionId: string
  accountId: string
  amount: number
  currency: string
  type: string
  sourceStatus: string | null
  internalStatus: InternalStatus
  description: string | null
  valueDate: string | null
  retryCount: number
  lastError: string | null
  odooReferenceId: string | null
  createdAt: string
  updatedAt: string
  rawPayload?: unknown
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface TransactionFilters {
  internalStatus?: InternalStatus | ''
  accountId?: string
  dateFrom?: string
  dateTo?: string
}

export interface TransactionSummary {
  total: number
  pending: number
  sent: number
  failed: number
}

