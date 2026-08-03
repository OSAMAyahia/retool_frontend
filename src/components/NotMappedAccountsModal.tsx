import { AlertTriangle, X } from 'lucide-react'

interface NotMappedAccountsModalProps {
  accounts: string[]
  isLoading: boolean
  onClose: () => void
}

// Lists every distinct account_number currently held back because it has no record in the Odoo
// mapping table (core.banking.mapping.table) - deduplicated, since the same unmapped account can
// show up on hundreds of transaction rows.
export function NotMappedAccountsModal({ accounts, isLoading, onClose }: NotMappedAccountsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111b45]/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#dfe6f4] bg-white shadow-[0_24px_80px_rgba(17,27,69,0.25)]">
        <header className="flex items-center justify-between gap-4 border-b border-[#dfe6f4] px-6 py-5">
          <div>
            <h2 className="text-lg font-extrabold text-[#111b45]">Not Mapped Accounts</h2>
            <p className="mt-1 text-sm font-medium text-[#617096]">
              Account numbers with no record in the Odoo mapping table
            </p>
          </div>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#dfe6f4] text-[#172452] transition hover:bg-[#f7f8ff]"
            type="button"
            onClick={onClose}
            aria-label="Close not mapped accounts popup"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="grid gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
              No unmapped accounts right now.
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
              {accounts.map((account) => (
                <li key={account} className="px-4 py-3 font-mono text-sm font-semibold text-slate-900">
                  {account}
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-[#dfe6f4] px-6 py-4 text-xs font-medium text-[#617096]">
          {accounts.length} account{accounts.length === 1 ? '' : 's'}
        </footer>
      </div>
    </div>
  )
}
