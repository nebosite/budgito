import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { MasterFile } from '../shared/types'
import { importCsvFile } from './import'

const HEADER =
  'Date,Merchant,Category,Account,Original Statement,Notes,Amount,Tags,Owner'

const YNAB_HEADER =
  '"Account","Flag","Date","Payee","Category Group/Category","Category Group","Category","Memo","Outflow","Inflow","Cleared"'

const EMPTY_MASTER: MasterFile = { version: 1, records: [] }

let dir: string
let csvPath: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'import-test-'))
  csvPath = join(dir, 'export.csv')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('importCsvFile', () => {
  it('imports a CSV into an empty master', async () => {
    await writeFile(
      csvPath,
      [
        HEADER,
        '5/8/2026,Netflix,subs,A,NETFLIX,,-29.82,,Shared',
        '5/7/2026,Hulu,subs,A,HULU,,-15.99,,Shared',
      ].join('\n'),
      'utf8',
    )

    const r = await importCsvFile(csvPath, EMPTY_MASTER)
    expect(r.format).toBe('monarch')
    expect(r.added).toBe(2)
    expect(r.skipped).toBe(0)
    expect(r.autoIgnored).toBe(0)
    expect(r.parseErrors).toEqual([])
    expect(r.master.records).toHaveLength(2)
  })

  it('auto-detects and imports a YNAB export', async () => {
    await writeFile(
      csvPath,
      [
        YNAB_HEADER,
        '"Amazon Chase Card","Approved","05/29/2026","Amazon","Education & Career: Kids Books & Toys","Education & Career","Kids Books & Toys","molds",23.50,0.00,"Cleared"',
        '"Discover Card","Approved","05/29/2026","Paycheck","","","","",0.00,327.06,"Uncleared"',
      ].join('\n'),
      'utf8',
    )

    const r = await importCsvFile(csvPath, EMPTY_MASTER)
    expect(r.format).toBe('ynab')
    expect(r.added).toBe(2)
    expect(r.master.records).toHaveLength(2)
    const amounts = r.master.records.map((rec) => rec.original.amount).sort((a, b) => a - b)
    expect(amounts[0]).toBeCloseTo(-23.5, 2)
    expect(amounts[1]).toBeCloseTo(327.06, 2)
  })

  it('is idempotent when re-importing the same file', async () => {
    const content = [HEADER, '5/8/2026,Netflix,subs,A,NETFLIX,,-29.82,,Shared'].join('\n')
    await writeFile(csvPath, content, 'utf8')

    const first = await importCsvFile(csvPath, EMPTY_MASTER)
    const second = await importCsvFile(csvPath, first.master)
    expect(second.added).toBe(0)
    expect(second.skipped).toBe(1)
    expect(second.master.records).toHaveLength(1)
  })

  it('auto-ignores transfer pairs detected on import', async () => {
    await writeFile(
      csvPath,
      [
        HEADER,
        '5/8/2026,Transfer,Transfer,Checking,T-OUT,,-200,,Shared',
        '5/8/2026,Transfer,Transfer,Savings,T-IN,,200,,Shared',
      ].join('\n'),
      'utf8',
    )

    const r = await importCsvFile(csvPath, EMPTY_MASTER)
    expect(r.added).toBe(2)
    expect(r.autoIgnored).toBe(2)
    expect(r.master.records.every((rec) => rec.ignored)).toBe(true)
  })

  it('returns parse errors without aborting the import', async () => {
    await writeFile(
      csvPath,
      [
        HEADER,
        'BAD-DATE,Foo,Cat,A,Stmt,,-1,,S',
        '5/8/2026,Netflix,subs,A,NETFLIX,,-29.82,,Shared',
      ].join('\n'),
      'utf8',
    )

    const r = await importCsvFile(csvPath, EMPTY_MASTER)
    expect(r.parseErrors).toHaveLength(1)
    expect(r.added).toBe(1)
    expect(r.master.records).toHaveLength(1)
  })

  it('sorts the returned master by effective date descending', async () => {
    await writeFile(
      csvPath,
      [
        HEADER,
        '5/6/2026,A,cat,Acct,S,,-1,,S',
        '5/8/2026,B,cat,Acct,S,,-1,,S',
        '5/7/2026,C,cat,Acct,S,,-1,,S',
      ].join('\n'),
      'utf8',
    )

    const r = await importCsvFile(csvPath, EMPTY_MASTER)
    expect(r.master.records.map((rec) => rec.original.merchant)).toEqual(['B', 'C', 'A'])
  })

  it('propagates whole-file parse errors as exceptions', async () => {
    await writeFile(csvPath, '', 'utf8')
    await expect(importCsvFile(csvPath, EMPTY_MASTER)).rejects.toThrow()
  })

  it('skips rows older than the cut-off date', async () => {
    await writeFile(
      csvPath,
      [
        HEADER,
        '5/8/2026,Recent,subs,A,RECENT,,-10,,S',     // after cutoff — kept
        '1/1/2024,OnCutoff,subs,A,ONCUTOFF,,-20,,S',  // exactly on cutoff — kept
        '12/31/2023,TooOld,subs,A,TOOOLD,,-30,,S',    // before cutoff — dropped
      ].join('\n'),
      'utf8',
    )

    const r = await importCsvFile(csvPath, EMPTY_MASTER, '2024-01-01')
    expect(r.added).toBe(2)
    expect(r.skippedOld).toBe(1)
    expect(r.master.records.map((rec) => rec.original.merchant).sort()).toEqual([
      'OnCutoff',
      'Recent',
    ])
  })

  it('imports everything and reports skippedOld 0 when no cut-off is given', async () => {
    await writeFile(
      csvPath,
      [
        HEADER,
        '5/8/2026,Recent,subs,A,RECENT,,-10,,S',
        '12/31/2000,Ancient,subs,A,ANCIENT,,-30,,S',
      ].join('\n'),
      'utf8',
    )

    const r = await importCsvFile(csvPath, EMPTY_MASTER)
    expect(r.added).toBe(2)
    expect(r.skippedOld).toBe(0)
  })
})
