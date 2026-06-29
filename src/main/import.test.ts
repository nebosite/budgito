import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { MasterFile } from '../shared/types'
import { importCsvFiles } from './import'

const HEADER =
  'Date,Merchant,Category,Account,Original Statement,Notes,Amount,Tags,Owner'

const YNAB_HEADER =
  '"Account","Flag","Date","Payee","Category Group/Category","Category Group","Category","Memo","Outflow","Inflow","Cleared"'

const EMPTY_MASTER: MasterFile = { version: 1, records: [] }

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'import-test-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

/** Write a CSV file in the temp dir and return its absolute path. */
async function writeCsv(name: string, lines: string[]): Promise<string> {
  const p = join(dir, name)
  await writeFile(p, lines.join('\n'), 'utf8')
  return p
}

describe('importCsvFiles', () => {
  it('imports a single CSV into an empty master', async () => {
    const path = await writeCsv('export.csv', [
      HEADER,
      '5/8/2026,Netflix,subs,A,NETFLIX,,-29.82,,Shared',
      '5/7/2026,Hulu,subs,A,HULU,,-15.99,,Shared',
    ])

    const r = await importCsvFiles([path], EMPTY_MASTER)
    expect(r.files).toHaveLength(1)
    expect(r.files[0].fileName).toBe('export.csv')
    expect(r.files[0].format).toBe('monarch')
    expect(r.files[0].added).toBe(2)
    expect(r.files[0].skipped).toBe(0)
    expect(r.files[0].autoIgnored).toBe(0)
    expect(r.files[0].parseErrors).toEqual([])
    expect(r.files[0].error).toBeNull()
    expect(r.master.records).toHaveLength(2)
  })

  it('auto-detects and imports a YNAB export', async () => {
    const path = await writeCsv('ynab.csv', [
      YNAB_HEADER,
      '"Amazon Chase Card","Approved","05/29/2026","Amazon","Education & Career: Kids Books & Toys","Education & Career","Kids Books & Toys","molds",23.50,0.00,"Cleared"',
      '"Discover Card","Approved","05/29/2026","Paycheck","","","","",0.00,327.06,"Uncleared"',
    ])

    const r = await importCsvFiles([path], EMPTY_MASTER)
    expect(r.files[0].format).toBe('ynab')
    expect(r.files[0].added).toBe(2)
    expect(r.master.records).toHaveLength(2)
    const amounts = r.master.records.map((rec) => rec.original.amount).sort((a, b) => a - b)
    expect(amounts[0]).toBeCloseTo(-23.5, 2)
    expect(amounts[1]).toBeCloseTo(327.06, 2)
  })

  it('is idempotent when re-importing the same file', async () => {
    const path = await writeCsv('export.csv', [
      HEADER,
      '5/8/2026,Netflix,subs,A,NETFLIX,,-29.82,,Shared',
    ])

    const first = await importCsvFiles([path], EMPTY_MASTER)
    const second = await importCsvFiles([path], first.master)
    expect(second.files[0].added).toBe(0)
    expect(second.files[0].skipped).toBe(1)
    expect(second.master.records).toHaveLength(1)
  })

  it('auto-ignores transfer pairs detected on import', async () => {
    const path = await writeCsv('export.csv', [
      HEADER,
      '5/8/2026,Transfer,Transfer,Checking,T-OUT,,-200,,Shared',
      '5/8/2026,Transfer,Transfer,Savings,T-IN,,200,,Shared',
    ])

    const r = await importCsvFiles([path], EMPTY_MASTER)
    expect(r.files[0].added).toBe(2)
    expect(r.files[0].autoIgnored).toBe(2)
    expect(r.master.records.every((rec) => rec.ignored)).toBe(true)
  })

  it('returns parse errors without aborting the import', async () => {
    const path = await writeCsv('export.csv', [
      HEADER,
      'BAD-DATE,Foo,Cat,A,Stmt,,-1,,S',
      '5/8/2026,Netflix,subs,A,NETFLIX,,-29.82,,Shared',
    ])

    const r = await importCsvFiles([path], EMPTY_MASTER)
    expect(r.files[0].parseErrors).toHaveLength(1)
    expect(r.files[0].added).toBe(1)
    expect(r.master.records).toHaveLength(1)
  })

  it('sorts the returned master by effective date descending', async () => {
    const path = await writeCsv('export.csv', [
      HEADER,
      '5/6/2026,A,cat,Acct,S,,-1,,S',
      '5/8/2026,B,cat,Acct,S,,-1,,S',
      '5/7/2026,C,cat,Acct,S,,-1,,S',
    ])

    const r = await importCsvFiles([path], EMPTY_MASTER)
    expect(r.master.records.map((rec) => rec.original.merchant)).toEqual(['B', 'C', 'A'])
  })

  it('records a whole-file failure without throwing or aborting the batch', async () => {
    const bad = await writeCsv('empty.csv', [''])
    const good = await writeCsv('good.csv', [
      HEADER,
      '5/8/2026,Netflix,subs,A,NETFLIX,,-29.82,,Shared',
    ])

    const r = await importCsvFiles([bad, good], EMPTY_MASTER)
    expect(r.files).toHaveLength(2)
    expect(r.files[0].fileName).toBe('empty.csv')
    expect(r.files[0].error).toBeTruthy()
    expect(r.files[0].format).toBeNull()
    // The good file still imports.
    expect(r.files[1].error).toBeNull()
    expect(r.files[1].added).toBe(1)
    expect(r.master.records).toHaveLength(1)
  })

  it('skips rows older than the cut-off date', async () => {
    const path = await writeCsv('export.csv', [
      HEADER,
      '5/8/2026,Recent,subs,A,RECENT,,-10,,S', // after cutoff — kept
      '1/1/2024,OnCutoff,subs,A,ONCUTOFF,,-20,,S', // exactly on cutoff — kept
      '12/31/2023,TooOld,subs,A,TOOOLD,,-30,,S', // before cutoff — dropped
    ])

    const r = await importCsvFiles([path], EMPTY_MASTER, '2024-01-01')
    expect(r.files[0].added).toBe(2)
    expect(r.files[0].skippedOld).toBe(1)
    expect(r.master.records.map((rec) => rec.original.merchant).sort()).toEqual([
      'OnCutoff',
      'Recent',
    ])
  })

  describe('multiple files', () => {
    it('imports files serially and reports each separately', async () => {
      const a = await writeCsv('a.csv', [
        HEADER,
        '5/8/2026,Netflix,subs,A,NETFLIX,,-29.82,,S',
      ])
      const b = await writeCsv('b.csv', [
        HEADER,
        '5/9/2026,Hulu,subs,A,HULU,,-15.99,,S',
      ])

      const r = await importCsvFiles([a, b], EMPTY_MASTER)
      expect(r.files.map((f) => f.fileName)).toEqual(['a.csv', 'b.csv'])
      expect(r.files[0].added).toBe(1)
      expect(r.files[1].added).toBe(1)
      expect(r.master.records).toHaveLength(2)
    })

    it('dedupes a transaction that appears in two files', async () => {
      const line = '5/8/2026,Netflix,subs,A,NETFLIX,,-29.82,,S'
      const a = await writeCsv('a.csv', [HEADER, line])
      const b = await writeCsv('b.csv', [HEADER, line])

      const r = await importCsvFiles([a, b], EMPTY_MASTER)
      expect(r.files[0].added).toBe(1)
      expect(r.files[1].added).toBe(0)
      expect(r.files[1].skipped).toBe(1)
      expect(r.master.records).toHaveLength(1)
    })

    it('scopes each file\'s orphan search to its own accounts and date range', async () => {
      // Pre-existing account-A rent records spanning Jan–Mar.
      const seed = await importCsvFiles(
        [
          await writeCsv('seed.csv', [
            HEADER,
            '1/15/2026,Rent,bills,A,RENT,,-1000,,S',
            '2/15/2026,Rent,bills,A,RENT,,-1000,,S',
            '3/15/2026,Rent,bills,A,RENT,,-1000,,S',
          ]),
        ],
        EMPTY_MASTER,
      )
      expect(seed.master.records).toHaveLength(3)

      // A recent account-A file (May only) plus a full-history account-B file.
      // Neither covers the Jan–Mar account-A rents, so none must be flagged —
      // the old union approach widened the range/accounts and flagged them all.
      const fileA = await writeCsv('a.csv', [HEADER, '5/15/2026,Coffee,food,A,COFFEE,,-5,,S'])
      const fileB = await writeCsv('b.csv', [
        HEADER,
        '1/20/2026,Gym,health,B,GYM,,-40,,S',
        '5/20/2026,Gym,health,B,GYM,,-40,,S',
      ])

      const r = await importCsvFiles([fileA, fileB], seed.master)
      expect(r.orphaned).toHaveLength(0)
    })

    it('still flags a pre-existing record missing from a file covering its range', async () => {
      const seed = await importCsvFiles(
        [
          await writeCsv('seed.csv', [
            HEADER,
            '5/10/2026,Netflix,subs,A,NETFLIX,,-10,,S',
            '5/12/2026,Hulu,subs,A,HULU,,-12,,S',
          ]),
        ],
        EMPTY_MASTER,
      )

      // Re-import account A across the same date span, but Netflix is gone from
      // the export (the 5/10 + 5/12 rows make the file's range cover Netflix).
      const file = await writeCsv('a.csv', [
        HEADER,
        '5/10/2026,Spotify,subs,A,SPOTIFY,,-9,,S',
        '5/12/2026,Hulu,subs,A,HULU,,-12,,S',
      ])
      const r = await importCsvFiles([file], seed.master)
      expect(r.orphaned).toHaveLength(1)
      expect(r.orphaned[0].record.original.merchant).toBe('Netflix')
    })
  })
})
