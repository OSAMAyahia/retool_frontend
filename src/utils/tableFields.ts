import type { Journal, Transaction } from '../types/transaction'

export const dashboardColumnLabels = [
  'transaction date',
  'txn_id',
  'journal_id',
  'account_number',
  'amount',
  'cr_dr',
  'value_date',
  'created_at',
] as const

function rawObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function textFromRaw(raw: unknown, keys: string[]) {
  const payload = rawObject(raw)

  for (const key of keys) {
    const value = payload[key]
    if (value != null && value !== '') {
      return String(value)
    }
  }

  return null
}

export function displayDate(value: string | null | undefined) {
  return value ?? ''
}

export function transactionJournalId(transaction: Transaction) {
  return transaction.journalId ?? textFromRaw(transaction.rawPayload, ['journal_id', 'Journal', 'journal']) ?? ''
}

export function transactionDate(transaction: Transaction) {
  return transaction.date ?? transaction.valueDate ?? textFromRaw(transaction.rawPayload, ['date', 'Date']) ?? ''
}

export function transactionCrDr(transaction: Transaction) {
  return transaction.crDr ?? textFromRaw(transaction.rawPayload, ['cr_dr']) ?? transaction.type
}

export function journalAmount(journal: Journal) {
  return journal.amount ?? journal.debit ?? journal.credit ?? null
}

export function journalCrDr(journal: Journal) {
  return journal.crDr ?? (journal.debit != null ? 'DR' : journal.credit != null ? 'CR' : '')
}

export function journalDate(journal: Journal) {
  return journal.date ?? journal.journalDate ?? ''
}
