import { readFile } from 'fs/promises'
import { basename } from 'path'
import type {
  FileImportResult,
  ImportFormat,
  ImportResult,
  IsoDate,
  MasterFile,
  OrphanInfo,
  OriginalTransaction,
  TransactionRecord,
} from '../shared/types'
import { sortRecordsByDateDescending } from '../shared/records'
import { parseMonarchCsv } from './csv'
import { looksLikeAmazonCsv, parseAmazonCsv } from './amazon'
import { looksLikeYnabCsv, parseYnabCsv } from './ynab'
import { mergeIntoMaster } from './merge'
import { detectTransfers } from './transfer-detection'
import { findOrphanedTransactions } from './orphan-detection'
import type { ParseResult } from './csv-format'

export type { ImportResult, FileImportResult }

interface OneFileOutcome {
  /** The master after this file was merged (unchanged if the file failed). */
  master: MasterFile
  file: FileImportResult
  /** Rows actually imported from this file (post-cutoff), for orphan detection. */
  importedRows: OriginalTransaction[]
}

/**
 * Parse a single CSV file and merge its rows into `existing`, running transfer
 * detection on the newly-added records.
 *
 * The format (Monarch Money export, Amazon History Reporter export, or YNAB
 * register export) is detected from the header row, so the user just picks
 * the file. `cutoffDate` (YYYY-MM-DD), when given, drops any parsed row dated
 * strictly before it — those transactions are too old to import.
 *
 * Whole-file problems (empty file, missing required column, I/O errors) are
 * caught and reported on the returned `file.error` rather than thrown, so one
 * bad file does not abort a multi-file batch. Per-row parse problems are
 * collected in `parseErrors`.
 */
async function importOneFile(
  filePath: string,
  existing: MasterFile,
  cutoffDate?: IsoDate,
): Promise<OneFileOutcome> {
  const fileName = basename(filePath)

  let text: string
  try {
    text = await readFile(filePath, 'utf8')
  } catch (e) {
    return { master: existing, file: failedFile(fileName, errorMessage(e)), importedRows: [] }
  }

  let format: ImportFormat
  let parsed: ParseResult
  try {
    const headerLine = text.split(/\r?\n/, 1)[0] ?? ''
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
  } catch (e) {
    return { master: existing, file: failedFile(fileName, errorMessage(e)), importedRows: [] }
  }

  const { rows: allRows, errors: parseErrors } = parsed

  // Drop rows older than the cut-off before they enter the pipeline, so they
  // are never added, never counted as duplicates, and never seed orphan
  // detection.
  const rows = cutoffDate ? allRows.filter((r) => r.parsed.date >= cutoffDate) : allRows
  const skippedOld = allRows.length - rows.length

  const merged = mergeIntoMaster(existing, rows)
  const detection = detectTransfers(merged.added, existing.records)

  const master: MasterFile = {
    version: existing.version,
    records: sortRecordsByDateDescending([...existing.records, ...detection.fresh]),
  }

  return {
    master,
    file: {
      fileName,
      format,
      added: detection.fresh.length,
      skipped: merged.skipped.length,
      skippedOld,
      autoIgnored: detection.fresh.filter((r) => r.ignored).length,
      parseErrors,
      error: null,
    },
    importedRows: rows.map((r) => r.parsed),
  }
}

/**
 * Import one or more CSV files into `existing`, one fully independent import at
 * a time. Each file merges into the running master (so duplicates across files
 * still dedupe), but is evaluated for orphans on its own: orphan detection runs
 * against the master as it was *before this batch* (`existing`), scoped to that
 * file's own rows, date range, and accounts. So a file covering a different
 * account or date range never widens another file's orphan search, and a record
 * freshly added by one file is never mistaken for an orphan by another.
 *
 * Per-file results accumulate into the summary; orphans are gathered across
 * files and de-duplicated so the same record is never queued twice.
 *
 * Persistence is the caller's responsibility (no disk write happens here).
 */
export async function importCsvFiles(
  filePaths: readonly string[],
  existing: MasterFile,
  cutoffDate?: IsoDate,
): Promise<ImportResult> {
  // Snapshot the pre-batch records: every file's orphan check is judged against
  // this baseline, independent of what sibling files add.
  const baseline = existing.records
  let master = existing
  const files: FileImportResult[] = []
  const orphanedByRecord = new Map<TransactionRecord, OrphanInfo>()

  for (const filePath of filePaths) {
    const outcome = await importOneFile(filePath, master, cutoffDate)
    master = outcome.master
    files.push(outcome.file)

    for (const orphan of findOrphanedTransactions(baseline, outcome.importedRows)) {
      // A pre-existing record can be flagged by more than one file; keep the
      // first sighting (baseline record objects are shared by reference, so
      // identity de-dup is reliable).
      if (!orphanedByRecord.has(orphan.record)) {
        orphanedByRecord.set(orphan.record, orphan)
      }
    }
  }

  return { master, files, orphaned: [...orphanedByRecord.values()] }
}

function failedFile(fileName: string, error: string): FileImportResult {
  return {
    fileName,
    format: null,
    added: 0,
    skipped: 0,
    skippedOld: 0,
    autoIgnored: 0,
    parseErrors: [],
    error,
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
