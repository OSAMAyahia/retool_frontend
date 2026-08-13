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
  // When this row was received by ingest/import - see TransactionResponse.uploadedAt on the backend.
  uploadedAt?: string | null
  // When this row was actually processed into a journal entry - see TransactionResponse.processedAt.
  processedAt?: string | null
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
  // True only for a synthetic line the backend generated to absorb a small (<= 0.05)
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
  // Best-effort deep link into the Odoo web UI for this entry - only populated once
  // odooReferenceId is set (i.e. the entry has actually been sent to Odoo).
  odooEntryUrl?: string | null
  lines: JournalLine[]
}

// One node of the txn_id -> journal -> account_number tree backing GET /api/v1/journals/grouped.
// Each account-level summary retains its originating txnId/journal (not just the totals).
export interface JournalGroupAccountSummary {
  account: string | null
  totalDebit: number
  totalCredit: number
  txnId: string
  journal: string | null
}

export interface JournalGroupNode {
  txnId: string
  journal: string | null
  accounts: JournalGroupAccountSummary[]
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

// Structured detail for a single rejected import row, alongside the flat `errors: string[]` kept
// on each ingest item for backward compatibility. `field` is best-effort: null when the failure
// isn't attributable to one specific field.
export interface ImportRowError {
  rowNumber: number
  txnId: string | null
  field: string | null
  reason: string
}

// Identifies one row that was skipped during ingest/import because it was a true full-row
// duplicate of an already-accepted row.
export interface DuplicateRowInfo {
  rowNumber: number
  txnId: string | null
}

export interface IngestSummaryResponse {
  received: number
  duplicates: number
  failed: number
  processedAt: string
  items: unknown[]
  // May be empty/undefined on older backend responses - always guard before rendering.
  errorDetails?: ImportRowError[]
  duplicateDetails?: DuplicateRowInfo[]
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
  // Free-text/partial, case-insensitive match against the journal column (Journal page) or the
  // raw_payload journal_id/Journal field (Dashboard) - kept separate from the exact-match
  // `source` field above for backward compatibility with the existing dropdown filter.
  journalId?: string
  // Free-text/partial, case-insensitive match against transaction_id / journal_entries.txn_id.
  transactionId?: string
}

// Whitelisted sort fields the backend accepts - see JournalService.resolveJournalSort and
// TransactionService.resolveTransactionSort. Anything else silently falls back to the default.
export type SortDirection = 'asc' | 'desc'

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

