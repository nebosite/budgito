import { readFile } from 'fs/promises'
import type { ImportFormat, ImportResult, IsoDate, MasterFile } from '../shared/types'
import { sortRecordsByDateDescending } from '../shared/records'
import { parseMonarchCsv } from './csv'
import { looksLikeAmazonCsv, parseAmazonCsv } from './amazon'
import { looksLikeYnabCsv, parseYnabCsv } from './ynab'
import { mergeIntoMaster } from './merge'
import { detectTransfers } from './transfer-detection'
import { findOrphanedTransactions } from './orphan-detection'
import type { ParseResult } from './csv-format'

export type { ImportResult }

/**
 * Parse a CSV file and merge its rows into the given in-memory master,
 * running transfer detection on the newly-added records. Returns the merged
 * master and import counts; persistence is the caller's responsibility.
 *
 * The format (Monarch Money export, Amazon History Reporter export, or YNAB
 * register export) is detected from the header row, so the user just picks
 * the file.
 *
 * Whole-file problems (empty file, missing required column, I/O errors)
 * propagate as exceptions. Per-row parse problems are collected in
 * `parseErrors` so the rest of the import still succeeds.
 *
 * `cutoffDate` (YYYY-MM-DD), when given, drops any parsed row dated strictly
 * before it — those transactions are too old to import. The count of dropped
 * rows is returned as `skippedOld`.
 */
export async function importCsvFile(
  filePath: string,
  existing: MasterFile,
  cutoffDate?: IsoDate,
): Promise<ImportResult> {
  const text = await readFile(filePath, 'utf8')
  const headerLine = text.split(/\r?\n/, 1)[0] ?? ''

  let format: ImportFormat
  let parsed: ParseResult
  if (looksLikeAmazonCsv(headerLine)) {
    format = 'amazon'
    parsed = parseAmazonCsv(text)
  } else if (looksLikeYnabCsv(headerLine)) {
    format = 'ynab'
    parsed = parseYnabCsv(text)
  } else {
    format = 'monarch'
    parsed = parseMonarchCsv(text)
  }
  const { rows: allRows, errors: parseErrors } = parsed

  // Drop rows older than the cut-off before they enter the pipeline, so they
  // are never added, never counted as duplicates, and never seed orphan
  // detection (an old transaction missing from a recent import is not an
  // orphan to resolve).
  const rows = cutoffDate
    ? allRows.filter((r) => r.parsed.date >= cutoffDate)
    : allRows
  const skippedOld = allRows.length - rows.length

  const merged = mergeIntoMaster(existing, rows)
  const detection = detectTransfers(merged.added, existing.records)

  const finalMaster: MasterFile = {
    version: existing.version,
    records: sortRecordsByDateDescending([...existing.records, ...detection.fresh]),
  }

  const importedOriginals = rows.map((r) => r.parsed)
  const orphaned = findOrphanedTransactions(finalMaster.records, importedOriginals)

  return {
    master: finalMaster,
    format,
    added: detection.fresh.length,
    skipped: merged.skipped.length,
    skippedOld,
    autoIgnored: detection.fresh.filter((r) => r.ignored).length,
    parseErrors,
    orphaned,
  }
}
