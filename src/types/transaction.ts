export type InternalStatus = string

export interface Transaction {
  transactionId: string
  accountId: string
  amount: number
  currency: string
  type: string
  sourceStatus: string | null
  source: string
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
  source?: string
  accountId?: string
  dateFrom?: string
  dateTo?: string
}

export interface TransactionSummary {
  total: number
  new: number
  pending: number
  sent: number
  rejected: number
}

export interface TransactionStatus {
  code: string
  label: string
  description: string | null
  color: string
  sortOrder: number
  systemStatus: boolean
  editable: boolean
  createdAt: string
  updatedAt: string
}
