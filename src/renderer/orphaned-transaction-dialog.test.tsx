import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OrphanedTransactionDialog } from './orphaned-transaction-dialog'
import { canonicalRecordKey } from '../shared/records'
import type { OrphanInfo, OriginalTransaction, TransactionRecord } from '../shared/types'

function makeOriginal(overrides: Partial<OriginalTransaction> = {}): OriginalTransaction {
  return {
    date: '2026-05-15',
    merchant: 'Amazon',
    category: 'Shopping',
    account: 'Chase Visa',
    originalStatement: 'AMAZON',
    notes: '',
    amount: -45.99,
    tags: '',
    ...overrides,
  }
}

function makeRecord(original: OriginalTransaction): TransactionRecord {
  return {
    key: canonicalRecordKey(original),
    original,
    overrides: {},
    ignored: false,
  }
}

function makeOrphanInfo(
  recordOverrides: Partial<OriginalTransaction> = {},
  nearby: OriginalTransaction[] = [],
): OrphanInfo {
  const original = makeOriginal(recordOverrides)
  return {
    record: makeRecord(original),
    nearbyImported: nearby,
  }
}

describe('OrphanedTransactionDialog', () => {
  it('renders orphaned transaction details', () => {
    const orphan = makeOrphanInfo({ merchant: 'Spotify', amount: -9.99 })
    render(
      <OrphanedTransactionDialog
        orphan={orphan}
        index={0}
        total={1}
        onKeep={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText('Spotify')).toBeInTheDocument()
    expect(screen.getByText('-$9.99')).toBeInTheDocument()
    expect(screen.getByText('2026-05-15')).toBeInTheDocument()
  })

  it('shows count badge when total > 1', () => {
    const orphan = makeOrphanInfo()
    render(
      <OrphanedTransactionDialog
        orphan={orphan}
        index={1}
        total={3}
        onKeep={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
  })

  it('hides count badge when total is 1', () => {
    const orphan = makeOrphanInfo()
    render(
      <OrphanedTransactionDialog
        orphan={orphan}
        index={0}
        total={1}
        onKeep={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.queryByText(/\d+ of \d+/)).not.toBeInTheDocument()
  })

  it('shows account in the dialog title', () => {
    const orphan = makeOrphanInfo({ account: 'Chase Visa' })
    render(
      <OrphanedTransactionDialog
        orphan={orphan}
        index={0}
        total={1}
        onKeep={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText(/Chase Visa/)).toBeInTheDocument()
  })

  it('renders nearby imported transactions with statement column', () => {
    const nearby: OriginalTransaction[] = [
      makeOriginal({ date: '2026-05-14', merchant: 'Costco', amount: -123.45, originalStatement: 'COSTCO #1234' }),
      makeOriginal({ date: '2026-05-16', merchant: 'Netflix', amount: -15.99, originalStatement: 'NETFLIX.COM' }),
    ]
    const orphan = makeOrphanInfo({ originalStatement: 'AMZN MKTP' }, nearby)
    render(
      <OrphanedTransactionDialog
        orphan={orphan}
        index={0}
        total={1}
        onKeep={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText('Costco')).toBeInTheDocument()
    expect(screen.getByText('Netflix')).toBeInTheDocument()
    expect(screen.getByText('-$123.45')).toBeInTheDocument()
    expect(screen.getByText('AMZN MKTP')).toBeInTheDocument()
    expect(screen.getByText('COSTCO #1234')).toBeInTheDocument()
    expect(screen.getByText('NETFLIX.COM')).toBeInTheDocument()
  })

  it('shows "no nearby" message when nearbyImported is empty', () => {
    const orphan = makeOrphanInfo({}, [])
    render(
      <OrphanedTransactionDialog
        orphan={orphan}
        index={0}
        total={1}
        onKeep={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText(/No nearby transactions/)).toBeInTheDocument()
  })

  it('calls onKeep when Keep button is clicked', async () => {
    const onKeep = vi.fn()
    const orphan = makeOrphanInfo()
    render(
      <OrphanedTransactionDialog
        orphan={orphan}
        index={0}
        total={1}
        onKeep={onKeep}
        onDelete={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect(onKeep).toHaveBeenCalledOnce()
  })

  it('calls onDelete when Delete button is clicked', async () => {
    const onDelete = vi.fn()
    const orphan = makeOrphanInfo()
    render(
      <OrphanedTransactionDialog
        orphan={orphan}
        index={0}
        total={1}
        onKeep={vi.fn()}
        onDelete={onDelete}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('calls onKeep when Enter is pressed', async () => {
    const onKeep = vi.fn()
    const orphan = makeOrphanInfo()
    render(
      <OrphanedTransactionDialog
        orphan={orphan}
        index={0}
        total={1}
        onKeep={onKeep}
        onDelete={vi.fn()}
      />,
    )
    await userEvent.keyboard('{Enter}')
    expect(onKeep).toHaveBeenCalledOnce()
  })

  describe('cell-match highlighting', () => {
    // Unique sentinel values ensure only the explicitly matched field triggers highlights
    const BASE_ORPHAN: Partial<OriginalTransaction> = {
      merchant: 'OrphanMerchant',
      amount: -11.11,
      originalStatement: 'ORPHAN_STMT_XYZ',
    }
    const BASE_NEARBY: Partial<OriginalTransaction> = {
      merchant: 'NearbyMerchant',
      amount: -22.22,
      originalStatement: 'NEARBY_STMT_ABC',
    }

    function setup(orphanOverrides: Partial<OriginalTransaction>, nearbyOverrides: Partial<OriginalTransaction>) {
      const orphan = makeOrphanInfo(
        { ...BASE_ORPHAN, ...orphanOverrides },
        [makeOriginal({ ...BASE_NEARBY, ...nearbyOverrides })],
      )
      render(
        <OrphanedTransactionDialog
          orphan={orphan}
          index={0}
          total={1}
          onKeep={vi.fn()}
          onDelete={vi.fn()}
        />,
      )
      return document.querySelectorAll('.cell-match')
    }

    it('highlights only the nearby merchant cell when merchant matches', () => {
      const cells = setup({ merchant: 'Amazon' }, { merchant: 'Amazon' })
      // Only the imported (nearby) cell is highlighted, never the orphan row
      expect(cells.length).toBe(1)
      expect(cells[0].closest('tr')).toHaveClass('nearby-row')
      expect(cells[0].textContent).toBe('Amazon')
    })

    it('highlights only the nearby amount cell when amount matches', () => {
      const cells = setup({ amount: -45.99 }, { amount: -45.99 })
      expect(cells.length).toBe(1)
      expect(cells[0].closest('tr')).toHaveClass('nearby-row')
      expect(cells[0].textContent).toBe('-$45.99')
    })

    it('highlights only the nearby statement cell when first 10 chars match', () => {
      const cells = setup(
        { originalStatement: 'AMAZON.COM PURCHASE' },
        { originalStatement: 'AMAZON.COM REFUND' },
      )
      expect(cells.length).toBe(1)
      expect(cells[0].closest('tr')).toHaveClass('nearby-row')
    })

    it('does not highlight statement when first 10 chars differ', () => {
      const cells = setup(
        { originalStatement: 'AMAZON.COM PURCHASE' },
        { originalStatement: 'WALMART    PURCHASE' },
      )
      expect(cells.length).toBe(0)
    })

    it('does not highlight merchant when values differ', () => {
      const cells = setup({ merchant: 'Amazon' }, { merchant: 'Netflix' })
      expect(cells.length).toBe(0)
    })
  })

  it('displays effective values from overrides', () => {
    const original = makeOriginal({ merchant: 'Amazon' })
    const record: TransactionRecord = {
      key: canonicalRecordKey(original),
      original,
      overrides: { merchant: 'Amazon Prime' },
      ignored: false,
    }
    const orphan: OrphanInfo = { record, nearbyImported: [] }
    render(
      <OrphanedTransactionDialog
        orphan={orphan}
        index={0}
        total={1}
        onKeep={vi.fn()}
        onDelete={vi.fn()}
      />,
    )
    expect(screen.getByText('Amazon Prime')).toBeInTheDocument()
    expect(screen.queryByText('Amazon')).not.toBeInTheDocument()
  })
})
