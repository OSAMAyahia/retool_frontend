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
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1',
  timeout: 30000,
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
}

interface BackendPage<T> {
  content?: T[]
  page?: number
  number?: number
  size?: number
  totalElements?: number
  totalPages?: number
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

function normalizeJournalPage(data: BackendPage<Journal> | Journal[]): PageResponse<Journal> {
  if (Array.isArray(data)) {
    return {
      content: data,
      page: 0,
      size: data.length,
      totalElements: data.length,
      totalPages: data.length > 0 ? 1 : 0,
    }
  }

  const content = data.content ?? []

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

export async function ingestTransactions(
  rows: IngestTransactionPayload[],
): Promise<IngestSummaryResponse> {
  const response = await api.post<IngestSummaryResponse>('/transactions/ingest', rows)
  return response.data
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
  const response = await api.get<BackendPage<Journal> | Journal[]>('/journals', {
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




