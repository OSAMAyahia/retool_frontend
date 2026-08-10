import axios, { AxiosHeaders } from 'axios'
import type {
  IngestSummaryResponse,
  IngestTransactionPayload,
  Journal,
  PageResponse,
  ProcessingResponse,
  Transaction,
  TransactionFilters,
  TransactionStatus,
} from '../types/transaction'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  timeout: 120000,
})

export const AUTH_TOKEN_STORAGE_KEY = 'retool_odoo_auth_token'

export interface AdminUser {
  id: string
  username: string
  displayName: string
  role: 'ADMIN' | 'USER'
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminConfig {
  odooMaxRetries: number
  odooRetryIntervalMinutes: number
  // Empty/omitted = no restriction, send every optional field to Odoo (current default).
  odooJournalEntryFields?: string[]
}

// Keys must match AdminConfigService.SELECTABLE_ODOO_JOURNAL_ENTRY_FIELDS on the backend. Only
// these 3 fields are actually optional in the real POST /api/journal-entry/create contract -
// there's no journal_name/post/distributions field to toggle, since Odoo resolves those from
// core.banking.mapping.table by account_number.
export const ODOO_JOURNAL_ENTRY_FIELD_OPTIONS: { key: string; label: string }[] = [
  { key: 'ref', label: 'Reference (ref)' },
  { key: 'value_date', label: 'Value date' },
  { key: 'line_name', label: 'Line name' },
]

export interface LoginResponse {
  token: string
  user: AdminUser
}

export interface CreateUserPayload {
  username: string
  password: string
  displayName?: string
  role: 'ADMIN' | 'USER'
  active: boolean
}

export interface UpdateUserPayload {
  password?: string
  displayName?: string
  role?: 'ADMIN' | 'USER'
  active?: boolean
}

export interface CreateStatusPayload {
  code: string
  label: string
  description?: string
  color?: string
  sortOrder?: number
}

export interface UpdateStatusPayload {
  label: string
  description?: string
  color?: string
  sortOrder?: number
}

interface BackendTransaction extends Omit<Transaction, 'source'> {
  source?: string
  date?: string | null
  txn_id?: string
  journal_id?: string | null
  account_number?: string
  cr_dr?: string | null
  value_date?: string | null
  created_at?: string
}

interface BackendPage<T> {
  content?: T[]
  page?: number
  number?: number
  size?: number
  totalElements?: number
  totalPages?: number
}

interface BackendJournal extends Journal {
  txn_id?: string
  journal_id?: string | null
  created_at?: string
}

interface ImportUploadStatus {
  uploadId: string
  status: 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  uploadedChunks: number
  totalChunks: number
  received: number | null
  duplicates: number | null
  failed: number | null
  errorMessage: string | null
  rowsProcessed: number | null
}

export function getStoredAuthToken() {
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
}

export function setStoredAuthToken(token: string | null) {
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
    return
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
}

api.interceptors.request.use((config) => {
  const token = getStoredAuthToken()

  if (token) {
    config.headers = AxiosHeaders.from(config.headers)
    config.headers.set('Authorization', `Bearer ${token}`)
  }

  return config
})

function toDateTimeFrom(value?: string) {
  return value ? `${value}T00:00:00Z` : undefined
}

function toDateTimeTo(value?: string) {
  return value ? `${value}T23:59:59Z` : undefined
}
function normalizeStatus(status: string) {
  if (status === 'FAILED') {
    return 'REJECTED'
  }

  if (status === 'UN_COMPLETED' || status === 'UNCOMPLETED') {
    return 'un-completed'
  }

  return status
}

function normalizeTransaction(transaction: BackendTransaction): Transaction {
  return {
    ...transaction,
    transactionId: transaction.transactionId ?? transaction.txn_id ?? '',
    accountId: transaction.accountId ?? transaction.account_number ?? '',
    date: transaction.date ?? transaction.valueDate ?? transaction.value_date ?? null,
    journalId: transaction.journalId ?? transaction.journal_id ?? null,
    crDr: transaction.crDr ?? transaction.cr_dr ?? transaction.type,
    valueDate: transaction.valueDate ?? transaction.value_date ?? null,
    createdAt: transaction.createdAt ?? transaction.created_at ?? '',
    source: transaction.source ?? 'Excel',
    internalStatus: normalizeStatus(transaction.internalStatus),
  }
}

function normalizeTransactionPage(
  data: BackendPage<BackendTransaction> | BackendTransaction[],
): PageResponse<Transaction> {
  if (Array.isArray(data)) {
    const content = data.map(normalizeTransaction)

    return {
      content,
      page: 0,
      size: content.length,
      totalElements: content.length,
      totalPages: content.length > 0 ? 1 : 0,
    }
  }

  const content = (data.content ?? []).map(normalizeTransaction)

  return {
    content,
    page: data.page ?? data.number ?? 0,
    size: data.size ?? content.length,
    totalElements: data.totalElements ?? content.length,
    totalPages: data.totalPages ?? (content.length > 0 ? 1 : 0),
  }
}

function normalizeJournal(journal: BackendJournal): Journal {
  return {
    ...journal,
    transactionId: journal.transactionId ?? journal.txn_id ?? '',
    journalDate: journal.journalDate ?? null,
    journal: journal.journal ?? journal.journal_id ?? null,
    totalDebit: journal.totalDebit ?? 0,
    totalCredit: journal.totalCredit ?? 0,
    lineCount: journal.lineCount ?? 0,
    errorMessage: journal.errorMessage ?? null,
    lines: journal.lines ?? [],
    createdAt: journal.createdAt ?? journal.created_at ?? '',
  }
}

function normalizeJournalPage(data: BackendPage<BackendJournal> | BackendJournal[]): PageResponse<Journal> {
  if (Array.isArray(data)) {
    const content = data.map(normalizeJournal)

    return {
      content,
      page: 0,
      size: content.length,
      totalElements: content.length,
      totalPages: content.length > 0 ? 1 : 0,
    }
  }

  const content = (data.content ?? []).map(normalizeJournal)

  return {
    content,
    page: data.page ?? data.number ?? 0,
    size: data.size ?? content.length,
    totalElements: data.totalElements ?? content.length,
    totalPages: data.totalPages ?? (content.length > 0 ? 1 : 0),
  }
}

export async function getTransactions(
  filters: TransactionFilters,
  page: number,
  size: number,
): Promise<PageResponse<Transaction>> {
  const response = await api.get<BackendPage<BackendTransaction> | BackendTransaction[]>('/transactions', {
    params: {
      page,
      size,
      internalStatus: filters.internalStatus || undefined,
      source: filters.source || undefined,
      accountId: filters.accountId || undefined,
      dateFrom: toDateTimeFrom(filters.dateFrom),
      dateTo: toDateTimeTo(filters.dateTo),
      notCompletedReason: filters.rejectionReason || undefined,
    },
  })

  return normalizeTransactionPage(response.data)
}

export interface TransactionGroupSummary {
  valueDate: string | null
  accountId: string
  type: string
  totalAmount: number
  recordCount: number
}

// Grouped across the WHOLE filtered dataset in the database (value_date + account_id + type,
// amounts summed), not just the current page - see /transactions/grouped on the backend. Used
// by the Dashboard table so "Total Transactions" isn't undercounted to whatever page size the
// UI happens to be showing.
export async function getTransactionGroups(
  filters: TransactionFilters,
  page: number,
  size: number,
): Promise<PageResponse<TransactionGroupSummary>> {
  const response = await api.get<BackendPage<TransactionGroupSummary>>('/transactions/grouped', {
    params: {
      page,
      size,
      internalStatus: filters.internalStatus || undefined,
      source: filters.source || undefined,
      accountId: filters.accountId || undefined,
      dateFrom: toDateTimeFrom(filters.dateFrom),
      dateTo: toDateTimeTo(filters.dateTo),
      notCompletedReason: filters.rejectionReason || undefined,
    },
  })

  const data = response.data
  const content = data.content ?? []

  return {
    content,
    page: data.page ?? data.number ?? 0,
    size: data.size ?? content.length,
    totalElements: data.totalElements ?? content.length,
    totalPages: data.totalPages ?? (content.length > 0 ? 1 : 0),
  }
}

function createEmptyIngestSummary(): IngestSummaryResponse {
  return {
    received: 0,
    duplicates: 0,
    failed: 0,
    processedAt: new Date().toISOString(),
    items: [],
  }
}

function mergeIngestSummary(
  target: IngestSummaryResponse,
  source: IngestSummaryResponse,
): IngestSummaryResponse {
  target.received += source.received ?? 0
  target.duplicates += source.duplicates ?? 0
  target.failed += source.failed ?? 0
  target.processedAt = source.processedAt ?? target.processedAt
  target.items.push(...(source.items ?? []))
  return target
}

function isTimeoutError(error: unknown) {
  return axios.isAxiosError(error) && error.code === 'ECONNABORTED'
}

async function postIngestBatch(rows: IngestTransactionPayload[]): Promise<IngestSummaryResponse> {
  const response = await api.post<IngestSummaryResponse>('/transactions/ingest', rows, {
    timeout: 120000,
  })
  return response.data
}

async function postAdaptiveIngestBatch(
  rows: IngestTransactionPayload[],
): Promise<IngestSummaryResponse> {
  try {
    return await postIngestBatch(rows)
  } catch (error) {
    if (!isTimeoutError(error) || rows.length <= 1) {
      throw error
    }

    const midpoint = Math.ceil(rows.length / 2)
    const summary = createEmptyIngestSummary()
    mergeIngestSummary(summary, await postAdaptiveIngestBatch(rows.slice(0, midpoint)))
    mergeIngestSummary(summary, await postAdaptiveIngestBatch(rows.slice(midpoint)))
    return summary
  }
}

export async function ingestTransactions(
  rows: IngestTransactionPayload[],
  onProgress?: (sent: number, total: number) => void,
): Promise<IngestSummaryResponse> {
  const batchSize = 25
  const summary = createEmptyIngestSummary()

  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize)
    mergeIngestSummary(summary, await postAdaptiveIngestBatch(batch))
    onProgress?.(Math.min(start + batch.length, rows.length), rows.length)
  }

  return summary
}

