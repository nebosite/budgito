import type { IsoDate } from './types'

/**
 * Default import cut-off date: two years before the given reference date,
 * formatted as a local-time ISO date (YYYY-MM-DD). Transactions older than
 * the cut-off are skipped on import.
 *
 * Computed from a passed-in `Date` (rather than reading the clock internally)
 * so callers in both the main and renderer processes can share one definition
 * and tests can pin a reference date.
 */
export function defaultCutoffDate(today: Date): IsoDate {
  const year = today.getFullYear() - 2
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
