import { describe, expect, it } from 'vitest'
import type { BillItem, Person, Shares } from '../types'
import { openDebts, owedBy, settleUp } from './settle'
import { computeSplit } from './split'

const people: Person[] = [
  { id: 'a', name: 'Aisha', color: 0 },
  { id: 'b', name: 'Ben', color: 1 },
  { id: 'c', name: 'Cara', color: 2 },
]
const items: BillItem[] = [
  { id: 'x', name: 'X', quantity: 1, amount: 3000 },
  { id: 'y', name: 'Y', quantity: 1, amount: 1000 },
  { id: 'z', name: 'Water', quantity: 1, amount: 0 },
]
const assignments: Record<string, Shares> = { x: { a: 1, b: 1 }, y: { a: 1 }, z: { c: 1 } }
const result = computeSplit({ items, people, assignments, paid: 4400 })

describe('settleUp', () => {
  it('everyone else owes the payer their share', () => {
    const s = settleUp(result, 'a')
    expect(s).not.toBeNull()
    expect(s?.payer.id).toBe('a')
    expect(s?.paid).toBe(4400)
    expect(s?.payerShare).toBe(2750)
    expect(s?.getsBack).toBe(1650)
    expect(s?.debts.map((d) => [d.person.id, d.owes])).toEqual([
      ['b', 1650],
      ['c', 0],
    ])
  })

  it('payer share + what they get back = paid', () => {
    for (const p of people) {
      const s = settleUp(result, p.id)
      expect((s?.payerShare ?? 0) + (s?.getsBack ?? 0)).toBe(result.paid)
      expect(s?.debts.reduce((sum, d) => sum + d.owes, 0)).toBe(s?.getsBack)
    }
  })

  it('returns null without a (known) payer', () => {
    expect(settleUp(result, null)).toBeNull()
    expect(settleUp(result, undefined)).toBeNull()
    expect(settleUp(result, '')).toBeNull()
    expect(settleUp(result, 'ghost')).toBeNull()
  })

  it('handles a payer who owes nothing', () => {
    const s = settleUp(result, 'c')
    expect(s?.payerShare).toBe(0)
    expect(s?.getsBack).toBe(4400)
  })
})

describe('owedBy / openDebts', () => {
  const s = settleUp(result, 'a')

  it('looks up one person', () => {
    expect(owedBy(s, 'b')).toBe(1650)
    expect(owedBy(s, 'c')).toBe(0)
    expect(owedBy(s, 'a')).toBeNull()
    expect(owedBy(null, 'b')).toBeNull()
  })

  it('lists only debts that need paying', () => {
    expect(openDebts(s).map((d) => d.person.id)).toEqual(['b'])
    expect(openDebts(null)).toEqual([])
  })
})