export async function importTransactionsFile(
  file: File,
  onProgress?: (
    uploadedBytes: number,
    totalBytes: number,
    phase: 'uploading' | 'processing',
    rowsProcessed?: number,
  ) => void,
): Promise<IngestSummaryResponse> {
  const chunkSize = 5 * 1024 * 1024
  const totalChunks = Math.ceil(file.size / chunkSize)
  const session = await api.post<ImportUploadStatus>('/transactions/import-excel/uploads', {
    fileName: file.name,
    totalSize: file.size,
    chunkSize,
    totalChunks,
  })
  let uploadedBytes = 0
  const uploadedChunkIndices = new Set<number>()

  // A chunk request can fail transiently (proxy hiccup, rate limiting, a dropped
  // connection) without the file itself being at fault. Retry each chunk with
  // exponential backoff + jitter before giving up on it for this pass.
  const uploadChunkOnce = async (chunkIndex: number, attempts = 4) => {
    const start = chunkIndex * chunkSize
    const chunk = file.slice(start, Math.min(start + chunkSize, file.size))
    let lastError: unknown

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        await api.post(
          `/transactions/import-excel/uploads/${session.data.uploadId}/chunks/${chunkIndex}`,
          chunk,
          {
            headers: { 'Content-Type': 'application/octet-stream' },
            timeout: 120000,
          },
        )
        if (!uploadedChunkIndices.has(chunkIndex)) {
          uploadedChunkIndices.add(chunkIndex)
          uploadedBytes += chunk.size
        }
        onProgress?.(Math.min(uploadedBytes, file.size), file.size, 'uploading')
        return
      } catch (error) {
        lastError = error
        if (attempt < attempts - 1) {
          const backoff = Math.min(1000 * 2 ** attempt, 8000)
          const jitter = Math.random() * 400
          await new Promise((resolve) => window.setTimeout(resolve, backoff + jitter))
        }
      }
    }

    throw lastError
  }

  // Upload in a handful of sweeps: any chunk that still fails after its own
  // retries is requeued for the next sweep instead of aborting the whole
  // upload outright. This keeps a burst of transient failures near the end of
  // a large file from discarding everything that already succeeded.
  const maxSweeps = 4
  const concurrency = Math.min(2, totalChunks)
  let pending = Array.from({ length: totalChunks }, (_, index) => index)
  let lastFailure: unknown

  for (let sweep = 0; sweep < maxSweeps && pending.length > 0; sweep += 1) {
    if (sweep > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, 2000 * sweep))
    }
    const queue = [...pending]
    const failedThisSweep: number[] = []

    const worker = async () => {
      while (queue.length > 0) {
        const chunkIndex = queue.shift()
        if (chunkIndex === undefined) {
          return
        }
        try {
          await uploadChunkOnce(chunkIndex)
        } catch (error) {
          lastFailure = error
          failedThisSweep.push(chunkIndex)
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()))
    pending = failedThisSweep
  }

  if (pending.length > 0) {
    throw lastFailure instanceof Error
      ? lastFailure
      : new Error(`Failed to upload ${pending.length} of ${totalChunks} chunk(s) after multiple attempts.`)
  }

  await api.post(`/transactions/import-excel/uploads/${session.data.uploadId}/complete`, undefined, {
    timeout: 120000,
  })
  onProgress?.(file.size, file.size, 'processing')

  for (let poll = 0; poll < 900; poll += 1) {
    const status = await api.get<ImportUploadStatus>(
      `/transactions/import-excel/uploads/${session.data.uploadId}`,
    )
    if (status.data.status === 'COMPLETED') {
      return {
        received: status.data.received ?? 0,
        duplicates: status.data.duplicates ?? 0,
        failed: status.data.failed ?? 0,
        processedAt: new Date().toISOString(),
        items: [],
      }
    }
    if (status.data.status === 'FAILED') {
      throw new Error(status.data.errorMessage || 'Large-file processing failed')
    }
    onProgress?.(file.size, file.size, 'processing', status.data.rowsProcessed ?? undefined)
    await new Promise((resolve) => window.setTimeout(resolve, 2000))
  }

  throw new Error('Large-file processing did not finish within 30 minutes')
}

