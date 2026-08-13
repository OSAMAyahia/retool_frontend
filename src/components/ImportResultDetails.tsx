import { AlertTriangle, Copy } from 'lucide-react'
import type { IngestSummaryResponse } from '../types/transaction'

interface ImportResultDetailsProps {
  summary: IngestSummaryResponse
}

// Renders the structured per-row breakdown of the last import - errorDetails (row/txnId/field/
// reason) as a table and duplicateDetails (rowNumber/txnId) as an explicit list, instead of the
// flat summary counts/strings shown elsewhere. Both arrays are optional on IngestSummaryResponse
// (older backend responses, or paths that never populate them) so this renders nothing rather
// than crashing when they're missing/empty.
export function ImportResultDetails({ summary }: ImportResultDetailsProps) {
  const errorDetails = summary.errorDetails ?? []
  const duplicateDetails = summary.duplicateDetails ?? []

  if (errorDetails.length === 0 && duplicateDetails.length === 0) {
    return null
  }

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      {errorDetails.length > 0 ? (
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

      {duplicateDetails.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-[#ffe3ad] bg-[#fff9ec]">
          <div className="flex items-center gap-2 border-b border-[#ffe3ad] px-5 py-3">
            <Copy className="h-4 w-4 text-[#b45309]" aria-hidden="true" />
            <h3 className="text-sm font-extrabold text-[#8a5a00]">
              Skipped duplicate rows ({duplicateDetails.length})
            </h3>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <ul className="divide-y divide-[#ffedc2]">
              {duplicateDetails.map((detail, index) => (
                <li key={`${detail.rowNumber}-${index}`} className="flex items-center justify-between gap-3 px-5 py-2 text-xs">
                  <span className="font-bold text-[#8a5a00]">Row {detail.rowNumber}</span>
                  <span className="font-mono font-semibold text-[#8a5a00]">{detail.txnId ?? '-'}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  )
}
