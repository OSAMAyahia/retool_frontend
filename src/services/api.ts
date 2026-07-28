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
}

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
    },
  })

  return normalizeTransactionPage(response.data)
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
  const chunkSize = 2 * 1024 * 1024
  const totalChunks = Math.ceil(file.size / chunkSize)
  const session = await api.post<ImportUploadStatus>('/transactions/import-excel/uploads', {
    fileName: file.name,
    totalSize: file.size,
    chunkSize,
    totalChunks,
  })
  let nextChunkIndex = 0
  let uploadedBytes = 0

  const uploadChunk = async (chunkIndex: number) => {
    const start = chunkIndex * chunkSize
    const chunk = file.slice(start, Math.min(start + chunkSize, file.size))
    let lastError: unknown

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await api.post(
          `/transactions/import-excel/uploads/${session.data.uploadId}/chunks/${chunkIndex}`,
          chunk,
          {
            headers: { 'Content-Type': 'application/octet-stream' },
            timeout: 120000,
          },
        )
        uploadedBytes += chunk.size
        onProgress?.(Math.min(uploadedBytes, file.size), file.size, 'uploading')
        return
      } catch (error) {
        lastError = error
        if (attempt < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)))
        }
      }
    }

    throw lastError
  }

  const worker = async () => {
    while (true) {
      const chunkIndex = nextChunkIndex
      nextChunkIndex += 1
      if (chunkIndex >= totalChunks) {
        return
      }
      await uploadChunk(chunkIndex)
    }
  }

  await Promise.all(Array.from({ length: Math.min(3, totalChunks) }, () => worker()))
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

export async function processJournals(): Promise<ProcessingResponse> {
  const response = await api.post<ProcessingResponse>('/journals/process')
  return response.data
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
    },
  })

  return normalizeJournalPage(response.data)
}

export async function getJournalById(transactionId: string): Promise<Journal> {
  const response = await api.get<BackendJournal>(`/journals/${encodeURIComponent(transactionId)}`)
  return normalizeJournal(response.data)
}

export async function sendJournalsToOdoo(): Promise<ProcessingResponse> {
  const response = await api.post<ProcessingResponse>('/journals/send-to-odoo')
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






