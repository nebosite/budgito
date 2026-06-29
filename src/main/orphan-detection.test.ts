import { describe, expect, it } from 'vitest'
import { findOrphanedTransactions } from './orphan-detection'
import { canonicalRecordKey } from '../shared/records'
import type { OriginalTransaction, TransactionRecord } from '../shared/types'

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

function makeRecord(original: OriginalTransaction, overrides: Partial<TransactionRecord> = {}): TransactionRecord {
  return {
    key: canonicalRecordKey(original),
    original,
    overrides: {},
    ignored: false,
    ...overrides,
  }
}

describe('findOrphanedTransactions', () => {
  it('returns empty when import is empty', () => {
    const master = [makeRecord(makeOriginal())]
    expect(findOrphanedTransactions(master, [])).toEqual([])
  })

  it('returns empty when all master records match import', () => {
    const original = makeOriginal()
    const record = makeRecord(original)
    expect(findOrphanedTransactions([record], [original])).toEqual([])
  })

  it('returns empty when master record is outside import date range', () => {
    const importRow = makeOriginal({ date: '2026-05-01' })
    // master record is in March — outside the May 1–1 import range
    const outsideRecord = makeRecord(makeOriginal({ date: '2026-03-10' }))
    expect(findOrphanedTransactions([outsideRecord], [importRow])).toEqual([])
  })

  it('detects a record in the date range that is missing from import', () => {
    const importRow = makeOriginal({ date: '2026-05-15', merchant: 'Netflix' })
    const orphanOriginal = makeOriginal({ date: '2026-05-15', merchant: 'Amazon' })
    const orphanRecord = makeRecord(orphanOriginal)

    const result = findOrphanedTransactions([orphanRecord], [importRow])
    expect(result).toHaveLength(1)
    expect(result[0].record).toBe(orphanRecord)
  })

  it('skips ignored records', () => {
    const importRow = makeOriginal({ merchant: 'Netflix' })
    const ignoredRecord = makeRecord(makeOriginal({ merchant: 'Amazon' }), { ignored: true })
    expect(findOrphanedTransactions([ignoredRecord], [importRow])).toHaveLength(0)
  })

  it('skips records tagged "orphaned"', () => {
    const importRow = makeOriginal({ merchant: 'Netflix' })
    const taggedOriginal = makeOriginal({ merchant: 'Amazon' })
    const taggedRecord = makeRecord(taggedOriginal, { overrides: { tags: 'orphaned' } })
    expect(findOrphanedTransactions([taggedRecord], [importRow])).toHaveLength(0)
  })

  it('skips records with "orphaned" among other tags', () => {
    const importRow = makeOriginal({ merchant: 'Netflix' })
    const taggedRecord = makeRecord(makeOriginal({ merchant: 'Amazon' }), {
      overrides: { tags: 'manual orphaned verified' },
    })
    expect(findOrphanedTransactions([taggedRecord], [importRow])).toHaveLength(0)
  })

  it('treats "orphaned" tag case-insensitively', () => {
    const importRow = makeOriginal({ merchant: 'Netflix' })
    const taggedRecord = makeRecord(makeOriginal({ merchant: 'Amazon' }), {
      overrides: { tags: 'Orphaned' },
    })
    expect(findOrphanedTransactions([taggedRecord], [importRow])).toHaveLength(0)
  })

  it('includes nearby import rows within 7 days in nearbyImported', () => {
    // Each row has a distinct amount/statement so only the date window decides
    // inclusion (the out-of-window match-on-amount/statement rule is tested
    // separately).
    const importRows: OriginalTransaction[] = [
      makeOriginal({ date: '2026-05-08', merchant: 'Costco', amount: -1.0, originalStatement: 'COSTCO' }),   // 7 days before
      makeOriginal({ date: '2026-05-10', merchant: 'Whole Foods', amount: -2.0, originalStatement: 'WHOLEFOODS' }), // 5 days before
      makeOriginal({ date: '2026-05-22', merchant: 'Netflix', amount: -3.0, originalStatement: 'NETFLIX' }),   // 7 days after
      makeOriginal({ date: '2026-05-23', merchant: 'Spotify', amount: -4.0, originalStatement: 'SPOTIFY' }),   // 8 days after — excluded
    ]
    const orphanOriginal = makeOriginal({ date: '2026-05-15', merchant: 'Target', amount: -99.0, originalStatement: 'TARGET' })
    const orphanRecord = makeRecord(orphanOriginal)

    const result = findOrphanedTransactions([orphanRecord], importRows)
    expect(result).toHaveLength(1)
    // All importRows within ±7 days (inclusive): May 8, May 10, May 22
    expect(result[0].nearbyImported).toHaveLength(3)
    expect(result[0].nearbyImported.map((r) => r.merchant)).toEqual([
      'Costco',
      'Whole Foods',
      'Netflix',
    ])
  })

  it('includes an out-of-window import row when its statement exactly matches', () => {
    const importRows: OriginalTransaction[] = [
      // 40 days after the orphan but same statement — should be included
      makeOriginal({ date: '2026-06-24', merchant: 'Amazon Refund', amount: -50.0, originalStatement: 'AMZN MKTP US' }),
      // anchors the import range and keeps the orphan in [min, max]
      makeOriginal({ date: '2026-05-15', merchant: 'Netflix', amount: -15.99, originalStatement: 'NETFLIX.COM' }),
    ]
    const orphanRecord = makeRecord(
      makeOriginal({ date: '2026-05-15', merchant: 'Amazon', amount: -45.99, originalStatement: 'AMZN MKTP US' }),
    )
    const result = findOrphanedTransactions([orphanRecord], importRows)
    expect(result).toHaveLength(1)
    expect(result[0].nearbyImported.map((r) => r.merchant)).toContain('Amazon Refund')
  })

  it('includes an out-of-window import row when its amount exactly matches', () => {
    const importRows: OriginalTransaction[] = [
      // 40 days after the orphan but same amount — should be included
      makeOriginal({ date: '2026-06-24', merchant: 'Amazon Reposted', amount: -45.99, originalStatement: 'DIFFERENT' }),
      makeOriginal({ date: '2026-05-15', merchant: 'Netflix', amount: -15.99, originalStatement: 'NETFLIX.COM' }),
    ]
    const orphanRecord = makeRecord(
      makeOriginal({ date: '2026-05-15', merchant: 'Amazon', amount: -45.99, originalStatement: 'AMZN MKTP US' }),
    )
    const result = findOrphanedTransactions([orphanRecord], importRows)
    expect(result).toHaveLength(1)
    expect(result[0].nearbyImported.map((r) => r.merchant)).toContain('Amazon Reposted')
  })

  it('excludes an out-of-window import row when neither statement nor amount matches', () => {
    const importRows: OriginalTransaction[] = [
      // 40 days after, different statement and amount — should NOT be included
      makeOriginal({ date: '2026-06-24', merchant: 'Walmart', amount: -88.88, originalStatement: 'WALMART' }),
      makeOriginal({ date: '2026-05-15', merchant: 'Netflix', amount: -15.99, originalStatement: 'NETFLIX.COM' }),
    ]
    const orphanRecord = makeRecord(
      makeOriginal({ date: '2026-05-15', merchant: 'Amazon', amount: -45.99, originalStatement: 'AMZN MKTP US' }),
    )
    const result = findOrphanedTransactions([orphanRecord], importRows)
    expect(result).toHaveLength(1)
    expect(result[0].nearbyImported.map((r) => r.merchant)).not.toContain('Walmart')
    // Only the in-window Netflix row remains
    expect(result[0].nearbyImported).toHaveLength(1)
  })

  it('does not match an out-of-window row on a blank statement', () => {
    const importRows: OriginalTransaction[] = [
      // far out, blank statement, different amount — a blank statement must not match a blank orphan statement
      makeOriginal({ date: '2026-06-24', merchant: 'Mystery', amount: -1.0, originalStatement: '' }),
      makeOriginal({ date: '2026-05-15', merchant: 'Netflix', amount: -15.99, originalStatement: 'NETFLIX.COM' }),
    ]
    const orphanRecord = makeRecord(
      makeOriginal({ date: '2026-05-15', merchant: 'Amazon', amount: -45.99, originalStatement: '' }),
    )
    const result = findOrphanedTransactions([orphanRecord], importRows)
    expect(result).toHaveLength(1)
    expect(result[0].nearbyImported.map((r) => r.merchant)).not.toContain('Mystery')
  })

  it('skips master records whose account is not represented in the import', () => {
    // Import only has Amex records — Chase Visa records in master are not orphaned
    const importRow = makeOriginal({ account: 'Amex', merchant: 'Netflix' })
    const chaseRecord = makeRecord(makeOriginal({ account: 'Chase Visa', merchant: 'Amazon' }))
    expect(findOrphanedTransactions([chaseRecord], [importRow])).toHaveLength(0)
  })

  it('flags master records from an account that IS in the import but missing the specific transaction', () => {
    // Both master record and import have Chase Visa, but this specific transaction is absent
    const importRow = makeOriginal({ account: 'Chase Visa', merchant: 'Netflix' })
    const orphanRecord = makeRecord(makeOriginal({ account: 'Chase Visa', merchant: 'Amazon' }))
    expect(findOrphanedTransactions([orphanRecord], [importRow])).toHaveLength(1)
  })

  it('handles mixed accounts: only flags records from accounts covered by the import', () => {
    const importRow = makeOriginal({ account: 'Amex', merchant: 'Netflix' })
    // One record from Amex (not in import) + one from Chase Visa (account not in import)
    const amexOrphan = makeRecord(makeOriginal({ account: 'Amex', merchant: 'Amazon' }))
    const chaseRecord = makeRecord(makeOriginal({ account: 'Chase Visa', merchant: 'Target' }))
    const result = findOrphanedTransactions([amexOrphan, chaseRecord], [importRow])
    // Only the Amex record is orphaned; Chase Visa is not covered by the import
    expect(result).toHaveLength(1)
    expect(result[0].record).toBe(amexOrphan)
  })

  it('handles count-based matching: 2 master records, 1 in import → 1 orphaned', () => {
    const original = makeOriginal()  // same key
    const record1 = makeRecord(original)
    const record2 = makeRecord(original)  // same key, second copy

    // Import has only 1 copy
    const result = findOrphanedTransactions([record1, record2], [original])
    expect(result).toHaveLength(1)
  })

  it('handles count-based matching: 2 master records, 2 in import → 0 orphaned', () => {
    const original = makeOriginal()
    const record1 = makeRecord(original)
    const record2 = makeRecord(original)

    const result = findOrphanedTransactions([record1, record2], [original, original])
    expect(result).toHaveLength(0)
  })

  it('uses effective date (from overrides) for range check', () => {
    // The record's original date is outside range, but override date is inside
    const importRow = makeOriginal({ date: '2026-05-15', merchant: 'Netflix' })
    const originalOutside = makeOriginal({ date: '2026-03-01', merchant: 'Amazon' })
    const recordWithOverride = {
      ...makeRecord(originalOutside),
      overrides: { date: '2026-05-15' },
    }

    const result = findOrphanedTransactions([recordWithOverride], [importRow])
    // The effective date of this record is 2026-05-15 (in range), and its key
    // doesn't match the import row (different merchant), so it should be orphaned
    expect(result).toHaveLength(1)
  })
})