interface JournalProcessingStatus {
  jobId: string
  status: 'RUNNING' | 'COMPLETED' | 'FAILED'
  processedEntries: number | null
  startedAt: string
  finishedAt: string | null
  errorMessage: string | null
}

// /journals/process now starts a background job and returns immediately instead of blocking
// until the whole backlog is processed - a large backlog could otherwise take well past a
// reverse proxy's timeout and come back as a 504 even though the backend kept working. This
// polls the job to completion so callers can keep the same "await processJournals()" shape.
export async function processJournals(
  onProgress?: (status: 'RUNNING' | 'COMPLETED' | 'FAILED') => void,
): Promise<ProcessingResponse> {
  const start = await api.post<JournalProcessingStatus>('/journals/process')
  const jobId = start.data.jobId
  onProgress?.(start.data.status)

  if (start.data.status === 'COMPLETED') {
    return {
      processed: start.data.processedEntries ?? 0,
      processedAt: start.data.finishedAt ?? new Date().toISOString(),
    }
  }

  for (let poll = 0; poll < 900; poll += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 2000))
    const status = await api.get<JournalProcessingStatus>(`/journals/process/${jobId}`)
    onProgress?.(status.data.status)
    if (status.data.status === 'COMPLETED') {
      return {
        processed: status.data.processedEntries ?? 0,
        processedAt: status.data.finishedAt ?? new Date().toISOString(),
      }
    }
    if (status.data.status === 'FAILED') {
      throw new Error(status.data.errorMessage || 'Journal processing failed')
    }
  }

  throw new Error('Journal processing did not finish within 30 minutes')
}

