import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { IngestTransactionPayload } from '../types/transaction'

interface ExcelImportModalProps {
  rows: IngestTransactionPayload[]
  isSubmitting: boolean
  onRowsChange: (rows: IngestTransactionPayload[]) => void
  onClose: () => void
  onSubmit: () => void
}

const columns = [
  { key: 'transactionId', label: 'Transaction ID', type: 'text' },
  { key: 'accountId', label: 'Account ID', type: 'text' },
  { key: 'amount', label: 'Amount', type: 'number' },
  { key: 'source', label: 'Source', type: 'text' },
  { key: 'status', label: 'Status', type: 'text' },
  { key: 'valueDate', label: 'Value Date', type: 'datetime-local' },
  { key: 'Date', label: 'Date', type: 'datetime-local' },
  { key: 'Journal', label: 'Journal', type: 'text' },
  { key: 'Reference', label: 'Reference', type: 'text' },
  { key: 'Journal Items/label', label: 'Journal Items/label', type: 'text' },
  { key: 'Journal Items/Account', label: 'Journal Items/Account', type: 'text' },
  { key: 'Journal Items/Debit', label: 'Debit', type: 'number' },
  { key: 'Journal Items/Credit', label: 'Credit', type: 'number' },
  { key: 'Journal Items/Analytic', label: 'Analytic', type: 'text' },
  { key: 'currency', label: 'Currency', type: 'text' },
  { key: 'type', label: 'Type', type: 'text' },
] as const

type ColumnKey = (typeof columns)[number]['key']

function toInputDate(value?: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toISOString().slice(0, 16)
}

function fromInputValue(key: ColumnKey, value: string) {
  if (key === 'Date' || key === 'valueDate') {
    return value ? new Date(value).toISOString() : null
  }

  if (key === 'Journal Items/Debit' || key === 'Journal Items/Credit' || key === 'amount') {
    return value === '' ? null : Number(value)
  }

  return value
}

function inputValue(row: IngestTransactionPayload, key: ColumnKey) {
  const value = row[key]
  if (key === 'Date' || key === 'valueDate') {
    return toInputDate(value as string | null)
  }

  return value == null ? '' : String(value)
}

export function ExcelImportModal({
  rows,
  isSubmitting,
  onRowsChange,
  onClose,
  onSubmit,
}: ExcelImportModalProps) {
  const [visibleRows, setVisibleRows] = useState(25)
  const invalidCount = useMemo(
    () => rows.filter((row) => !row.transactionId || !row.accountId || !row.amount || !row.type).length,
    [rows],
  )

  const updateCell = (rowIndex: number, key: ColumnKey, value: string) => {
    const nextRows = rows.map((row, index) => {
      if (index !== rowIndex) {
        return row
      }

      const nextValue = fromInputValue(key, value)
      const nextRow = { ...row, [key]: nextValue }

      if (key === 'Journal Items/Account') {
        nextRow.accountId = String(nextValue || 'UNKNOWN')
      }

      if (key === 'Journal Items/label') {
        nextRow.description = String(nextValue || 'Imported journal item')
      }

      if (key === 'Journal Items/Debit' || key === 'Journal Items/Credit' || key === 'amount') {
        const debit = Number(nextRow['Journal Items/Debit'] || 0)
        const credit = Number(nextRow['Journal Items/Credit'] || 0)
        nextRow.amount = debit > 0 ? debit : credit
        nextRow.type = debit > 0 ? 'Debit' : 'Credit'
      }

      if (key === 'Date' || key === 'valueDate') {
        nextRow.valueDate = typeof nextValue === 'string' ? nextValue : null
      }

      return nextRow
    })

    onRowsChange(nextRows)
  }

  const removeRow = (rowIndex: number) => {
    onRowsChange(rows.filter((_, index) => index !== rowIndex))
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#111b45]/40 p-4 backdrop-blur-sm">
      <div className="mx-auto flex max-h-[92vh] w-full max-w-[1600px] flex-col overflow-hidden rounded-2xl border border-[#dfe6f4] bg-white shadow-[0_24px_80px_rgba(17,27,69,0.25)]">
        <header className="flex items-center justify-between gap-4 border-b border-[#dfe6f4] px-6 py-5">
          <div>
            <h2 className="text-xl font-extrabold text-[#111b45]">Review Excel Import</h2>
            <p className="mt-1 text-sm font-medium text-[#617096]">
              Review and edit rows before sending them to the backend as an array.
            </p>
          </div>
          <button
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#dfe6f4] text-[#172452] transition hover:bg-[#f7f8ff]"
            type="button"
            onClick={onClose}
            aria-label="Close import popup"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dfe6f4] px-6 py-4 text-sm font-bold text-[#44527b]">
          <span>{rows.length} rows ready</span>
          {invalidCount ? <span className="text-[#dc2626]">{invalidCount} rows need required fields</span> : null}
        </div>

        <div className="overflow-auto">
          <table className="min-w-[1800px] table-fixed text-left text-sm">
            <thead className="sticky top-0 bg-[#f8fbff] text-[#627194]">
              <tr>
                <th className="h-12 w-16 px-4 font-bold">#</th>
                {columns.map((column) => (
                  <th key={column.key} className="h-12 px-4 font-bold">
                    {column.label}
                  </th>
                ))}
                <th className="h-12 w-24 px-4 font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfe6f4]">
              {rows.slice(0, visibleRows).map((row, rowIndex) => (
                <tr key={`${row.transactionId}-${rowIndex}`} className="bg-white">
                  <td className="px-4 py-3 font-bold text-[#617096]">{rowIndex + 1}</td>
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3">
                      <input
                        className="h-10 w-full rounded-lg border border-[#dfe6f4] bg-white px-3 text-sm font-medium text-[#2d3b68] outline-none focus:border-[#5748f5] focus:ring-2 focus:ring-[#5748f5]/15"
                        type={column.type}
                        step={column.type === 'number' ? '0.0001' : undefined}
                        value={inputValue(row, column.key)}
                        onChange={(event) => updateCell(rowIndex, column.key, event.target.value)}
                      />
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <button
                      className="rounded-lg px-3 py-2 text-sm font-bold text-[#dc2626] transition hover:bg-[#fff1f2]"
                      type="button"
                      onClick={() => removeRow(rowIndex)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#dfe6f4] px-6 py-5">
          <div>
            {visibleRows < rows.length ? (
              <button
                className="rounded-xl border border-[#dfe6f4] bg-white px-5 py-3 text-sm font-bold text-[#493ee8]"
                type="button"
                onClick={() => setVisibleRows((current) => Math.min(current + 25, rows.length))}
              >
                Show more
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <button
              className="rounded-xl border border-[#dfe6f4] bg-white px-5 py-3 text-sm font-bold text-[#172452]"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="rounded-xl bg-gradient-to-br from-[#7254ff] to-[#5237e9] px-6 py-3 text-sm font-extrabold text-white shadow-[0_14px_24px_rgba(88,58,235,0.25)] disabled:opacity-60"
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting || rows.length === 0 || invalidCount > 0}
            >
              Send {rows.length} Rows
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

