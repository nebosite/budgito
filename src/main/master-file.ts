import { readFile } from 'fs/promises'
import type { MasterFile, MigrationResult, TransactionRecord } from '../shared/types'
import { normalizeTransactionRecord } from '../shared/string-normalizer'
import { saveWithBackup } from './atomic-write'

const CURRENT_VERSION = 2

export type { MigrationResult }

/**
 * Migrate a v1 master file to v2 by normalizing all string fields.
 * Returns the migrated file and metrics showing what changed.
 */
function migrateV1ToV2(file: MasterFile): { file: MasterFile; result: MigrationResult } {
  // Calculate baseline metrics
  const accountsBefore = new Set<string>()
  const merchantsBefore = new Set<string>()
  let totalAmountBefore = 0
  let stringsChanged = 0

  for (const record of file.records) {
    accountsBefore.add(record.original.account)
    merchantsBefore.add(record.original.merchant)
    totalAmountBefore += record.original.amount
  }

  // Normalize all records
  const normalized = file.records.map((record) => {
    const before = JSON.stringify(record)
    const normalized = normalizeTransactionRecord(record)
    const after = JSON.stringify(normalized)
    if (before !== after) {
      stringsChanged++
    }
    return normalized
  })

  // Calculate new metrics
  const accountsAfter = new Set<string>()
  const merchantsAfter = new Set<string>()
  let totalAmountAfter = 0

  for (const record of normalized) {
    accountsAfter.add(record.original.account)
    merchantsAfter.add(record.original.merchant)
    totalAmountAfter += record.original.amount
  }

  return {
    file: { ...file, version: CURRENT_VERSION, records: normalized },
    result: {
      wasMigrated: true,
      recordsProcessed: file.records.length,
      stringsChanged,
      accountsCount: accountsAfter.size,
      merchantsCount: merchantsAfter.size,
      totalAmount: totalAmountAfter,
      accountsCountBefore: accountsBefore.size,
      merchantsCountBefore: merchantsBefore.size,
      totalAmountBefore,
    },
  }
}

/**
 * Read the master file from disk. Returns an empty master if the file does
 * not exist (first-run case). Other I/O errors propagate. Throws with a
 * clear message if the file is present but unparseable or in the wrong shape.
 *
 * If the file is v1, auto-migrates to v2 and returns MigrationResult so the
 * caller can show a dialog.
 */
export async function loadMasterFile(
  path: string,
): Promise<{ file: MasterFile; migration: MigrationResult | null }> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (e) {
    if (isNodeFsError(e) && e.code === 'ENOENT') {
      return {
        file: { version: CURRENT_VERSION, records: [] },
        migration: null,
      }
    }
    throw e
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    throw new Error(`Master file at ${path} is not valid JSON: ${reason}`)
  }

  if (!isMasterFileShape(parsed)) {
    throw new Error(`Master file at ${path} is not in the expected shape.`)
  }

  const recordsWithFieldsDropped = parsed.records.map(dropRemovedFields)
  const fileWithDroppedFields = { ...parsed, records: recordsWithFieldsDropped }

  // Handle version mismatches
  if (parsed.version < CURRENT_VERSION) {
    // Migrate v1 to v2
    if (parsed.version === 1) {
      const { file, result } = migrateV1ToV2(fileWithDroppedFields)
      return { file, migration: result }
    }
    throw new Error(
      `Master file at ${path} has version ${parsed.version}; cannot migrate to version ${CURRENT_VERSION}.`,
    )
  }

  if (parsed.version > CURRENT_VERSION) {
    throw new Error(
      `Master file at ${path} has version ${parsed.version}; this app expects version ${CURRENT_VERSION}.`,
    )
  }

  return { file: fileWithDroppedFields, migration: null }
}

/**
 * Strip fields that are no longer part of the record model from a loaded
 * record. Older master files carry an `owner` field on `original` / overrides;
 * we read those files fine but drop the field so it is not re-persisted on the
 * next save. New code never writes `owner`, so this is a no-op for new files.
 */
function dropRemovedFields(record: TransactionRecord): TransactionRecord {
  const original = { ...record.original } as Record<string, unknown>
  delete original.owner
  const overrides = { ...record.overrides } as Record<string, unknown>
  delete overrides.owner
  return {
    ...record,
    original: original as unknown as TransactionRecord['original'],
    overrides: overrides as TransactionRecord['overrides'],
  }
}

/**
 * Write the master file atomically and keep the prior version in a `.bak`
 * sidecar. See `saveWithBackup` for the exact sequence.
 */
export async function saveMasterFile(path: string, file: MasterFile): Promise<void> {
  await saveWithBackup(path, JSON.stringify(file, null, 2))
}

function isNodeFsError(e: unknown): e is NodeJS.ErrnoException {
  return e instanceof Error && 'code' in e
}

function isMasterFileShape(v: unknown): v is MasterFile {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  if (typeof obj.version !== 'number' || !Array.isArray(obj.records)) return false
  // `budgets` is optional; if present it must be an array. Older files written
  // before budgets existed simply omit the field.
  return obj.budgets === undefined || Array.isArray(obj.budgets)
}
