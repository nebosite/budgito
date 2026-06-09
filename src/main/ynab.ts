import type { OriginalTransaction, ParseError } from '../shared/types'
import {
  parseFlexibleDate,
  parseNumericCell,
  tokenizeCsvLine,
} from './csv-format'
import type { ParsedRow, ParseResult } from './csv-format'

/**
 * Headers that distinguish a YNAB register export from the Monarch and Amazon
 * formats. Comparison is case-insensitive against the trimmed header values.
 * `payee`, `outflow`, `inflow`, and `category group/category` are the columns
 * unique to YNAB, so requiring them avoids colliding with the other formats.
 */
const REQUIRED_HEADERS = [
  'account',
  'date',
  'payee',
  'category group/category',
  'memo',
  'outflow',
  'inflow',
  'cleared',
] as const

type RequiredHeader = (typeof REQUIRED_HEADERS)[number]

/** Whether the given CSV header line looks like a YNAB register export. */
export function looksLikeYnabCsv(headerLine: string): boolean {
  const headers = new Set(
    tokenizeCsvLine(headerLine).map((h) => h.trim().toLowerCase()),
  )
  return REQUIRED_HEADERS.every((h) => headers.has(h))
}

/**
 * Parse a CSV produced by a YNAB register export and convert each row into the
 * Monarch-shaped OriginalTransaction we use internally. Per the agreed column
 * rules:
 *
 *   date              = Date
 *   merchant          = Payee
 *   category          = Category Group/Category
 *   account           = Account
 *   originalStatement = Payee
 *   notes             = Memo
 *   amount            = Inflow - Outflow
 *   tags              = Cleared
 *   owner             = ""
 *
 * Whole-file problems (empty file, missing required column) throw; per-row
 * problems (unparseable date) are collected so import can continue.
 */
export function parseYnabCsv(text: string): ParseResult {
  const lines = text.split(/\r?\n/)
  if (lines.length === 0 || lines[0].trim() === '') {
    throw new Error('YNAB CSV file is empty.')
  }

  const headerFields = tokenizeCsvLine(lines[0])
  const headerIndex = new Map<string, number>()
  for (let i = 0; i < headerFields.length; i++) {
    headerIndex.set(headerFields[i].trim().toLowerCase(), i)
  }

  const missing = REQUIRED_HEADERS.filter((h) => !headerIndex.has(h))
  if (missing.length > 0) {
    throw new Error(
      `YNAB CSV is missing expected column(s): ${missing.join(', ')}.`,
    )
  }

  const col = (h: RequiredHeader): number => headerIndex.get(h)!

  const rows: ParsedRow[] = []
  const errors: ParseError[] = []

  for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
    const raw = lines[lineIdx]
    // Skip anything too short to be a real row: blank, whitespace, or a stray
    // single character (some exporters end the file with a lone comma).
    if (raw.trim().length < 2) continue
    const lineNumber = lineIdx + 1

    try {
      const fields = tokenizeCsvLine(raw)
      const dateRaw = fields[col('date')] ?? ''
      const date = parseFlexibleDate(dateRaw)
      if (date === null) {
        throw new Error(`Could not parse date "${dateRaw}".`)
      }

      // Blank numeric cells are treated as zero in the amount formula.
      const inflow = parseNumericCell(fields[col('inflow')] ?? '') ?? 0
      const outflow = parseNumericCell(fields[col('outflow')] ?? '') ?? 0
      const amount = inflow - outflow

      const payee = fields[col('payee')] ?? ''

      const parsed: OriginalTransaction = {
        date,
        merchant: payee,
        category: fields[col('category group/category')] ?? '',
        account: fields[col('account')] ?? '',
        originalStatement: payee,
        notes: fields[col('memo')] ?? '',
        amount,
        tags: fields[col('cleared')] ?? '',
        owner: '',
      }
      rows.push({ raw, parsed })
    } catch (e) {
      errors.push({
        lineNumber,
        raw,
        reason: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return { rows, errors }
}
