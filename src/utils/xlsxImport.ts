import * as XLSX from 'xlsx'
import type { IngestTransactionPayload } from '../types/transaction'

type ExcelRow = Record<string, unknown>

const fieldAliases = {
  transactionId: ['Transaction ID', 'transactionId', 'transaction_id', 'txn_id', 'txn id', 'txn', 'id'],
  accountId: ['Account ID', 'accountId', 'account_id', 'account_number', 'account number', 'account', 'Journal Items/Account'],
  amount: ['Amount', 'amount', 'amt', 'value', 'transaction_amount'],
  type: ['Type', 'type', 'cr_dr', 'cr/dr', 'dr_cr', 'debit_credit', 'debit/credit'],
  status: ['Status', 'status', 'source_status'],
  source: ['Source', 'source', 'channel', 'origin'],
  valueDate: ['Value Date', 'valueDate', 'value_date', 'date', 'Date'],
  createdAt: ['Created At', 'createdAt', 'created_at'],
  journalDate: ['Date', 'date', 'journal_date', 'Journal Date', 'value_date', 'Value Date'],
  journal: ['Journal', 'journal', 'journal_id', 'journal id'],
  reference: ['Reference', 'reference', 'ref', 'journal_id', 'journal id', 'txn_id'],
  itemLabel: ['Journal Items/label', 'itemLabel', 'item_label', 'label', 'description', 'txn_id'],
  itemAccount: ['Journal Items/Account', 'itemAccount', 'item_account', 'account_number', 'account number', 'account', 'Account ID'],
  debit: ['Journal Items/Debit', 'debit', 'Debit', 'dr_amount'],
  credit: ['Journal Items/Credit', 'credit', 'Credit', 'cr_amount'],
  analytic: ['Journal Items/Analytic', 'analytic', 'analytics', 'cost_center'],
} as const

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function findValue(row: ExcelRow, aliases: readonly string[]) {
  const entries = Object.entries(row)
  for (const alias of aliases) {
    const direct = row[alias]
    if (direct != null && direct !== '') {
      return direct
    }

    const normalizedAlias = normalizeKey(alias)
    const match = entries.find(([key, value]) => normalizeKey(key) === normalizedAlias && value != null && value !== '')
    if (match) {
      return match[1]
    }
  }

  return null
}

function textAny(row: ExcelRow, aliases: readonly string[]) {
  const value = findValue(row, aliases)
  if (value == null || value === '') {
    return null
  }
  return String(value).trim()
}

function numberAny(row: ExcelRow, aliases: readonly string[]) {
  const value = findValue(row, aliases)
  if (value == null || value === '') {
    return null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const parsed = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

function excelSerialDate(value: number) {
  const date = new Date(Date.UTC(1899, 11, 30))
  date.setUTCDate(date.getUTCDate() + Math.floor(value))
  return date.toISOString()
}

function parseSlashDate(value: string) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/)
  if (!match) {
    return null
  }

  const [, month, day, year, hour = '0', minute = '0'] = match
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))).toISOString()
}

function dateAny(row: ExcelRow, aliases: readonly string[]) {
  const value = findValue(row, aliases)
  if (value == null || value === '') {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'number') {
    return excelSerialDate(value)
  }

  const asText = String(value).trim()
  if (/^-?\d+(\.\d+)?$/.test(asText)) {
    return excelSerialDate(Number(asText))
  }

  const slashDate = parseSlashDate(asText)
  if (slashDate) {
    return slashDate
  }

  const parsed = new Date(asText)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function normalizeType(value: string | null, amount: number) {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'dr' || normalized === 'debit' || normalized === 'd') {
    return 'Debit'
  }
  if (normalized === 'cr' || normalized === 'credit' || normalized === 'c') {
    return 'Credit'
  }
  return amount < 0 ? 'Debit' : 'Credit'
}

function readWorkbook(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'csv') {
    return file.text().then((content) => XLSX.read(content, { type: 'string', cellDates: true }))
  }

  return file.arrayBuffer().then((content) => XLSX.read(content, { cellDates: true }))
}

function buildTransactionId(row: ExcelRow, rowIndex: number) {
  const transactionId = textAny(row, fieldAliases.transactionId)
  const journal = textAny(row, fieldAliases.journal)
  const account = textAny(row, fieldAliases.accountId)
  const reference = textAny(row, fieldAliases.reference)
  const base = transactionId || reference || journal || 'IMPORT'

  return `${base}-${journal || 'JOURNAL'}-${account || 'ACCOUNT'}-${rowIndex}`
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .slice(0, 128)
}

function parseRow(row: ExcelRow, rowIndex: number): IngestTransactionPayload | null {
  const hasAnyValue = Object.values(row).some((value) => value != null && value !== '')
  if (!hasAnyValue) {
    return null
  }

  const rawAmount = numberAny(row, fieldAliases.amount) ?? 0
  const amount = Math.abs(rawAmount)
  const type = normalizeType(textAny(row, fieldAliases.type), rawAmount)
  const date = dateAny(row, fieldAliases.valueDate)
  const journalDate = dateAny(row, fieldAliases.journalDate) ?? date
  const account = textAny(row, fieldAliases.accountId) || textAny(row, fieldAliases.itemAccount) || 'UNKNOWN'
  const source = textAny(row, fieldAliases.source) || 'Imported File'
  const originalTransactionId = textAny(row, fieldAliases.transactionId)
  const reference = textAny(row, fieldAliases.reference) || originalTransactionId || `IMPORT-${rowIndex}`
  const journal = textAny(row, fieldAliases.journal) || source
  const label = textAny(row, fieldAliases.itemLabel) || originalTransactionId || reference || 'Imported row'
  const explicitDebit = numberAny(row, fieldAliases.debit)
  const explicitCredit = numberAny(row, fieldAliases.credit)
  const debit = explicitDebit ?? (type === 'Debit' ? amount : null)
  const credit = explicitCredit ?? (type === 'Credit' ? amount : null)

  return {
    transactionId: buildTransactionId(row, rowIndex),
    accountId: account,
    amount,
    currency: 'SAR',
    type,
    status: textAny(row, fieldAliases.status) || 'IMPORTED',
    source,
    description: label,
    valueDate: date,
    Date: journalDate,
    Journal: journal,
    Reference: reference,
    'Journal Items/label': label,
    'Journal Items/Account': account,
    'Journal Items/Debit': debit,
    'Journal Items/Credit': credit,
    'Journal Items/Analytic': textAny(row, fieldAliases.analytic),
  }
}

export async function parseExcelToTransactions(file: File): Promise<IngestTransactionPayload[]> {
  const workbook = await readWorkbook(file)
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error('No worksheet found in the imported file')
  }

  const sheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: null, raw: true })

  if (!rows.length) {
    throw new Error('No data rows found in the imported file')
  }

  return rows.flatMap((row, index) => {
    const parsed = parseRow(row, index + 1)
    return parsed ? [parsed] : []
  })
}
