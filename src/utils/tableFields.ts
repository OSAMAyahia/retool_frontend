import type { Journal, Transaction } from '../types/transaction'

export const dashboardColumnLabels = [
  'transaction date',
  'txn_id',
  'journal_id',
  'amount',
  'records',
  'uploaded date (receiving date)',
  'processing date',
  'odoo reference',
] as const

export const journalColumnLabels = [
  'journal date',
  'txn_id',
  'journal_id',
  'total debit',
  'total credit',
  'lines',
  'created_at',
  'status',
  'odoo reference',
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

// Odoo's JSON-RPC convention returns the literal `false` for an unset field - the backend now
// filters that out at the source (see JournalService.extractReference), but this guards any
// value saved before that fix so it never displays as a reference or builds a broken link.
export function sanitizeOdooReference(value: string | null | undefined) {
  return value && value.toLowerCase() !== 'false' ? value : null
}

export function transactionJournalId(transaction: Transaction) {
  return transaction.journalId ?? textFromRaw(transaction.rawPayload, ['journal_id', 'Journal', 'journal']) ?? ''
}

// The clean, human-entered business txn_id - not transaction.transactionId, which is the
// internally generated storage key (e.g. a stableTransactionId hash like
// "txn100-nz-100-9900000011--50-2026-08-08T00-00-00.000Z" for file-imported legs) and is only
// meant to uniquely identify one raw row, not to be shown to a user as "the" txn_id. Mirrors the
// backend's own effective-txn-id resolution order (coalesce over raw_payload's txn_id/Reference/
// reference/transactionId, see TransactionRepository) so the same row always reads the same
// txn_id everywhere in the UI.
export function transactionTxnId(transaction: Transaction) {
  return (
    textFromRaw(transaction.rawPayload, ['txn_id', 'Reference', 'reference', 'transactionId']) ??
    transaction.transactionId
  )
}

export function transactionDate(transaction: Transaction) {
  return transaction.date ?? transaction.valueDate ?? textFromRaw(transaction.rawPayload, ['date', 'Date']) ?? ''
}

export function transactionCrDr(transaction: Transaction) {
  return transaction.crDr ?? textFromRaw(transaction.rawPayload, ['cr_dr']) ?? transaction.type
}

export function journalAmount(journal: Journal) {
  return Math.max(journal.totalDebit, journal.totalCredit)
}

export function journalCrDr(journal: Journal) {
  return journal.totalDebit === journal.totalCredit ? 'BALANCED' : 'UNBALANCED'
}

export function journalDate(journal: Journal) {
  return journal.journalDate ?? ''
}