export async function getJournals(
  filters: TransactionFilters,
  page: number,
  size: number,
): Promise<PageResponse<Journal>> {
  const response = await api.get<BackendPage<BackendJournal> | BackendJournal[]>('/journals', {
    params: {
      page,
      size,
      status: filters.internalStatus || undefined,
      journal: filters.source || undefined,
      account: filters.accountId || undefined,
      dateFrom: toDateTimeFrom(filters.dateFrom),
      dateTo: toDateTimeTo(filters.dateTo),
      rejectionReason: filters.rejectionReason || undefined,
    },
  })

  return normalizeJournalPage(response.data)
}

export async function getJournalById(transactionId: string): Promise<Journal> {
  const response = await api.get<BackendJournal>(`/journals/${encodeURIComponent(transactionId)}`)
  return normalizeJournal(response.data)
}

// Backed by the dedicated archive tables (see JournalStatusService.markSent), not a status=SENT
// filter over /journals - a sent entry is moved OUT of the live journal_entries/journals tables
// the instant it's sent, so it would never show up there again regardless of filter.
export async function getArchive(
  filters: { source?: string; accountId?: string; dateFrom?: string; dateTo?: string },
  page: number,
  size: number,
): Promise<PageResponse<Journal>> {
  const response = await api.get<BackendPage<BackendJournal> | BackendJournal[]>('/archive', {
    params: {
      page,
      size,
      journal: filters.source || undefined,
      account: filters.accountId || undefined,
      dateFrom: toDateTimeFrom(filters.dateFrom),
      dateTo: toDateTimeTo(filters.dateTo),
    },
  })

  return normalizeJournalPage(response.data)
}

export async function getArchivedJournalById(transactionId: string): Promise<Journal> {
  const response = await api.get<BackendJournal>(`/archive/${encodeURIComponent(transactionId)}`)
  return normalizeJournal(response.data)
}

