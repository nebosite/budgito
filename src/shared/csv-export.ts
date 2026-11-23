import type { OriginalTransaction, TransactionRecord } from './types'
import { effectiveValue } from './records'

interface ExportColumn {
  header: string
  value: (record: TransactionRecord) => string
}

function field(header: string, name: keyof OriginalTransaction): ExportColumn {
  return { header, value: (r) => String(effectiveValue(r, name) ?? '') }
}

/**
 * The exported columns, in order, mirroring the grid's columns so the file
 * matches what the user was looking at when they pressed Export.
 */
const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Ignored', value: (r) => (r.ignored ? 'Yes' : '') },
  field('Date', 'date'),
  field('Account', 'account'),
  field('Merchant', 'merchant'),
  field('Category', 'category'),
  field('Amount', 'amount'),
  field('Statement', 'originalStatement'),
  field('Notes', 'notes'),
  field('Tags', 'tags'),
]

/**
 * Quote one field per RFC 4180: a field containing a comma, a double quote,
 * or a line break is wrapped in quotes, and embedded quotes are doubled.
 */
export function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * Serialize records to RFC 4180 CSV — a header row plus one row per record,
 * in the order given.
 *
 * Cells carry effective (override-aware) values, so an export reflects the
 * user's curation rather than the raw import. Dates stay ISO and amounts stay
 * unformatted numbers (no `$`, no thousands separators) so a spreadsheet reads
 * them as a date and a number, and so `parseMonarchCsv` can read the file back.
 */
export function recordsToCsv(records: readonly TransactionRecord[]): string {
  const lines = [EXPORT_COLUMNS.map((c) => c.header).join(',')]
  for (const record of records) {
    lines.push(EXPORT_COLUMNS.map((c) => escapeCsvField(c.value(record))).join(','))
  }
  // Trailing CRLF: RFC 4180 allows it, and it keeps the file POSIX-friendly.
  return `${lines.join('\r\n')}\r\n`
}

/** Default file name offered by the export save dialog, e.g. `transactions-2026-11-23.csv`. */
export function defaultCsvName(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `transactions-${y}-${m}-${d}.csv`
}
