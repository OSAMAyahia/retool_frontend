import { AlertTriangle, Copy } from 'lucide-react'
import type { DuplicateRowInfo, IngestSummaryResponse } from '../types/transaction'

interface ImportResultDetailsProps {
  summary: IngestSummaryResponse
}

function formatCellValue(value: unknown) {
  if (value == null || value === '') {
    return '-'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

// The union of every key seen across all rows, in first-seen order - different rows in the same
// import can have slightly different fields present, so this is built from all of them rather
// than assuming the first row's keys cover every column.
function collectRowColumns(duplicateDetails: DuplicateRowInfo[]) {
  const columns: string[] = []
  const seen = new Set<string>()
  for (const detail of duplicateDetails) {
    if (!detail.row) {
      continue
    }
    for (const key of Object.keys(detail.row)) {
      if (!seen.has(key)) {
        seen.add(key)
        columns.push(key)
      }
    }
  }
  return columns
}

// Renders the structured per-row breakdown of the last import - errorDetails (row/txnId/field/
// reason) as a table, and duplicateDetails as a table with one column per original field the
// skipped row had (its full header, not just txn_id) - instead of the flat summary counts/
// strings shown elsewhere. Both arrays are optional on IngestSummaryResponse (older backend
// responses, or paths that never populate them) so this renders nothing rather than crashing
// when they're missing/empty.
export function ImportResultDetails({ summary }: ImportResultDetailsProps) {
  const errorDetails = summary.errorDetails ?? []
  const duplicateDetails = summary.duplicateDetails ?? []
  const hasErrorDetails = errorDetails.length > 0
  const hasDuplicateDetails = duplicateDetails.length > 0
  const duplicateRowColumns = collectRowColumns(duplicateDetails)

  if (!hasErrorDetails && !hasDuplicateDetails) {
    return null
  }

  // A duplicate table with its full original columns can get wide - never squeeze it into a
  // half-width grid cell alongside the errors table, always give it the full row to itself.
  const useSideBySideLayout = hasErrorDetails && hasDuplicateDetails && duplicateRowColumns.length === 0

  return (
    <div className={`mt-4 grid gap-4 ${useSideBySideLayout ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
      {hasErrorDetails ? (
        <section className="overflow-hidden rounded-2xl border border-[#ffb8c2] bg-[#fff1f2]">
          <div className="flex items-center gap-2 border-b border-[#ffb8c2] px-5 py-3">
            <AlertTriangle className="h-4 w-4 text-[#dc2626]" aria-hidden="true" />
            <h3 className="text-sm font-extrabold text-[#a8112c]">
              Rejected rows ({errorDetails.length})
            </h3>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#fff1f2] text-[#a8112c]">
                <tr>
                  <th className="px-4 py-2 font-bold">Row</th>
                  <th className="px-4 py-2 font-bold">txn_id</th>
                  <th className="px-4 py-2 font-bold">Field</th>
                  <th className="px-4 py-2 font-bold">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ffd4dc]">
                {errorDetails.map((detail, index) => (
                  <tr key={`${detail.rowNumber}-${index}`}>
                    <td className="px-4 py-2 font-bold text-[#7a0f24]">{detail.rowNumber}</td>
                    <td className="px-4 py-2 font-mono font-semibold text-[#7a0f24]">{detail.txnId ?? '-'}</td>
                    <td className="px-4 py-2 font-semibold text-[#7a0f24]">{detail.field ?? '-'}</td>
                    <td className="px-4 py-2 text-[#7a0f24]">{detail.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {hasDuplicateDetails ? (
        <section className="overflow-hidden rounded-2xl border border-[#ffe3ad] bg-[#fff9ec]">
          <div className="flex items-center gap-2 border-b border-[#ffe3ad] px-5 py-3">
            <Copy className="h-4 w-4 text-[#b45309]" aria-hidden="true" />
            <h3 className="text-sm font-extrabold text-[#8a5a00]">
              Skipped duplicate rows ({duplicateDetails.length})
            </h3>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#fff9ec] text-[#8a5a00]">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2 font-bold">Row</th>
                  {duplicateRowColumns.length > 0 ? (
                    duplicateRowColumns.map((column) => (
                      <th key={column} className="whitespace-nowrap px-4 py-2 font-bold">
                        {column}
                      </th>
                    ))
                  ) : (
                    <th className="whitespace-nowrap px-4 py-2 font-bold">txn_id</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ffedc2]">
                {duplicateDetails.map((detail, index) => (
                  <tr key={`${detail.rowNumber}-${index}`}>
                    <td className="whitespace-nowrap px-4 py-2 font-bold text-[#8a5a00]">{detail.rowNumber}</td>
                    {duplicateRowColumns.length > 0 ? (
                      duplicateRowColumns.map((column) => (
                        <td key={column} className="whitespace-nowrap px-4 py-2 font-mono font-semibold text-[#8a5a00]">
                          {formatCellValue(detail.row?.[column])}
                        </td>
                      ))
                    ) : (
                      <td className="min-w-0 break-all px-4 py-2 font-mono font-semibold text-[#8a5a00]">
                        {detail.txnId ?? '-'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  )
}
