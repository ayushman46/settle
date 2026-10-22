import { describe, expect, it } from 'vitest'
import { ME_ID } from '../../domain/types'
import {
  billDemo,
  collectDemo,
  COLLECT_EXPENSE,
  DEMO_MODES,
  describeDemo,
  groupDemo,
  heroSplit,
  heroSummary,
  HERO_BILL,
  INSIGHTS_DEMO,
} from './demo'

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

describe('hero split', () => {
  it.each(DEMO_MODES.map((m) => m.value))('adds up to the bill exactly in %s mode', (mode) => {
    const { rows, ok } = heroSplit(mode)
    expect(ok).toBe(true)
    expect(rows.map((r) => r.id)).toEqual(HERO_BILL.people.map((p) => p.id))
    expect(sum(rows.map((r) => r.amount))).toBe(HERO_BILL.total)
  })

  it('divides ₹2,400 the way each mode promises', () => {
    const amounts = (mode: (typeof DEMO_MODES)[number]['value']) => heroSplit(mode).rows.map((r) => r.amount)
    expect(amounts('equal')).toEqual([80_000, 80_000, 80_000])
    expect(amounts('exact')).toEqual([100_000, 70_000, 70_000])
    expect(amounts('percent')).toEqual([120_000, 60_000, 60_000])
    expect(amounts('shares')).toEqual([60_000, 60_000, 120_000])
  })

  it('shows what each person entered only where it means something', () => {
    expect(heroSplit('equal').rows.map((r) => r.hint)).toEqual([null, null, null])
    expect(heroSplit('exact').rows.map((r) => r.hint)).toEqual([null, null, null])
    expect(heroSplit('percent').rows.map((r) => r.hint)).toEqual(['50%', '25%', '25%'])
    expect(heroSplit('shares').rows.map((r) => r.hint)).toEqual(['×1', '×1', '×2'])
  })

  it('says the split in words for screen readers', () => {
    expect(heroSummary('shares')).toBe('Shares: You ₹600, Riya ₹600, Sam ₹1,200')
    expect(heroSummary('percent')).toBe('Percentages: You ₹1,200, Riya ₹600, Sam ₹600')
  })

  it('names every mode for assistive tech, even the symbol one', () => {
    expect(DEMO_MODES.find((m) => m.label === '%')?.ariaLabel).toBe('Percentages')
    for (const mode of DEMO_MODES) expect(mode.caption.length).toBeGreaterThan(0)
  })
})

describe('the other mockups', () => {
  it('reads "Cab 840 with Riya and Sam, Sam pays double" as shares of 1 : 1 : 2', () => {
    const split = describeDemo()
    expect(split.total).toBe(84_000)
    expect(split.rows.map((r) => [r.name, r.amount])).toEqual([
      ['You', 21_000],
      ['Riya', 21_000],
      ['Sam', 42_000],
    ])
  })

  it('tracks the four-way dinner: two of three friends have paid', () => {
    const c = collectDemo()
    expect(c.share).toBe(69_150)
    expect(c.rows.map((r) => r.paid)).toEqual([true, true, false])
    expect(c.collected).toBe(138_300)
    expect(c.outstanding).toBe(69_150)
    expect(c.paidCount).toBe(2)
    expect(c.share * 4).toBe(COLLECT_EXPENSE.total)
  })

  it('settles the trip in the fewest payments, every paisa accounted for', () => {
    const { members, transfers } = groupDemo()
    expect(transfers.length).toBeLessThanOrEqual(members.length - 1)
    const net: Record<string, number> = {}
    for (const t of transfers) {
      net[t.fromId] = (net[t.fromId] ?? 0) + t.amount
      net[t.toId] = (net[t.toId] ?? 0) - t.amount
    }
    expect(net).toEqual({ [ME_ID]: -363_000, riya: -118_000, sam: 245_000, neha: 236_000 })
    for (const t of transfers) expect([t.from.id, t.to.id]).toEqual([t.fromId, t.toId])
  })

  it('totals the bill from its lines plus 5% GST', () => {
    const bill = billDemo()
    expect(bill.subtotal).toBe(174_000)
    expect(bill.tax).toBe(8_700)
    expect(bill.total).toBe(182_700)
  })

  it('keeps insight amounts positive', () => {
    for (const d of INSIGHTS_DEMO) expect(d.amount).toBeGreaterThan(0)
  })
})
