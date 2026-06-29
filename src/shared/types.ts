export type Amount = number

/** ISO 8601 date string (YYYY-MM-DD). */
export type IsoDate = string

/** Parsed columns of a Monarch Money transaction row, mirroring the export header. */
export interface OriginalTransaction {
  date: IsoDate
  merchant: string
  category: string
  account: string
  originalStatement: string
  notes: string
  amount: Amount
  tags: string
}

/** User-supplied overrides. A missing key means "use the original value". */
export type TransactionOverrides = Partial<OriginalTransaction>

/**
 * One row in the master file.
 *
 * `key` is the canonical dedup identity (see `canonicalRecordKey`): a stable
 * combination of date, merchant, account, originalStatement, notes, and
 * amount from the parsed original. The same logical transaction produces the
 * same key across import formats and across changes to ignored / category /
 * tag fields.
 *
 * `ignored` is set once: transfer detection runs on freshly-imported records
 * only, never re-evaluates existing records, and the user can toggle it
 * freely after that.
 */
export interface TransactionRecord {
  key: string
  original: OriginalTransaction
  overrides: TransactionOverrides
  ignored: boolean
}

/** A row in a budget — one category and its 12 monthly planned amounts. */
export interface BudgetRow {
  category: string
  /** Always length 12, one entry per month of the budget. */
  amounts: number[]
  /**
   * Optional yearly budget cap. Only meaningful for Discretionary rows —
   * Income / Bills rows ignore it. Stored as a positive whole-dollar value;
   * UI defaults to 0 when missing for backwards compatibility with budgets
   * saved before this field existed.
   */
  budgeted?: number
  /**
   * Optional per-month free-text notes. Parallel to `amounts` (length 12).
   * Absent or `''` entries mean "no comment". The field itself is omitted
   * once every month is empty, so legacy budgets and never-commented rows
   * carry no extra payload on disk.
   */
  comments?: string[]
}

/** Which group a budget row currently belongs to. */
export type BudgetSection = 'income' | 'bills' | 'discretionary'

/** A user-defined plan: 12 months starting at startMonth, grouped into sections. */
export interface Budget {
  /** Unique within the file (case-insensitive). */
  name: string
  /** Starting month as YYYY-MM. The budget covers this month + 11 more. */
  startMonth: string
  /** Each section's rows, in display order; rows can be dragged between sections. */
  income: BudgetRow[]
  bills: BudgetRow[]
  discretionary: BudgetRow[]
}

/** Persisted shape of the master file. Versioned so schema changes can be migrated. */
export interface MasterFile {
  version: 1
  records: TransactionRecord[]
  /** User-defined budgets. Absent in old files; treated as empty on load. */
  budgets?: Budget[]
}

/** A row that could not be parsed from a CSV import. */
export interface ParseError {
  /** 1-based line number in the source text, matching what an editor would show. */
  lineNumber: number
  raw: string
  reason: string
}

/**
 * A transaction present in the master file but absent from an import file's
 * date range. Detected once per import; the user resolves each one by keeping
 * (adding an "orphaned" tag) or deleting the record.
 */
export interface OrphanInfo {
  record: TransactionRecord
  /** Import-file transactions within ±7 days of the orphan's date, for context. */
  nearbyImported: OriginalTransaction[]
}

/** Which source format an imported file was detected as. */
export type ImportFormat = 'monarch' | 'amazon' | 'ynab'

/** Outcome of importing one CSV file within a (possibly multi-file) import. */
export interface FileImportResult {
  /** The file's base name (no directory), for display in the summary report. */
  fileName: string
  /** Detected source format, or null when the file failed before detection. */
  format: ImportFormat | null
  added: number
  skipped: number
  /** Rows dropped because they predate the import cut-off date. */
  skippedOld: number
  autoIgnored: number
  parseErrors: ParseError[]
  /**
   * Whole-file failure message (empty file, missing column, I/O error), or
   * null on success. A failed file leaves the master unchanged and does not
   * abort the remaining files in the batch.
   */
  error: string | null
}

