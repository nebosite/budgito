import type { MigrationResult } from '../shared/types'
import './migration-result-dialog.css'

interface MigrationResultDialogProps {
  result: MigrationResult | null
  onDismiss: () => void
  onSave: () => void
}

export function MigrationResultDialog({
  result,
  onDismiss,
  onSave,
}: MigrationResultDialogProps): JSX.Element | null {
  if (!result) return null

  const isSanityCheckPass =
    result.accountsCount === result.accountsCountBefore &&
    result.merchantsCount === result.merchantsCountBefore &&
    result.totalAmount === result.totalAmountBefore

  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })

  return (
    <div className="modal-overlay">
      <div className="modal-dialog migration-result-dialog">
        <div className="modal-header">
          <h2>Data Normalization Complete</h2>
        </div>
        <div className="modal-body">
          <p className="migration-summary">
            Your data has been normalized to handle special character encoding issues.
          </p>

          <div className="migration-stats">
            <div className="stat-row">
              <span className="stat-label">Transactions processed:</span>
              <span className="stat-value">{result.recordsProcessed}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Strings normalized:</span>
              <span className="stat-value">{result.stringsChanged}</span>
            </div>
          </div>

          <div className="sanity-checks">
            <h3>Sanity Check Results</h3>
            <div className={`check-row ${isSanityCheckPass ? 'pass' : 'fail'}`}>
              <span className="check-icon">{isSanityCheckPass ? '✓' : '✗'}</span>
              <span className="check-label">Transaction count:</span>
              <span className="check-value">{result.recordsProcessed}</span>
            </div>
            <div className={`check-row ${isSanityCheckPass ? 'pass' : 'fail'}`}>
              <span className="check-icon">{isSanityCheckPass ? '✓' : '✗'}</span>
              <span className="check-label">Unique accounts:</span>
              <span className="check-value">{result.accountsCount}</span>
            </div>
            <div className={`check-row ${isSanityCheckPass ? 'pass' : 'fail'}`}>
              <span className="check-icon">{isSanityCheckPass ? '✓' : '✗'}</span>
              <span className="check-label">Unique merchants:</span>
              <span className="check-value">{result.merchantsCount}</span>
            </div>
            <div className={`check-row ${isSanityCheckPass ? 'pass' : 'fail'}`}>
              <span className="check-icon">{isSanityCheckPass ? '✓' : '✗'}</span>
              <span className="check-label">Total amount:</span>
              <span className="check-value">
                {currencyFormatter.format(Math.abs(result.totalAmount))}
              </span>
            </div>
          </div>

          {isSanityCheckPass ? (
            <p className="migration-recommendation">
              ✓ All sanity checks passed. The normalization looks good!
            </p>
          ) : (
            <p className="migration-warning">
              ⚠️ Warning: Sanity check found discrepancies. This might indicate a problem with the
              normalization. Please report this on{' '}
              <a href="https://github.com/ericjorgensen/budgito/issues" target="_blank" rel="noreferrer">
                GitHub
              </a>
              .
            </p>
          )}
        </div>
        <div className="modal-footer">
          {isSanityCheckPass ? (
            <>
              <button className="btn-secondary" onClick={onDismiss}>
                Discard Changes
              </button>
              <button className="btn-primary" onClick={onSave}>
                Save Normalized Data
              </button>
            </>
          ) : (
            <button className="btn-primary" onClick={onDismiss}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
