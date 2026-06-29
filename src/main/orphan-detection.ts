import type { IsoDate, OriginalTransaction, OrphanInfo, TransactionRecord } from '../shared/types'
import { canonicalRecordKey, effectiveValue } from '../shared/records'

function hasOrphanedTag(record: TransactionRecord): boolean {
  const tags = effectiveValue(record, 'tags')
  if (typeof tags !== 'string' || tags.trim() === '') return false
  return tags
    .toLowerCase()
    .split(/[\s,;]+/)
    .some((t) => t === 'orphaned')
}

/**
 * Find records in `masterRecords` that fall within the date range of
 * `importedRows` but are absent from that import.
 *
 * Exclusions: ignored records and records already tagged "orphaned".
 * Matching mirrors the count-based dedup in mergeIntoMaster: if the import
 * contains N copies of a key, the first N master records with that key are
 * considered matched; any beyond N are orphaned.
 *
 * For each orphan, import-file rows within ±7 days are included as context so
 * the user can see what was nearby. Rows outside that window are also included
 * when their statement or amount exactly matches the orphan's — those are the
 * likeliest re-described / re-amounted duplicates regardless of date.
 */
export function findOrphanedTransactions(
  masterRecords: readonly TransactionRecord[],
  importedRows: readonly OriginalTransaction[],
): OrphanInfo[] {
  if (importedRows.length === 0) return []

  // Determine the date range of the import file
  let minDate: IsoDate = importedRows[0].date
  let maxDate: IsoDate = importedRows[0].date
  for (const row of importedRows) {
    if (row.date < minDate) minDate = row.date
    if (row.date > maxDate) maxDate = row.date
  }

  // Track which accounts appear in the import. A master record whose account
  // isn't in this set was simply not covered by the import — not orphaned.
  const importAccounts = new Set<string>()
  for (const row of importedRows) {
    importAccounts.add(row.account)
  }

  // Count how many times each key appears in the import file
  const importKeyCounts = new Map<string, number>()
  for (const row of importedRows) {
    const key = canonicalRecordKey(row)
    importKeyCounts.set(key, (importKeyCounts.get(key) ?? 0) + 1)
  }

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

  const orphaned: OrphanInfo[] = []
  for (const record of masterRecords) {
    const date = effectiveValue(record, 'date')
    if (date < minDate || date > maxDate) continue
    if (record.ignored) continue
    if (hasOrphanedTag(record)) continue
    if (!importAccounts.has(effectiveValue(record, 'account'))) continue

    const remaining = importKeyCounts.get(record.key) ?? 0
    if (remaining > 0) {
      // Matched by import — consume one from the count
      importKeyCounts.set(record.key, remaining - 1)
    } else {
      // Not covered by the import → orphaned. Include any import row within the
      // ±7-day window, plus any row (at any date) whose statement or amount
      // exactly matches — those are the likeliest re-described duplicates.
      const orphanMs = Date.parse(date)
      const orphanStatement = effectiveValue(record, 'originalStatement')
      const orphanAmount = effectiveValue(record, 'amount')
      const nearbyImported = importedRows.filter((row) => {
        const withinWindow = Math.abs(Date.parse(row.date) - orphanMs) <= SEVEN_DAYS_MS
        const statementMatch =
          orphanStatement !== '' && row.originalStatement === orphanStatement
        const amountMatch = row.amount === orphanAmount
        return withinWindow || statementMatch || amountMatch
      })
      orphaned.push({ record, nearbyImported })
    }
  }

  return orphaned
}