/** Outcome of a CSV import (one or more files), returned to the renderer. */
export interface ImportResult {
  master: MasterFile
  /** Per-file outcomes, in the order the files were imported. */
  files: FileImportResult[]
  /** Records in master within the imported date range/accounts that were in no imported file. */
  orphaned: OrphanInfo[]
}

/** Persisted window size in pixels. */
export interface WindowSize {
  width: number
  height: number
}

/**
 * App settings, persisted in their own file independently of the transaction
 * master file. Versioned so the schema can be migrated.
 */
export interface Settings {
  version: 1
  categories: string[]
  /** Last window size. Absent until the window has been resized at least once. */
  window?: WindowSize
  /** Absolute path of the last master file the user had open, if any. */
  lastOpenedPath?: string
  /**
   * Import cut-off date (YYYY-MM-DD). Transactions dated before this are
   * skipped on import. Absent until the user changes it; callers fall back to
   * `defaultCutoffDate` (two years before today). See `src/shared/cutoff.ts`.
   */
  cutoffDate?: IsoDate
}

/** Commands the application menu sends from the main process to the renderer. */
export type MenuCommand = 'new' | 'open' | 'save' | 'save-as' | 'help'

/** User's reply to the "save before losing changes?" prompt. */
export type DiscardChoice = 'save' | 'discard' | 'cancel'

export interface ElectronApi {
  /**
   * Open a file picker (multi-select) for CSV exports and merge them serially
   * into the given records. Returns the merged result with a per-file summary,
   * or null if the dialog was cancelled. The renderer is responsible for
   * persisting (no disk write happens here).
   */
  importCsv: (
    currentRecords: readonly TransactionRecord[],
  ) => Promise<ImportResult | null>

  /** Show a native open-file dialog; resolves to the chosen path or null. */
  showOpenDialog: () => Promise<string | null>
  /** Show a native save-as dialog; resolves to the chosen path or null. */
  showSaveDialog: (defaultName?: string) => Promise<string | null>
  /** Read a master file from disk. */
  readMasterFile: (path: string) => Promise<MasterFile>
  /** Write the records (sorted, in a versioned envelope) to disk. */
  writeMasterFile: (
    path: string,
    records: readonly TransactionRecord[],
    budgets: readonly Budget[],
  ) => Promise<void>
  /** Show the unsaved-changes prompt (Save / Don't Save / Cancel). */
  confirmDiscard: () => Promise<DiscardChoice>
  /**
   * Show a two-button (primary / Cancel) confirmation dialog. Resolves to
   * `true` if the user clicked the primary button.
   */
  confirm: (opts: {
    message: string
    detail?: string
    primaryLabel?: string
  }) => Promise<boolean>
  /** Read the bundled README.md (markdown source) for in-app help. */
  readReadme: () => Promise<string>

  /**
   * Subscribe to File-menu commands from the main process. Returns an
   * unsubscribe function.
   */
  onMenuCommand: (callback: (command: MenuCommand) => void) => () => void
  /**
   * Subscribe to a close request from the main process. The renderer must
   * eventually call `approveClose` (after any confirm/save flow) for the
   * window to actually close. Returns an unsubscribe function.
   */
  onCloseRequest: (callback: () => void) => () => void
  /** Tell the main process it is now safe to close the window. */
  approveClose: () => void

  /** Read app settings (returns defaults on first run). */
  loadSettings: () => Promise<Settings>
  /** Persist the custom-category list. Other settings fields are left untouched. */
  saveCategories: (categories: string[]) => Promise<void>
  /** Persist the import cut-off date. Other settings fields are left untouched. */
  saveCutoffDate: (cutoffDate: string) => Promise<void>
  /** Persist the path of the file currently open (null when there is none). */
  setLastOpenedPath: (path: string | null) => Promise<void>
  /** Absolute path of the app's settings.json file. */
  getSettingsPath: () => Promise<string>
  /** Open the OS file explorer at the given path, with the file selected. */
  showInFolder: (path: string) => Promise<void>
}

declare global {
  interface Window {
    api: ElectronApi
  }
}
