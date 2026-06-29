import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ImportSummaryDialog } from './import-summary-dialog'
import type { FileImportResult } from '../shared/types'

function makeFile(overrides: Partial<FileImportResult> = {}): FileImportResult {
  return {
    fileName: 'export.csv',
    format: 'monarch',
    added: 0,
    skipped: 0,
    skippedOld: 0,
    autoIgnored: 0,
    parseErrors: [],
    error: null,
    ...overrides,
  }
}

describe('ImportSummaryDialog', () => {
  it('renders a row per file with its counts', () => {
    const files = [
      makeFile({ fileName: 'a.csv', added: 3, skipped: 1 }),
      makeFile({ fileName: 'b.csv', added: 5, skipped: 2 }),
    ]
    render(<ImportSummaryDialog files={files} onClose={vi.fn()} />)
    expect(screen.getByText('a.csv')).toBeInTheDocument()
    expect(screen.getByText('b.csv')).toBeInTheDocument()
  })

  it('shows a totals row when more than one file is imported', () => {
    const files = [
      makeFile({ fileName: 'a.csv', added: 3 }),
      makeFile({ fileName: 'b.csv', added: 5 }),
    ]
    render(<ImportSummaryDialog files={files} onClose={vi.fn()} />)
    const totalRow = screen.getByText('Total').closest('tr')!
    // The summed Added column (3 + 5 = 8) appears in the totals row
    expect(totalRow).toHaveTextContent('8')
  })

  it('omits the totals row for a single file', () => {
    render(<ImportSummaryDialog files={[makeFile()]} onClose={vi.fn()} />)
    expect(screen.queryByText('Total')).not.toBeInTheDocument()
  })

  it('shows the failure message for a failed file', () => {
    const files = [makeFile({ fileName: 'bad.csv', format: null, error: 'Empty file' })]
    render(<ImportSummaryDialog files={files} onClose={vi.fn()} />)
    expect(screen.getByText(/Failed: Empty file/)).toBeInTheDocument()
  })

  it('calls onClose when the Close button is clicked', async () => {
    const onClose = vi.fn()
    render(<ImportSummaryDialog files={[makeFile()]} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn()
    render(<ImportSummaryDialog files={[makeFile()]} onClose={onClose} />)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows the file count in the title', () => {
    const files = [makeFile({ fileName: 'a.csv' }), makeFile({ fileName: 'b.csv' })]
    render(<ImportSummaryDialog files={files} onClose={vi.fn()} />)
    expect(screen.getByText(/2 files/)).toBeInTheDocument()
  })
})
