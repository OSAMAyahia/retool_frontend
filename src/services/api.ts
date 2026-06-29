import axios from 'axios'
import type {
  PageResponse,
  Transaction,
  TransactionFilters,
} from '../types/transaction'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1',
  timeout: 10000,
})

interface BackendPage<T> {
  content?: T[]
  page?: number
  number?: number
  size?: number
  totalElements?: number
  totalPages?: number
}

function normalizePage(data: BackendPage<Transaction> | Transaction[]): PageResponse<Transaction> {
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
  const response = await api.get<BackendPage<Transaction> | Transaction[]>('/transactions', {
    params: {
      page,
      size,
      internalStatus: filters.internalStatus || undefined,
      accountId: filters.accountId || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    },
  })

  return normalizePage(response.data)
}

export async function getTransactionById(transactionId: string): Promise<Transaction> {
  const response = await api.get<Transaction>(`/transactions/${encodeURIComponent(transactionId)}`)
  return response.data
}

export async function retryTransaction(transactionId: string): Promise<Transaction | null> {
  const response = await api.post<Transaction | null>(
    `/transactions/${encodeURIComponent(transactionId)}/retry`,
  )
  return response.data
}

