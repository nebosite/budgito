import { useEffect, useState } from 'react'
import type { OriginalTransaction } from '../shared/types'
import './new-transaction-dialog.css'

interface NewTransactionDialogProps {
  /** Known categories, offered as autocomplete suggestions. */
  categories: string[]
  /** Known merchants from existing records, offered as autocomplete. */
  merchants: string[]
  /** Known accounts from existing records, offered as autocomplete. */
  accounts: string[]
  /** Called with the assembled transaction when the user clicks Add. */
  onAdd: (original: OriginalTransaction) => void
  /** Called when the user cancels (button, backdrop click, or Escape). */
  onCancel: () => void
}

/** Local-time today as YYYY-MM-DD (not UTC, so it matches the user's calendar). */
export function todayIso(): string {
  const d = new Date()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/**
 * Modal for hand-entering a transaction. Date, amount, and tags are
 * pre-filled (today / $0.00 / "Manual"); everything else starts blank. The
 * assembled values become the record's `original` — manual rows carry no
 * overrides.
 */
export function NewTransactionDialog({
  categories,
  merchants,
  accounts,
  onAdd,
  onCancel,
}: NewTransactionDialogProps): JSX.Element {
  const [date, setDate] = useState(todayIso)
  const [merchant, setMerchant] = useState('')
  const [category, setCategory] = useState('')
  const [account, setAccount] = useState('')
  const [originalStatement, setOriginalStatement] = useState('')
  const [notes, setNotes] = useState('')
  const [amount, setAmount] = useState('0.00')
  const [tags, setTags] = useState('Manual')

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault()
    const parsedAmount = Number(amount)
    onAdd({
      date,
      merchant,
      category,
      account,
      originalStatement,
      notes,
      amount: Number.isNaN(parsedAmount) ? 0 : parsedAmount,
      tags,
    })
  }

  return (
    <div className="new-tx-backdrop" onClick={onCancel}>
      <form
        className="new-tx-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="New transaction"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="new-tx-header">
          <h2 className="new-tx-title">New transaction</h2>
        </div>
        <div className="new-tx-body">
          <label className="new-tx-field">
            <span className="new-tx-label">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="new-tx-field">
            <span className="new-tx-label">Merchant</span>
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input
              type="text"
              list="new-tx-merchants"
              autoFocus
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
            />
            <datalist id="new-tx-merchants">
              {merchants.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          <label className="new-tx-field">
            <span className="new-tx-label">Category</span>
            <input
              type="text"
              list="new-tx-categories"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <datalist id="new-tx-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="new-tx-field">
            <span className="new-tx-label">Account</span>
            <input
              type="text"
              list="new-tx-accounts"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            />
            <datalist id="new-tx-accounts">
              {accounts.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </label>
          <label className="new-tx-field">
            <span className="new-tx-label">Amount</span>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="new-tx-field">
            <span className="new-tx-label">Original statement</span>
            <input
              type="text"
              value={originalStatement}
              onChange={(e) => setOriginalStatement(e.target.value)}
            />
          </label>
          <label className="new-tx-field">
            <span className="new-tx-label">Notes</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <label className="new-tx-field">
            <span className="new-tx-label">Tags</span>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </label>
        </div>
        <div className="new-tx-footer">
          <button
            type="button"
            className="new-tx-btn new-tx-btn-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button type="submit" className="new-tx-btn new-tx-btn-add">
            Add
          </button>
        </div>
      </form>
    </div>
  )
}
