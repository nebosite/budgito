import { useEffect } from 'react'
import type { FileImportResult, ImportFormat } from '../shared/types'
import './import-summary-dialog.css'

interface ImportSummaryDialogProps {
  files: FileImportResult[]
  /** Dismiss the report (button, backdrop click, Escape, or Enter). */
  onClose: () => void
}

const FORMAT_LABELS: Record<ImportFormat, string> = {
  monarch: 'Monarch',
  amazon: 'Amazon',
  ynab: 'YNAB',
}

export function ImportSummaryDialog({
  files,
  onClose,
}: ImportSummaryDialogProps): JSX.Element {
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape' || event.key === 'Enter') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const totals = files.reduce(
    (acc, f) => ({
      added: acc.added + f.added,
      skipped: acc.skipped + f.skipped,
      skippedOld: acc.skippedOld + f.skippedOld,
      autoIgnored: acc.autoIgnored + f.autoIgnored,
      parseErrors: acc.parseErrors + f.parseErrors.length,
    }),
    { added: 0, skipped: 0, skippedOld: 0, autoIgnored: 0, parseErrors: 0 },
  )

  return (
    <div className="import-summary-backdrop" onClick={onClose}>
      <div
        className="import-summary-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Import summary"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="import-summary-header">
          <h2 className="import-summary-title">
            Import Summary
            <span className="import-summary-count">
              {' '}
              — {files.length} file{files.length === 1 ? '' : 's'}
            </span>
          </h2>
        </div>

        <div className="import-summary-body">
          <table className="import-summary-table">
            <thead>
              <tr>
                <th className="col-file">File</th>
                <th className="col-format">Format</th>
                <th className="col-num">Added</th>
                <th className="col-num">Skipped</th>
                <th className="col-num">Too old</th>
                <th className="col-num">Auto-ignored</th>
                <th className="col-num">Parse errors</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f, i) => (
                <tr key={i} className={f.error ? 'import-summary-row-failed' : ''}>
                  <td className="col-file" title={f.fileName}>
                    {f.fileName}
                  </td>
                  {f.error ? (
                    <td className="import-summary-error" colSpan={6}>
                      Failed: {f.error}
                    </td>
                  ) : (
                    <>
                      <td className="col-format">
                        {f.format ? FORMAT_LABELS[f.format] : '—'}
                      </td>
                      <td className="col-num">{f.added}</td>
                      <td className="col-num">{f.skipped}</td>
                      <td className="col-num">{f.skippedOld}</td>
                      <td className="col-num">{f.autoIgnored}</td>
                      <td className="col-num">{f.parseErrors.length}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            {files.length > 1 && (
              <tfoot>
                <tr className="import-summary-totals">
                  <td className="col-file">Total</td>
                  <td className="col-format" />
                  <td className="col-num">{totals.added}</td>
                  <td className="col-num">{totals.skipped}</td>
                  <td className="col-num">{totals.skippedOld}</td>
                  <td className="col-num">{totals.autoIgnored}</td>
                  <td className="col-num">{totals.parseErrors}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="import-summary-footer">
          <button
            type="button"
            className="import-summary-btn"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
