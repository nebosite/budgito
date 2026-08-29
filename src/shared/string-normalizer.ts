import type { OriginalTransaction, TransactionRecord } from './types'

/**
 * Normalize a string by converting multibyte spaces to ASCII spaces and
 * replacing other non-ASCII characters with '~'. Handles null/undefined safely.
 */
export function normalizeString(s: string | undefined): string {
  if (!s) return s ?? ''

  // Convert common multibyte spaces to ASCII space
  let normalized = s
    .replace(/ /g, ' ')  // non-breaking space
    .replace(/ /g, ' ')  // en quad
    .replace(/ /g, ' ')  // em quad
    .replace(/ /g, ' ')  // en space
    .replace(/ /g, ' ')  // em space
    .replace(/ /g, ' ')  // three-per-em space
    .replace(/ /g, ' ')  // four-per-em space
    .replace(/ /g, ' ')  // six-per-em space
    .replace(/ /g, ' ')  // figure space
    .replace(/ /g, ' ')  // punctuation space
    .replace(/ /g, ' ')  // thin space
    .replace(/ /g, ' ')  // hair space
    .replace(/ /g, ' ')  // narrow no-break space
    .replace(/ /g, ' ')  // medium mathematical space
    .replace(/　/g, ' ')  // ideographic space

  // Replace any remaining non-ASCII characters with ~
  normalized = normalized.replace(/[^\x00-\x7F]/g, '~')

  return normalized
}

/**
 * Normalize all string fields in an OriginalTransaction.
 */
export function normalizeOriginalTransaction(t: OriginalTransaction): OriginalTransaction {
  return {
    date: normalizeString(t.date),
    merchant: normalizeString(t.merchant),
    category: normalizeString(t.category),
    account: normalizeString(t.account),
    originalStatement: normalizeString(t.originalStatement),
    notes: normalizeString(t.notes),
    amount: t.amount,
    tags: normalizeString(t.tags),
  }
}

/**
 * Normalize all string fields in a TransactionRecord, including the original
 * transaction and any overrides.
 */
export function normalizeTransactionRecord(r: TransactionRecord): TransactionRecord {
  const normalized = normalizeOriginalTransaction(r.original)
  const overrides: Partial<OriginalTransaction> = {}

  for (const [key, value] of Object.entries(r.overrides)) {
    if (typeof value === 'string') {
      overrides[key as keyof OriginalTransaction] = normalizeString(value) as never
    } else {
      overrides[key as keyof OriginalTransaction] = value as never
    }
  }

  return {
    ...r,
    key: r.key, // key is not user-facing and doesn't need normalization
    original: normalized,
    overrides: overrides as Partial<OriginalTransaction>,
  }
}

/**
 * Compare two sets of strings to determine what changed.
 * Returns true if the sets are different.
 */
export function stringsChanged(before: Set<string>, after: Set<string>): boolean {
  if (before.size !== after.size) return true
  for (const item of after) {
    if (!before.has(item)) return true
  }
  return false
}
