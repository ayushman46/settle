import { describe, expect, it } from 'vitest'
import type { ClaimPick, ClaimReply } from '../domain/types'
import { computeSplit } from '../lib/split'
import type { BillItem, Shares } from '../types'
import {
  claimBoard,
  claimShare,
  fraction,
  mixedNumber,
  paymentGaps,
  portionLabel,
  resolveRow,
  weightsFor,
  type ClaimItem,
  type ClaimRow,
} from './claims'

/** Spec 01 §4.2 — Toit, ₹2,766 paid. */
const ITEMS: ClaimItem[] = [
  { name: 'Butter Chicken', amount: 45000, quantity: 1 },
  { name: 'Paneer Tikka', amount: 38000, quantity: 1 },
  { name: 'Butter Naan', amount: 24000, quantity: 4 },
  { name: 'Kingfisher Beer', amount: 90000, quantity: 3 },
  { name: 'Fresh Lime Soda', amount: 12000, quantity: 1 },
  { name: 'Gulab Jamun', amount: 15000, quantity: 1 },
]
const TOTAL = 276600
const PEOPLE = ['ayush', 'riya', 'sam', 'kabir'] as const
const p = (item: number, num: number, den: number): ClaimPick => ({ item, num, den })
const PICKS: Record<(typeof PEOPLE)[number], ClaimPick[]> = {
  ayush: [p(0, 1, 2), p(3, 1, 3)],
  riya: [p(1, 1, 2), p(2, 1, 4), p(4, 1, 1), p(5, 1, 2)],
  sam: [p(0, 1, 2), p(2, 2, 4), p(3, 1, 3)],
  kabir: [p(1, 1, 2), p(2, 1, 4), p(3, 2, 3)],
}
const BILL_ITEMS: BillItem[] = ITEMS.map((it, i) => ({ id: `i${i}`, name: it.name, quantity: it.quantity, amount: it.amount }))
const PERSONS = PEOPLE.map((id) => ({ id, name: id, color: 0 }))

function board(): ClaimRow[] {
  return claimBoard({ itemCount: ITEMS.length, fixedIndexes: new Set(), claimers: PEOPLE.map((id) => ({ friendId: id, picks: PICKS[id] })) })
}

function reply(friendId: string, paid: number | null, picks: ClaimPick[], extra: Partial<ClaimReply> = {}): ClaimReply {
  return { id: `r-${friendId}`, personIndex: 1, name: friendId, friendId, picks, nothing: false, paid, sentAt: 1, receivedAt: 1, state: 'active', ...extra }
}

const words = (f: { n: bigint; d: bigint }) => `${f.n}/${f.d}`

describe('claimShare — the worked example', () => {
  it.each([
    ['ayush', 0, 52500, 64828],
    ['riya', 1, 44500, 54950],
    ['sam', 2, 64500, 79646],
    ['kabir', 3, 85000, 104960],
  ] as const)('%s', (id, index, itemsPart, share) => {
    expect(claimShare({ items: ITEMS, total: TOTAL, picks: PICKS[id], personIndex: index })).toEqual({ itemsPart, share })
  })

  it('is zero when the items add up to nothing', () => {
    expect(claimShare({ items: [{ name: 'x', amount: 0, quantity: 1 }], total: 5000, picks: [p(0, 1, 1)], personIndex: 1 })).toEqual({ itemsPart: 0, share: 0 })
  })

  it('adds items sorted before the link went out', () => {
    // Riya is on Gulab Jamun with Sam (1:1) as a fixed item, and picks nothing else.
    const fixed = [[5, [[1, 1], [2, 1]]]] as const
    expect(claimShare({ items: ITEMS, total: TOTAL, picks: [], fixed, personIndex: 1 })).toEqual({ itemsPart: 7500, share: 9261 })
    expect(claimShare({ items: ITEMS, total: TOTAL, picks: [], fixed, personIndex: null }).share).toBe(0)
  })

  it('ignores picks pointing past the items', () => {
    expect(claimShare({ items: ITEMS, total: TOTAL, picks: [p(9, 1, 1)], personIndex: 1 }).share).toBe(0)
  })
})

describe('claimBoard', () => {
  it('adds every claim up exactly', () => {
    const rows = board()
    expect(rows.map((r) => r.status)).toEqual(['complete', 'complete', 'complete', 'over', 'complete', 'partial'])
    expect(rows.map((r) => r.claims.map((c) => `${c.friendId} ${words(c.part)}`).join(' + '))).toEqual([
      'ayush 1/2 + sam 1/2',
      'riya 1/2 + kabir 1/2',
      'riya 1/4 + sam 1/2 + kabir 1/4',
      'ayush 1/3 + sam 1/3 + kabir 2/3',
      'riya 1/1',
      'riya 1/2',
    ])
    expect(words(rows[3]!.extra)).toBe('1/3')
    expect(words(rows[3]!.rest)).toBe('0/1')
    expect(words(rows[5]!.rest)).toBe('1/2')
    expect(words(rows[5]!.extra)).toBe('0/1')
  })

  it('marks unclaimed and fixed items', () => {
    const rows = claimBoard({ itemCount: 3, fixedIndexes: new Set([1]), claimers: [{ friendId: 'a', picks: [p(1, 1, 1)] }] })
    expect(rows.map((r) => r.status)).toEqual(['unclaimed', 'fixed', 'unclaimed'])
    expect(rows[1]!.claims).toEqual([])
  })
})

