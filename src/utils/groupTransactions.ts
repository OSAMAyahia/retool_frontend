import type { Transaction } from '../types/transaction'
import { transactionCrDr } from './tableFields'

export interface TransactionGroup {
  key: string
  valueDate: string | null
  accountId: string
  crDr: string
  totalAmount: number
  transactions: Transaction[]
}

// Purely a display convenience: groups the currently-loaded page of raw transaction legs by
// (value_date, account_number, Debit/Credit) and sums their amounts, so the same account
// moving on the same day doesn't show up as many near-identical rows. This mirrors the
// grouping used when building the actual Odoo submission (see JournalService on the backend),
// but here it only affects what's rendered - it doesn't change the underlying data or which
// rows are "balanced". A group of size 1 renders exactly like an ungrouped row.
export function groupTransactionsForDisplay(transactions: Transaction[]): TransactionGroup[] {
  const groups = new Map<string, TransactionGroup>()

  for (const transaction of transactions) {
    const valueDate = transaction.valueDate ? transaction.valueDate.slice(0, 10) : null
    const accountId = transaction.accountId ?? ''
    const crDr = transactionCrDr(transaction) ?? ''
    const key = `${valueDate ?? ''}|${accountId}|${crDr}`

    const existing = groups.get(key)
    if (existing) {
      existing.totalAmount += transaction.amount
      existing.transactions.push(transaction)
    } else {
      groups.set(key, {
        key,
        valueDate,
        accountId,
        crDr,
        totalAmount: transaction.amount,
        transactions: [transaction],
      })
    }
  }

  return Array.from(groups.values())
}
