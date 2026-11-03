/** The sample statements and SMS in e2e/fixtures/statements, read end to end: what each one finds. */
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { parseDelimited, parseHtmlTable } from '../whospaid/statement'
import { checkRows, htmlTextAround } from './read'
import { findingsOf } from './rules'
import { emptyFees, feesStore } from './store'
import { trackChargeSms } from './track'

const fixture = (name: string) => readFileSync(`e2e/fixtures/statements/${name}`, 'utf8')

const summary = () =>
  findingsOf(feesStore.get())
    .map((f) => `${f.charge.date} ${f.charge.kind} ${f.rule} ${f.verdict} ${f.claim}`)
    .sort()

beforeEach(() => {
  localStorage.clear()
  feesStore.set(emptyFees())
})

describe('sample statements', () => {
  it('HDFC: below zero, online NEFT, an ATM month with one withdrawal', () => {
    const check = checkRows(parseDelimited(fixture('hdfc-oct-2026.csv')), 'hdfc-oct-2026.csv')
    expect(check).toMatchObject({ kind: 'read', meta: { bank: 'hdfc', account: 'XX4821' }, trusted: true })
    expect(feesStore.get().charges).toHaveLength(4)
    expect(summary()).toEqual(['2026-10-20 neft neftOnline wrong 295', '2026-10-31 atm atmFree ask 2714', '2026-11-02 minbal minbalNegative wrong 63809'])
  })

  it('SBI: minimum balance and SMS charges after SBI stopped levying them, and a UPI charge (before the law changed in Aug 2026)', () => {
    checkRows(parseDelimited(fixture('sbi-2026.csv')), 'sbi-2026.csv')
    expect(summary()).toEqual(['2026-06-10 upi upi wrong 590', '2026-07-01 minbal minbalWaived wrong 11800', '2026-07-11 sms smsWaived wrong 1770', '2026-10-01 minbal minbalWaived wrong 11800'])
  })

  it('ICICI basic account (the .xls web page banks email): minimum balance, a card fee and ATM charges all free on BSBD', () => {
    const html = fixture('icici-basic.xls')
    const check = checkRows(parseHtmlTable(html), 'icici-basic.xls', Date.now(), htmlTextAround(html))
    expect(check).toMatchObject({ kind: 'read', meta: { bank: 'icici', account: 'XX7712', type: 'basic' } })
    // The header said it's a basic account: Settle doesn't ask.
    expect(feesStore.get().accounts).toEqual({ 'icici:XX7712': { type: 'basic', mab: null } })
    expect(summary()).toEqual(['2026-09-30 atm basicWithdrawals wrong 2714', '2026-10-02 minbal minbalBasic wrong 29500', '2026-10-15 card basicFree wrong 35400'])
  })

  it('Axis: nothing against the rules (IMPS and the monthly consolidated charges are the bank’s to set)', () => {
    checkRows(parseDelimited(fixture('axis-clean.csv')), 'axis-clean.csv')
    expect(feesStore.get().charges.map((c) => c.kind).sort()).toEqual(['imps', 'other'])
    expect(summary()).toEqual([])
  })

  it('pasted SMS: three charges kept, the reversal put back on the HDFC one', () => {
    const result = trackChargeSms([fixture('charge-sms.txt')], 'sms', '2026-11-06')
    expect(result.added.map((c) => [c.kind, c.amount + c.gst, c.account])).toEqual([
      ['minbal', 59000, 'XX4821'],
      ['sms', 1770, 'XX5531'],
      ['atm', 2714, 'XX7712'],
    ])
    expect(result.reversed).toBe(1)
    expect(feesStore.get().charges.find((c) => c.kind === 'minbal')?.reversed).toBe(59000)
  })
})