describe('resolveRow and the final split', () => {
  const decisions = { 3: { kind: 'as_claimed' }, 5: { kind: 'scale_up' } } as const

  function assignments(dec: Readonly<Record<number, { kind: 'as_claimed' } | { kind: 'scale_up' } | { kind: 'rest_everyone' }>>) {
    const out: Record<string, Shares> = {}
    for (const row of board()) {
      const r = resolveRow(row, dec[row.index], PEOPLE)
      if (r) out[`i${row.index}`] = r
    }
    return out
  }

  it('turns claims and decisions into item weights', () => {
    expect(assignments(decisions)).toEqual({
      i0: { ayush: 1, sam: 1 },
      i1: { riya: 1, kabir: 1 },
      i2: { riya: 1, sam: 2, kabir: 1 },
      i3: { ayush: 1, sam: 1, kabir: 2 },
      i4: { riya: 1 },
      i5: { riya: 1 },
    })
  })

  it('splits the bill to the paisa', () => {
    const res = computeSplit({ items: BILL_ITEMS, people: PERSONS, assignments: assignments(decisions), paid: TOTAL })
    expect(res.people.map((x) => [x.person.id, x.itemsSubtotal, x.total])).toEqual([
      ['ayush', 45000, 55567],
      ['riya', 52000, 64211],
      ['sam', 57000, 70385],
      ['kabir', 70000, 86437],
    ])
    expect(res.check).toBe(TOTAL)
  })

  it('leaves an open item to everyone', () => {
    const res = computeSplit({ items: BILL_ITEMS, people: PERSONS, assignments: assignments({ 3: { kind: 'as_claimed' } }), paid: TOTAL })
    expect(res.people.map((x) => x.total)).toEqual([60198, 50319, 75015, 91068])
    expect(res.unassignedItemIds).toEqual(['i5'])
  })

  it('shares the rest with everyone', () => {
    expect(resolveRow(board()[5]!, { kind: 'rest_everyone' }, PEOPLE)).toEqual({ riya: 5, ayush: 1, sam: 1, kabir: 1 })
  })

  it('keeps conflicts open until decided', () => {
    const rows = board()
    expect(resolveRow(rows[3]!, undefined, PEOPLE)).toBeNull()
    expect(resolveRow(rows[5]!, undefined, PEOPLE)).toBeNull()
    // A decision that no longer fits the row leaves it open.
    expect(resolveRow(rows[3]!, { kind: 'scale_up' }, PEOPLE)).toBeNull()
    expect(resolveRow(rows[5]!, { kind: 'as_claimed' }, PEOPLE)).toBeNull()
  })

  it('uses the organiser’s own pick', () => {
    expect(resolveRow(board()[3]!, { kind: 'assign', shares: { sam: 2, kabir: 1 } }, PEOPLE)).toEqual({ sam: 2, kabir: 1 })
    const unclaimed = claimBoard({ itemCount: 1, fixedIndexes: new Set(), claimers: [] })[0]!
    expect(resolveRow(unclaimed, { kind: 'assign', shares: { ayush: 1, riya: 1 } }, PEOPLE)).toEqual({ ayush: 1, riya: 1 })
    expect(resolveRow(unclaimed, undefined, PEOPLE)).toBeNull()
  })
})

describe('weightsFor', () => {
  it('caps weights at 99 in the same proportions', () => {
    expect(
      weightsFor([
        { friendId: 'a', part: fraction(1, 7) },
        { friendId: 'b', part: fraction(1, 11) },
        { friendId: 'c', part: fraction(1, 13) },
        { friendId: 'd', part: fraction(1, 99) },
      ]),
    ).toEqual({ a: 99, b: 63, c: 53, d: 7 })
  })

  it('sums the same friend and reduces', () => {
    expect(weightsFor([{ friendId: 'a', part: fraction(1, 4) }, { friendId: 'a', part: fraction(1, 4) }, { friendId: 'b', part: fraction(1, 2) }])).toEqual({ a: 2, b: 2 })
  })

  it('never passes 99 even when a friend’s parts add up past it', () => {
    const w = weightsFor([
      { friendId: 'a', part: fraction(1, 97) },
      { friendId: 'b', part: fraction(96, 97) },
      { friendId: 'b', part: fraction(1, 98) },
    ])
    expect(Math.max(...Object.values(w))).toBeLessThanOrEqual(99)
    expect(Math.min(...Object.values(w))).toBeGreaterThanOrEqual(1)
  })
})

