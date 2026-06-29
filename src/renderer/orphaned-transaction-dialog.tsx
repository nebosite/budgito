import { useEffect } from 'react'
import type { OrphanInfo } from '../shared/types'
import { effectiveValue } from '../shared/records'
import './orphaned-transaction-dialog.css'

interface OrphanedTransactionDialogProps {
  orphan: OrphanInfo
  /** 0-based index of this orphan in the queue. */
  index: number
  /** Total number of orphaned transactions to resolve. */
  total: number
  /** Keep the record and tag it "orphaned". */
  onKeep: () => void
  /** Permanently delete the record. */
  onDelete: () => void
}

function formatAmount(amount: number): string {
  const abs = Math.abs(amount).toFixed(2)
  return amount < 0 ? `-$${abs}` : `$${abs}`
}

export function OrphanedTransactionDialog({
  orphan,
  index,
  total,
  onKeep,
  onDelete,
}: OrphanedTransactionDialogProps): JSX.Element {
  const { record, nearbyImported } = orphan

  const date = effectiveValue(record, 'date')
  const merchant = effectiveValue(record, 'merchant')
  const account = effectiveValue(record, 'account')
  const originalStatement = effectiveValue(record, 'originalStatement')
  const amount = effectiveValue(record, 'amount')
  const notes = effectiveValue(record, 'notes')
  const tags = effectiveValue(record, 'tags')

  const stmtPrefix = originalStatement.slice(0, 10)

  function matchClass(flag: boolean): string {
    return flag ? ' cell-match' : ''
  }

  function nearbyMerchantMatch(txMerchant: string): boolean {
    return txMerchant === merchant
  }

  function nearbyAmountMatch(txAmount: number): boolean {
    return txAmount.toFixed(2) === amount.toFixed(2)
  }

  function nearbyStatementMatch(txStatement: string): boolean {
    return stmtPrefix.length > 0 && txStatement.slice(0, 10) === stmtPrefix
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Enter') onKeep()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKeep])

  return (
    <div className="orphan-backdrop">
      <div
        className="orphan-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Orphaned transaction"
      >
        <div className="orphan-header">
          <h2 className="orphan-title">
            Orphaned Transaction
            {account && <span className="orphan-title-account"> — {account}</span>}
          </h2>
          {total > 1 && (
            <span className="orphan-count">
              {index + 1} of {total}
            </span>
          )}
        </div>

        <div className="orphan-body">
          <p className="orphan-explanation">
            Orphaned transactions often occur when a credit card company updates
            the description or amount of a transaction after it has been imported.
          </p>
          <p className="orphan-description">
            This transaction is in your records but missing from the import file:
          </p>

          <table className="orphan-tx-table">
            <colgroup>
              <col className="col-date" />
              <col className="col-merchant" />
              <col className="col-statement" />
              <col className="col-amount" />
            </colgroup>
            <thead>
              <tr>
                <th>Date</th>
                <th>Merchant</th>
                <th>Statement</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="orphan-row">
                <td>{date}</td>
                <td className="cell-merchant">{merchant || '(no merchant)'}</td>
                <td className="cell-statement">{originalStatement}</td>
                <td className="cell-amount">{formatAmount(amount)}</td>
              </tr>
              {(notes || tags) && (
                <tr className="orphan-row-detail">
                  <td colSpan={4}>
                    {notes && <span>Notes: {notes}</span>}
                    {tags && <span>Tags: {tags}</span>}
                  </td>
                </tr>
              )}

              <tr className="section-header-row">
                <td colSpan={4}>
                  {nearbyImported.length > 0
                    ? 'Nearby transactions from the import (±7 days):'
                    : 'No nearby transactions in the import file.'}
                </td>
              </tr>

              {nearbyImported.map((tx, i) => (
                <tr key={i} className="nearby-row">
                  <td>{tx.date}</td>
                  <td className={`cell-merchant${matchClass(nearbyMerchantMatch(tx.merchant))}`}>{tx.merchant || '(no merchant)'}</td>
                  <td className={`cell-statement${matchClass(nearbyStatementMatch(tx.originalStatement))}`}>{tx.originalStatement}</td>
                  <td className={`cell-amount${matchClass(nearbyAmountMatch(tx.amount))}`}>{formatAmount(tx.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="orphan-footer">
          <button
            type="button"
            className="orphan-btn orphan-btn-delete"
            onClick={onDelete}
          >
            Delete
          </button>
          <button
            type="button"
            className="orphan-btn orphan-btn-keep"
            onClick={onKeep}
          >
            Keep
          </button>
        </div>
      </div>
    </div>
  )
}
