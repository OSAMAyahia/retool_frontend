import * as XLSX from 'xlsx'
import type { IngestTransactionPayload } from '../types/transaction'

type ExcelRow = Record<string, unknown>

function text(row: ExcelRow, key: string) {
  const value = row[key]
  if (value == null || value === '') {
    return null
  }
  return String(value)
}

function numberValue(row: ExcelRow, key: string) {
  const value = row[key]
  if (value == null || value === '') {
    return null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const parsed = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function excelSerialDate(value: number) {
  const date = new Date(Date.UTC(1899, 11, 30))
  date.setUTCDate(date.getUTCDate() + Math.floor(value))
  return date.toISOString()
}

function dateValue(row: ExcelRow) {
  const value = row.Date
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

  const parsed = new Date(asText)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}


function isTransactionExportRow(row: ExcelRow) {
  return 'Transaction ID' in row || 'Account ID' in row || 'Amount' in row || 'Value Date' in row
}

function transactionDateValue(row: ExcelRow, key: string) {
  const value = row[key]
  if (value == null || value === '') {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'number') {
    return excelSerialDate(value)
  }

  const parsed = new Date(String(value).trim())
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function parseTransactionExportRow(row: ExcelRow, rowIndex: number): IngestTransactionPayload {
  const signedAmount = numberValue(row, 'Amount') ?? 0
  const absoluteAmount = Math.abs(signedAmount)
  const declaredType = text(row, 'Type')
  const type = declaredType || (signedAmount < 0 ? 'Debit' : 'Credit')
  const valueDate = transactionDateValue(row, 'Value Date')

  return {
    transactionId: text(row, 'Transaction ID') || `EXCEL-TXN-${rowIndex}`,
    accountId: text(row, 'Account ID') || 'UNKNOWN',
    amount: absoluteAmount,
    currency: 'SAR',
    type,
    status: text(row, 'Status') || 'IMPORTED',
    source: text(row, 'Source') || 'Excel',
    description: text(row, 'Transaction ID') || 'Imported transaction',
    valueDate,
    Date: valueDate,
    Journal: text(row, 'Source') || 'Imported Transactions',
    Reference: text(row, 'Transaction ID') || `EXCEL-TXN-${rowIndex}`,
    'Journal Items/label': text(row, 'Transaction ID') || 'Imported transaction',
    'Journal Items/Account': text(row, 'Account ID') || 'UNKNOWN',
    'Journal Items/Debit': type.toLowerCase() === 'debit' ? absoluteAmount : null,
    'Journal Items/Credit': type.toLowerCase() === 'credit' ? absoluteAmount : null,
    'Journal Items/Analytic': null,
  }
}
function buildTransactionId(row: ExcelRow, rowIndex: number) {
  const reference = text(row, 'Reference') || 'EXCEL'
  const label = text(row, 'Journal Items/label') || 'ROW'
  const account = text(row, 'Journal Items/Account') || 'ACCOUNT'
  return `EXCEL-${reference}-${label}-${account}-${rowIndex}`.replace(/\s+/g, '-').slice(0, 128)
}

export async function parseExcelToTransactions(file: File): Promise<IngestTransactionPayload[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error('No worksheet found in xlsx file')
  }

  const sheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: null, raw: true })

  if (!rows.length) {
    throw new Error('No data rows found in xlsx file')
  }

  return rows.flatMap((row, index) => {
    const hasAnyValue = Object.values(row).some((value) => value != null && value !== '')
    if (!hasAnyValue) {
      return []
    }

    if (isTransactionExportRow(row)) {
      return [parseTransactionExportRow(row, index + 1)]
    }

    const debit = numberValue(row, 'Journal Items/Debit')
    const credit = numberValue(row, 'Journal Items/Credit')
    const amount = debit && debit > 0 ? debit : credit && credit > 0 ? credit : 0
    const type = debit && debit > 0 ? 'Debit' : 'Credit'
    const date = dateValue(row)
    const label = text(row, 'Journal Items/label')
    const account = text(row, 'Journal Items/Account')

    return [{
      transactionId: buildTransactionId(row, index + 1),
      accountId: account || 'UNKNOWN',
      amount,
      currency: 'SAR',
      type,
      status: 'IMPORTED',
      source: 'Excel',
      description: label || 'Imported journal item',
      valueDate: date,
      Date: date,
      Journal: text(row, 'Journal'),
      Reference: text(row, 'Reference'),
      'Journal Items/label': label,
      'Journal Items/Account': account,
      'Journal Items/Debit': debit,
      'Journal Items/Credit': credit,
      'Journal Items/Analytic': text(row, 'Journal Items/Analytic'),
    }]
  })
}