describe('paymentGaps', () => {
  it('compares what each friend paid with the final share', () => {
    const replies = [reply('riya', 54950, PICKS.riya), reply('sam', 79646, PICKS.sam), reply('kabir', 104960, PICKS.kabir)]
    const finals = { ayush: 55567, riya: 64211, sam: 70385, kabir: 86437 }
    expect(paymentGaps(replies, finals)).toEqual([
      { friendId: 'riya', paid: 54950, share: 64211, due: 9261, settled: false },
      { friendId: 'sam', paid: 79646, share: 70385, due: -9261, settled: false },
      { friendId: 'kabir', paid: 104960, share: 86437, due: -18523, settled: false },
    ])
  })

  it('absorbs rounding up to (items + 1) paise', () => {
    expect(paymentGaps([reply('riya', 998, [p(0, 1, 1)])], { riya: 1000 })[0]!.settled).toBe(true)
    expect(paymentGaps([reply('riya', 997, [p(0, 1, 1)])], { riya: 1000 })[0]!.settled).toBe(false)
  })

  it('skips replaced replies and counts unpaid ones as due', () => {
    const gaps = paymentGaps([reply('riya', 500, [], { state: 'replaced' }), reply('sam', null, [p(0, 1, 1)])], { riya: 900, sam: 700 })
    expect(gaps).toEqual([{ friendId: 'sam', paid: null, share: 700, due: 700, settled: false }])
  })
})

describe('portionLabel', () => {
  it.each([
    [1, 4, 4, '1 of 4'],
    [2, 4, 4, '2 of 4'],
    [1, 2, 1, '½'],
    [2, 3, 3, '2 of 3'],
    [5, 12, 1, '5/12'],
    [1, 1, 1, 'all'],
    [1, 3, 1, '⅓'],
    [3, 4, 1, '¾'],
    [1, 2, 3, '½'],
    [1, 2, 1.5, '½'],
  ])('%i/%i of a %s-unit item → %s', (num, den, q, label) => {
    expect(portionLabel({ num, den }, q)).toBe(label)
  })

  it('writes mixed numbers', () => {
    expect(mixedNumber(fraction(3, 2))).toBe('1½')
    expect(mixedNumber(fraction(4, 1))).toBe('4')
    expect(mixedNumber(fraction(17, 12))).toBe('1 5/12')
    expect(mixedNumber(fraction(1, 3))).toBe('⅓')
  })
})

describe('properties', () => {
  function rng(seed: number): () => number {
    let a = seed >>> 0
    return () => {
      a = (a + 0x6d2b79f5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  it('500 random bills: shares add up to the total within items + people paise; the split is exact', () => {
    const rand = rng(20261023)
    const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1))
    for (let run = 0; run < 500; run++) {
      const itemCount = int(1, 12)
      const peopleCount = int(2, 8)
      const items: ClaimItem[] = Array.from({ length: itemCount }, (_, i) => ({ name: `item${i}`, amount: int(0, 200000), quantity: int(1, 4) }))
      if (items.every((x) => x.amount === 0)) items[0]!.amount = 100
      const itemsTotal = items.reduce((s, x) => s + x.amount, 0)
      const total = Math.max(1, Math.round(itemsTotal * (0.8 + rand() * 0.5)))
      const picks: ClaimPick[][] = Array.from({ length: peopleCount }, () => [])
      items.forEach((_, i) => {
        // Split the item into parts over 1/den that add up to exactly 1.
        const den = int(1, 12)
        let left = den
        while (left > 0) {
          const num = int(1, left)
          const who = int(0, peopleCount - 1)
          const existing = picks[who]!.find((x) => x.item === i)
          if (existing) {
            // One pick per item per person: merge.
            existing.num += num
          } else picks[who]!.push({ item: i, num, den })
          left -= num
        }
      })
      const sum = picks.reduce((s, mine, k) => s + claimShare({ items, total, picks: mine, personIndex: k }).share, 0)
      expect(Math.abs(sum - total)).toBeLessThanOrEqual(itemCount + peopleCount)

      const ids = picks.map((_, k) => `p${k}`)
      const rows = claimBoard({ itemCount, fixedIndexes: new Set(), claimers: picks.map((mine, k) => ({ friendId: ids[k]!, picks: mine })) })
      const assignments: Record<string, Shares> = {}
      for (const row of rows) {
        expect(row.status).toBe('complete')
        const r = resolveRow(row, undefined, ids)
        expect(r).not.toBeNull()
        for (const w of Object.values(r!)) expect(w).toBeLessThanOrEqual(99)
        assignments[`i${row.index}`] = r!
      }
      const res = computeSplit({
        items: items.map((x, i) => ({ id: `i${i}`, name: x.name, quantity: x.quantity, amount: x.amount })),
        people: ids.map((id) => ({ id, name: id, color: 0 })),
        assignments,
        paid: total,
      })
      expect(res.check).toBe(total)
    }
  })
})
