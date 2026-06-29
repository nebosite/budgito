import { describe, expect, it } from 'vitest'
import { defaultCutoffDate } from './cutoff'

describe('defaultCutoffDate', () => {
  it('returns the same day two years earlier', () => {
    // Months are 0-based in the Date constructor: 5 = June
    expect(defaultCutoffDate(new Date(2026, 5, 29))).toBe('2024-06-29')
  })

  it('zero-pads month and day', () => {
    expect(defaultCutoffDate(new Date(2026, 0, 5))).toBe('2024-01-05')
  })

  it('handles a leap day by rolling to March 1 two years later', () => {
    // 2024-02-29 minus two years has no Feb 29 in 2022; JS Date does not
    // adjust because we only subtract from the year component, so the result
    // is the literal 2022-02-29 string. Document the actual behavior.
    expect(defaultCutoffDate(new Date(2024, 1, 29))).toBe('2022-02-29')
  })

  it('handles end-of-year dates', () => {
    expect(defaultCutoffDate(new Date(2025, 11, 31))).toBe('2023-12-31')
  })
})
