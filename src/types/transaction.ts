export type InternalStatus = string

export interface Transaction {
  transactionId: string
  accountId: string
  amount: number
  currency: string
  type: string
  date?: string | null
  journalId?: string | null
  crDr?: string | null
  sourceStatus: string | null
  source: string
  internalStatus: InternalStatus
  description: string | null
  valueDate: string | null
  retryCount: number
  lastError: string | null
  notCompletedReason?: 'NOT_MAPPED' | 'NOT_BALANCED' | 'DIFFERENCE_ACCOUNT_MISSING' | 'OTHER' | null
  odooReferenceId: string | null
  createdAt: string
  updatedAt: string
  rawPayload?: unknown
}

export interface JournalLine {
  transactionId: string
  itemLabel: string | null
  itemAccount: string | null
  debit: number | null
  credit: number | null
  analytic: string | null
  rawPayload?: unknown
  // True only for a synthetic line the backend generated to absorb a small (<= 0.5)
  // debit/credit rounding gap on the mapping table's designated difference account.
  difference?: boolean
}

export interface Journal {
  transactionId: string
  journalDate: string | null
  journal: string | null
  reference: string | null
  totalDebit: number
  totalCredit: number
  lineCount: number
  status: string
  errorMessage: string | null
  rejectionReason?: 'NOT_MAPPED' | 'NOT_BALANCED' | 'OTHER' | null
  odooReferenceId: string | null
  createdAt: string
  updatedAt: string
  lines: JournalLine[]
}


export interface IngestTransactionPayload {
  date?: string | null
  txn_id?: string
  journal_id?: string
  account_number?: string | null
  cr_dr?: string
  value_date?: string | null
  created_at?: string | null
  transactionId?: string
  accountId?: string
  amount: number
  currency?: string
  type?: string
  status?: string | null
  source?: string
  description?: string | null
  valueDate?: string | null
  Date?: string | null
  Journal?: string | null
  Reference?: string | null
  'Journal Items/label'?: string | null
  'Journal Items/Account'?: string | null
  'Journal Items/Debit'?: number | null
  'Journal Items/Credit'?: number | null
  'Journal Items/Analytic'?: string | null
  distributions?: Record<string, number> | null
}
export interface ProcessingResponse {
  processed: number
  processedAt: string
}

export interface IngestSummaryResponse {
  received: number
  duplicates: number
  failed: number
  processedAt: string
  items: unknown[]
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
  // Journal-only: narrows REJECTED entries down to a specific cause ("NOT_MAPPED" | "NOT_BALANCED").
  rejectionReason?: string
}

export interface TransactionSummary {
  total: number
  completed: number
  unCompleted: number
  journalRows: number
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

