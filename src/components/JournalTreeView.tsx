import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getJournalsGrouped } from '../services/api'
import type { JournalGroupNode, TransactionFilters } from '../types/transaction'

interface JournalTreeViewProps {
  filters: TransactionFilters
}

interface TxnNode {
  txnId: string
  journals: JournalGroupNode[]
  totalDebit: number
  totalCredit: number
}

function formatMoney(value: number | null | undefined) {
  if (value == null) {
    return '-'
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// The grouped API returns a flat list of {txnId, journal, accounts[]} records - one per
// txn_id/journal pair. This re-nests them into a txn_id -> journal -> account_number tree so
// the tree view can show one row per txn_id at the top level (the common case is one journal
// per txn_id, but the tree still copes if a txn_id ever spans more than one journal).
function buildTree(nodes: JournalGroupNode[]): TxnNode[] {
  const order: string[] = []
  const map = new Map<string, TxnNode>()

  for (const node of nodes) {
    let entry = map.get(node.txnId)
    if (!entry) {
      entry = { txnId: node.txnId, journals: [], totalDebit: 0, totalCredit: 0 }
      map.set(node.txnId, entry)
      order.push(node.txnId)
    }
    entry.journals.push(node)
    for (const account of node.accounts) {
      entry.totalDebit += account.totalDebit ?? 0
      entry.totalCredit += account.totalCredit ?? 0
    }
  }

  return order.map((txnId) => map.get(txnId)!)
}

function journalTotals(node: JournalGroupNode) {
  return node.accounts.reduce(
    (totals, account) => ({
      debit: totals.debit + (account.totalDebit ?? 0),
      credit: totals.credit + (account.totalCredit ?? 0),
    }),
    { debit: 0, credit: 0 },
  )
}

export function JournalTreeView({ filters }: JournalTreeViewProps) {
  const [nodes, setNodes] = useState<JournalGroupNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedTxns, setExpandedTxns] = useState<Set<string>>(new Set())
  const [expandedJournals, setExpandedJournals] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    getJournalsGrouped(filters, 0, 200)
      .then((response) => {
        if (!cancelled) {
          setNodes(response.content)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNodes([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [filters])

  const tree = useMemo(() => buildTree(nodes), [nodes])

  const toggleTxn = (txnId: string) => {
    setExpandedTxns((current) => {
      const next = new Set(current)
      if (next.has(txnId)) {
        next.delete(txnId)
      } else {
        next.add(txnId)
      }
      return next
    })
  }

  const toggleJournal = (key: string) => {
    setExpandedJournals((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="max-h-[720px] overflow-y-auto bg-white p-5">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="mb-2 h-12 animate-pulse rounded-lg bg-[#eef3fb]" />
        ))}
      </div>
    )
  }

  if (tree.length === 0) {
    return (
      <div className="bg-white px-5 py-14 text-center text-sm font-semibold text-[#657295]">
        No journal entries found.
      </div>
    )
  }

  return (
    <div className="max-h-[720px] overflow-y-auto bg-white">
      <ul className="divide-y divide-[#edf1f8]">
        {tree.map((txnNode) => {
          const isTxnOpen = expandedTxns.has(txnNode.txnId)
          return (
            <li key={txnNode.txnId}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left transition hover:bg-[#f8fbff]"
                onClick={() => toggleTxn(txnNode.txnId)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {isTxnOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-[#5748f5]" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#5748f5]" aria-hidden="true" />
                  )}
                  <span className="truncate font-mono text-[13px] font-extrabold text-[#15214b]">
                    txn_id: {txnNode.txnId}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-bold tabular-nums text-[#33406f]">
                  Debit {formatMoney(txnNode.totalDebit)} · Credit {formatMoney(txnNode.totalCredit)}
                </span>
              </button>

              {isTxnOpen ? (
                <ul className="border-t border-[#edf1f8] bg-[#fbfcff]">
                  {txnNode.journals.map((journalNode, journalIndex) => {
                    const journalKey = `${txnNode.txnId}::${journalNode.journal ?? ''}::${journalIndex}`
                    const isJournalOpen = expandedJournals.has(journalKey)
                    const totals = journalTotals(journalNode)
                    return (
                      <li key={journalKey}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-4 py-2.5 pl-11 pr-5 text-left transition hover:bg-[#f1f5fb]"
                          onClick={() => toggleJournal(journalKey)}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            {isJournalOpen ? (
                              <ChevronDown className="h-4 w-4 shrink-0 text-[#5748f5]" aria-hidden="true" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-[#5748f5]" aria-hidden="true" />
                            )}
                            <span className="truncate text-[13px] font-bold text-[#2d3b68]">
                              journal: {journalNode.journal ?? '-'}
                              <span className="ml-2 font-mono text-xs font-semibold text-[#8290b4]">
                                (txn_id {journalNode.txnId})
                              </span>
                            </span>
                          </span>
                          <span className="shrink-0 text-xs font-bold tabular-nums text-[#33406f]">
                            Debit {formatMoney(totals.debit)} · Credit {formatMoney(totals.credit)}
                          </span>
                        </button>

                        {isJournalOpen ? (
                          <ul className="divide-y divide-[#edf1f8] border-t border-[#edf1f8] bg-white">
                            {journalNode.accounts.length === 0 ? (
                              <li className="py-3 pl-[4.5rem] pr-5 text-xs font-semibold text-[#8290b4]">
                                No account lines.
                              </li>
                            ) : (
                              journalNode.accounts.map((account, accountIndex) => (
                                <li
                                  key={`${journalKey}-${account.account ?? accountIndex}`}
                                  className="flex items-center justify-between gap-4 py-2.5 pl-[4.5rem] pr-5"
                                >
                                  <span className="min-w-0 truncate font-mono text-xs font-semibold text-[#44527b]">
                                    account: {account.account ?? '-'}
                                    <span className="ml-2 text-[#8290b4]">
                                      (txn_id {account.txnId} · journal {account.journal ?? '-'})
                                    </span>
                                  </span>
                                  <span className="shrink-0 text-xs font-bold tabular-nums text-[#16214c]">
                                    Debit {formatMoney(account.totalDebit)} · Credit {formatMoney(account.totalCredit)}
                                  </span>
                                </li>
                              ))
                            )}
                          </ul>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
