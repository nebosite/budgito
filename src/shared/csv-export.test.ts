import { describe, expect, it } from 'vitest'
import type { OriginalTransaction, TransactionRecord } from './types'
import { defaultCsvName, escapeCsvField, recordsToCsv } from './csv-export'
import { tokenizeCsvLine } from '../main/csv-format'

function rec(
  original: Partial<OriginalTransaction>,
  overrides: Partial<OriginalTransaction> = {},
  ignored = false,
): TransactionRecord {
  const base: OriginalTransaction = {
    date: '2026-01-01',
    merchant: '',
    category: '',
    account: '',
    originalStatement: '',
    notes: '',
    amount: 0,
    tags: '',
  }
  return {
    key: JSON.stringify({ ...base, ...original }),
    original: { ...base, ...original },
    overrides,
    ignored,
  }
}

describe('escapeCsvField', () => {
  it('leaves a plain field unquoted', () => {
    expect(escapeCsvField('Costco')).toBe('Costco')
  })

  it('quotes a field containing a comma', () => {
    expect(escapeCsvField('Smith, John')).toBe('"Smith, John"')
  })

  it('quotes and doubles embedded quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""')
  })

  it('quotes a field containing a newline', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"')
  })

  it('leaves an empty field empty rather than quoting it', () => {
    expect(escapeCsvField('')).toBe('')
  })
})

describe('recordsToCsv', () => {
  it('writes a header row even with no records', () => {
    expect(recordsToCsv([])).toBe(
      'Ignored,Date,Account,Merchant,Category,Amount,Statement,Notes,Tags\r\n',
    )
  })

  it('writes one row per record, in the order given', () => {
    const csv = recordsToCsv([
      rec({ merchant: 'B', date: '2026-02-02' }),
      rec({ merchant: 'A', date: '2026-01-01' }),
    ])
    const merchants = csv.trimEnd().split('\r\n').slice(1).map((l) => l.split(',')[3])
    expect(merchants).toEqual(['B', 'A'])
  })

  it('uses the effective value when a field is overridden', () => {
    const csv = recordsToCsv([rec({ category: 'Food' }, { category: 'Groceries' })])
    expect(csv).toContain('Groceries')
    expect(csv).not.toContain('Food')
  })

  it('writes amounts as bare numbers, not formatted currency', () => {
    const csv = recordsToCsv([rec({ amount: -1234.5 })])
    expect(csv.trimEnd().split('\r\n')[1]).toContain('-1234.5')
    expect(csv).not.toContain('$')
  })

  it('keeps dates in ISO form', () => {
    const csv = recordsToCsv([rec({ date: '2026-03-04' })])
    expect(csv).toContain('2026-03-04')
  })

  it('marks an ignored record and leaves a kept one blank', () => {
    const csv = recordsToCsv([rec({}, {}, true), rec({}, {}, false)])
    const rows = csv.trimEnd().split('\r\n').slice(1)
    expect(rows[0].startsWith('Yes,')).toBe(true)
    expect(rows[1].startsWith(',')).toBe(true)
  })

  it('uses CRLF line endings', () => {
    const csv = recordsToCsv([rec({})])
    expect(csv.split('\r\n')).toHaveLength(3)
  })

  it('round-trips a merchant containing a comma and a quote', () => {
    const nasty = 'Bob\'s "Diner", Inc.'
    const csv = recordsToCsv([rec({ merchant: nasty, category: 'Food' })])
    const cells = tokenizeCsvLine(csv.split('\r\n')[1])
    expect(cells[3]).toBe(nasty)
    expect(cells[4]).toBe('Food')
  })
})

describe('defaultCsvName', () => {
  it('names the file after the given date', () => {
    expect(defaultCsvName(new Date(2026, 10, 23))).toBe('transactions-2026-11-23.csv')
  })

  it('zero-pads single-digit months and days', () => {
    expect(defaultCsvName(new Date(2026, 0, 5))).toBe('transactions-2026-01-05.csv')
  })
})
