import { Save, X } from 'lucide-react'
import type { FormEvent } from 'react'
import type { Transaction } from '../types/transaction'

interface EditTransactionAmountModalProps {
  transaction: Transaction
  amount: string
  isSubmitting: boolean
  error: string | null
  onAmountChange: (value: string) => void
  onClose: () => void
  onSubmit: () => void
}

export function EditTransactionAmountModal({
  transaction,
  amount,
  isSubmitting,
  error,
  onAmountChange,
  onClose,
  onSubmit,
}: EditTransactionAmountModalProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111b45]/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#dfe6f4] bg-white shadow-[0_24px_80px_rgba(17,27,69,0.25)]">
        <header className="flex items-start justify-between gap-4 border-b border-[#dfe6f4] px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-[#111b45]">Edit Transaction Amount</h2>
            <p className="mt-1 truncate font-mono text-xs font-bold text-[#617096]">{transaction.transactionId}</p>
          </div>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#dfe6f4] text-[#172452] transition hover:bg-[#f7f8ff] disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close edit amount"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <form className="grid gap-4 px-6 py-5" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-bold text-[#18234f]">
            Amount
            <input
              className="h-11 rounded-lg border border-[#dfe6f4] bg-white px-3 font-mono text-sm font-semibold text-[#172452] outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15"
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
              inputMode="decimal"
              autoFocus
            />
          </label>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#dfe6f4] bg-white px-4 text-sm font-extrabold text-[#172452] transition hover:bg-[#f7f8ff] disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-4 text-sm font-extrabold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isSubmitting}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

