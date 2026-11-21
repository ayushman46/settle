import { describe, expect, it } from 'vitest'
import { categoryFromText } from '../../engine/categories'
import { checkTotals, parseCsv, planSplitwise, plannedBalances, readSplitwise, SplitwiseFormatError } from './splitwise'

/** A Goa trip as Splitwise exports it (paid − owe per person; the last row is the total). */
const GOA = [
  'Date,Description,Category,Cost,Currency,Ayush Kumar,Riya,Sam',
  '',
  '2026-10-01,Villa,Hotel,24000.00,INR,16000.00,-8000.00,-8000.00',
  '2026-10-02,"Dinner, beach shack",Dining out,3000.00,INR,-1000.00,2000.00,-1000.00',
  '2026-10-03,Riya paid Ayush Kumar,Payment,6000.00,INR,-6000.00,6000.00,0.00',
  // A 1500 cab paid by Riya (1000) and Sam (500): Ayush had 1000 of it, Riya and Sam 250 each.
  '2026-10-04,Cab,Taxi,1500.00,INR,-1000.00,750.00,250.00',
  // Ayush's own sunglasses: nothing between people.
  '2026-10-05,Sunglasses,Clothing,800.00,INR,0.00,0.00,0.00',
  '',
  '2026-10-31,Total balance, , ,INR,8000.00,750.00,-8750.00',
].join('\r\n')

describe('parseCsv', () => {
  it('handles quotes, doubled quotes, commas and line breaks in a field, and a BOM', () => {
    expect(parseCsv('﻿a,"b, c","say ""hi""","two\nlines"\r\nx,y')).toEqual([
      ['a', 'b, c', 'say "hi"', 'two\nlines'],
      ['x', 'y'],
    ])
  })
})

describe('readSplitwise', () => {
  it('reads the people, every row in paise, payments and the total balance', () => {
    const file = readSplitwise(GOA)
    expect(file.people).toEqual(['Ayush Kumar', 'Riya', 'Sam'])
    expect(file.rows).toHaveLength(5)
    expect(file.rows[0]).toMatchObject({ date: '2026-10-01', description: 'Villa', cost: 2400000, currency: 'INR', nets: { 'Ayush Kumar': 1600000, Riya: -800000, Sam: -800000 }, isPayment: false })
    expect(file.rows[1]?.description).toBe('Dinner, beach shack')
    expect(file.rows[2]?.isPayment).toBe(true)
    expect(file.totals.INR).toEqual({ 'Ayush Kumar': 800000, Riya: 75000, Sam: -875000 })
    expect(file.problems).toEqual([])
  })

  it('says what is wrong with a row instead of guessing', () => {
    const file = readSplitwise('Date,Description,Category,Cost,Currency,A,B\n2026-10-01,Tea,Dining out,100,INR,50,-40\nnot a date,X,General,10,INR,5,-5')
    expect(file.rows).toEqual([])
    expect(file.problems).toEqual([
      { line: 2, reason: 'the columns don’t add up (off by 1000)' },
      { line: 3, reason: 'no date' },
    ])
  })

  it('refuses a file that is not a Splitwise export', () => {
    expect(() => readSplitwise('name,amount\nRiya,200')).toThrow(SplitwiseFormatError)
  })
})

describe('planSplitwise', () => {
  it('turns rows into bills and payments that give everyone the same balance as Splitwise, to the paisa', () => {
    const file = readSplitwise(GOA)
    const plan = planSplitwise(file, categoryFromText)
    expect(plan.skipped).toEqual([7])
    const [villa, dinner, payment, cabA, cabB] = plan.items
    expect(villa).toMatchObject({ kind: 'bill', payer: 'Ayush Kumar', total: 2400000, shares: { 'Ayush Kumar': 800000, Riya: 800000, Sam: 800000 }, category: 'travel', part: false })
    expect(dinner).toMatchObject({ kind: 'bill', payer: 'Riya', total: 300000, shares: { Riya: 100000, 'Ayush Kumar': 100000, Sam: 100000 }, category: 'food' })
    expect(payment).toEqual({ kind: 'payment', line: 5, date: '2026-10-03', currency: 'INR', from: 'Riya', to: 'Ayush Kumar', amount: 600000 })
    // The cab two people paid: one part bill each, for what Ayush owed them.
    expect(cabA).toMatchObject({ kind: 'bill', payer: 'Riya', shares: { 'Ayush Kumar': 75000 }, total: 75000, part: true })
    expect(cabB).toMatchObject({ kind: 'bill', payer: 'Sam', shares: { 'Ayush Kumar': 25000 }, total: 25000, part: true })
    expect(checkTotals(file, plan)).toEqual([])
    expect(plannedBalances(plan.items).INR).toEqual({ 'Ayush Kumar': 800000, Riya: 75000, Sam: -875000 })
  })

  it('reports a balance that would not match', () => {
    const file = readSplitwise(GOA)
    file.totals.INR = { ...file.totals.INR, Sam: -874999 }
    const plan = planSplitwise(file, categoryFromText)
    expect(checkTotals(file, plan)).toEqual([{ currency: 'INR', person: 'Sam', splitwise: -874999, settle: -875000 }])
  })

  it('keeps every balance exact for any bill paid by several people', () => {
    let seed = 11
    const rand = (k: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed % k
    }
    for (let round = 0; round < 300; round++) {
      const people = ['A', 'B', 'C', 'D', 'E']
      const lines = ['Date,Description,Category,Cost,Currency,' + people.join(',')]
      const totals: Record<string, number> = {}
      for (let r = 0; r < 1 + rand(10); r++) {
        const nets = people.map(() => rand(2001) - 1000)
        const fix = -nets.reduce((a, b) => a + b, 0)
        nets[0] = (nets[0] ?? 0) + fix
        nets.forEach((v, i) => (totals[people[i] ?? ''] = (totals[people[i] ?? ''] ?? 0) + v))
        lines.push(`2026-10-${String(1 + rand(28)).padStart(2, '0')},Row ${r},${rand(3) === 0 ? 'Payment' : 'General'},${(rand(500000) / 100).toFixed(2)},INR,${nets.map((v) => (v / 100).toFixed(2)).join(',')}`)
      }
      lines.push(`2026-10-31,Total balance, , ,INR,${people.map((p) => ((totals[p] ?? 0) / 100).toFixed(2)).join(',')}`)
      const file = readSplitwise(lines.join('\n'))
      expect(file.problems).toEqual([])
      expect(checkTotals(file, planSplitwise(file, categoryFromText))).toEqual([])
    }
  })
})
