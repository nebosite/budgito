import { describe, expect, it } from 'vitest'
import { looksLikeYnabCsv, parseYnabCsv } from './ynab'

const HEADER =
  '"Account","Flag","Date","Payee","Category Group/Category","Category Group","Category","Memo","Outflow","Inflow","Cleared"'

describe('looksLikeYnabCsv', () => {
  it('recognises a real YNAB register header', () => {
    expect(looksLikeYnabCsv(HEADER)).toBe(true)
  })

  it('rejects a Monarch header', () => {
    expect(
      looksLikeYnabCsv(
        'Date,Merchant,Category,Account,Original Statement,Notes,Amount,Tags,Owner',
      ),
    ).toBe(false)
  })

  it('rejects an Amazon header', () => {
    expect(
      looksLikeYnabCsv(
        'order id,order url,items,to,date,total,shipping,shipping_refund,gift,tax,refund,payments',
      ),
    ).toBe(false)
  })
})

describe('parseYnabCsv', () => {
  it('maps a basic outflow row into the Monarch-shaped record we use internally', () => {
    const row =
      '"Amazon Chase Card","Approved","05/29/2026","Amazon","Education & Career: Kids Books & Toys","Education & Career","Kids Books & Toys","popsicle molds",23.50,0.00,"Cleared"'
    const { rows, errors } = parseYnabCsv([HEADER, row].join('\n'))

    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0].parsed).toEqual({
      date: '2026-05-29',
      merchant: 'Amazon',
      category: 'Education & Career: Kids Books & Toys',
      account: 'Amazon Chase Card',
      originalStatement: 'Amazon',
      notes: 'popsicle molds',
      amount: -23.5,
      tags: 'Cleared',
    })
    expect(rows[0].raw).toBe(row)
  })

  it('computes amount as inflow minus outflow', () => {
    const row =
      '"Discover Card","Approved","05/29/2026","Transfer : CapOne Savings","","","","",0.00,327.06,"Uncleared"'
    const { rows } = parseYnabCsv([HEADER, row].join('\n'))
    expect(rows[0].parsed.amount).toBeCloseTo(327.06, 2)
  })

  it('treats blank outflow / inflow cells as zero', () => {
    const row =
      '"Costco Citi Card","Approved","05/29/2026","Costco","Food & Dining: Groceries","Food & Dining","Groceries","",,,"Cleared"'
    const { rows } = parseYnabCsv([HEADER, row].join('\n'))
    expect(rows[0].parsed.amount).toBe(0)
  })

  it('uses the payee for both merchant and originalStatement', () => {
    const row =
      '"Costco Citi Card","Approved","05/29/2026","Costco Gas","Irregular Expenses: Gasoline","Irregular Expenses","Gasoline","",12.85,0.00,"Cleared"'
    const { rows } = parseYnabCsv([HEADER, row].join('\n'))
    expect(rows[0].parsed.merchant).toBe('Costco Gas')
    expect(rows[0].parsed.originalStatement).toBe('Costco Gas')
  })

  it('collects per-row errors for malformed dates', () => {
    const text = [
      HEADER,
      '"A","Approved","not-a-date","P","Cat","CG","C","",1.00,0.00,"Cleared"',
      '"A","Approved","05/29/2026","P","Cat","CG","C","",1.00,0.00,"Cleared"',
    ].join('\n')
    const { rows, errors } = parseYnabCsv(text)
    expect(rows).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0].reason).toMatch(/date/i)
  })

  it('throws when a required column is missing', () => {
    expect(() =>
      parseYnabCsv(
        ['"Account","Date","Payee","Outflow"', '"A","05/29/2026","P",1.00'].join('\n'),
      ),
    ).toThrow(/missing/i)
  })

  it('throws on an empty file', () => {
    expect(() => parseYnabCsv('')).toThrow()
  })
})