// /journals/send-to-odoo now starts a background job for the same reason
// /journals/process does (see processJournals above): a large backlog of entries, each
// requiring its own external Odoo call, can take well past a reverse proxy's timeout.
export async function sendJournalsToOdoo(
  onProgress?: (status: 'RUNNING' | 'COMPLETED' | 'FAILED') => void,
  // Omitted/empty = no selection, send every eligible (NEW/REJECTED) entry (current default).
  // Pass specific transaction ids to send only those.
  transactionIds?: string[],
): Promise<ProcessingResponse> {
  const start = await api.post<JournalProcessingStatus>(
    '/journals/send-to-odoo',
    transactionIds && transactionIds.length > 0 ? { transactionIds } : undefined,
  )
  const jobId = start.data.jobId
  onProgress?.(start.data.status)

  if (start.data.status === 'COMPLETED') {
    return {
      processed: start.data.processedEntries ?? 0,
      processedAt: start.data.finishedAt ?? new Date().toISOString(),
    }
  }

  for (let poll = 0; poll < 900; poll += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 2000))
    const status = await api.get<JournalProcessingStatus>(`/journals/send-to-odoo/${jobId}`)
    onProgress?.(status.data.status)
    if (status.data.status === 'COMPLETED') {
      return {
        processed: status.data.processedEntries ?? 0,
        processedAt: status.data.finishedAt ?? new Date().toISOString(),
      }
    }
    if (status.data.status === 'FAILED') {
      throw new Error(status.data.errorMessage || 'Sending journals to Odoo failed')
    }
  }

  throw new Error('Sending journals to Odoo did not finish within 30 minutes')
}

// Manual archiving only - the user selects specific SENT rows in the Journal Table and presses
// an Archive button. Never called automatically after sendJournalsToOdoo above; sending and
// archiving are two separate, deliberate actions.
export async function archiveJournals(transactionIds: string[]): Promise<{ archived: number; skipped: string[] }> {
  const response = await api.post<{ archived: number; skipped: string[] }>('/journals/archive', { transactionIds })
  return response.data
}

// Manual unarchiving only - the user selects specific rows on the Archive page and presses an
// Unarchive button. Moves the entries back out of the archive tables into the live
// journal_entries/journals tables, the reverse of archiveJournals above.
export async function unarchiveJournals(transactionIds: string[]): Promise<{ unarchived: number; skipped: string[] }> {
  const response = await api.post<{ unarchived: number; skipped: string[] }>('/archive/unarchive', { transactionIds })
  return response.data
}

export async function getTransactionById(transactionId: string): Promise<Transaction> {
  const response = await api.get<BackendTransaction>(`/transactions/${encodeURIComponent(transactionId)}`)
  return normalizeTransaction(response.data)
}

export async function retryTransaction(transactionId: string): Promise<Transaction | null> {
  const response = await api.post<Transaction | null>(
    `/transactions/${encodeURIComponent(transactionId)}/retry`,
  )
  return response.data ? normalizeTransaction(response.data as BackendTransaction) : null
}

export async function getStatuses(): Promise<TransactionStatus[]> {
  const response = await api.get<TransactionStatus[]>('/statuses')
  return response.data
}

export async function getSources(): Promise<string[]> {
  const response = await api.get<string[]>('/transactions/sources')
  return response.data
}

// Deduplicated account_numbers currently held back because they have no Odoo mapping-table
// record - backs the "Not Mapped Accounts" popup.
export async function getNotMappedAccounts(): Promise<string[]> {
  const response = await api.get<string[]>('/transactions/not-mapped-accounts')
  return response.data
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/admin/auth/login', { username, password })
  setStoredAuthToken(response.data.token)
  return response.data
}

export async function getCurrentUser(): Promise<AdminUser> {
  const response = await api.get<AdminUser>('/admin/auth/me')
  return response.data
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const response = await api.get<AdminUser[]>('/admin/users')
  return response.data
}

export async function createAdminUser(payload: CreateUserPayload): Promise<AdminUser> {
  const response = await api.post<AdminUser>('/admin/users', payload)
  return response.data
}

export async function updateAdminUser(id: string, payload: UpdateUserPayload): Promise<AdminUser> {
  const response = await api.put<AdminUser>(`/admin/users/${id}`, payload)
  return response.data
}

export async function getAdminConfig(): Promise<AdminConfig> {
  const response = await api.get<AdminConfig>('/admin/config')
  return response.data
}

export async function updateAdminConfig(payload: AdminConfig): Promise<AdminConfig> {
  const response = await api.put<AdminConfig>('/admin/config', payload)
  return response.data
}

export async function createTransactionStatus(
  payload: CreateStatusPayload,
): Promise<TransactionStatus> {
  const response = await api.post<TransactionStatus>('/admin/statuses', payload)
  return response.data
}

export async function updateTransactionStatus(
  code: string,
  payload: UpdateStatusPayload,
): Promise<TransactionStatus> {
  const response = await api.put<TransactionStatus>(`/admin/statuses/${encodeURIComponent(code)}`, payload)
  return response.data
}





