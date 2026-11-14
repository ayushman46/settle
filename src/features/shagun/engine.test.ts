import { describe, expect, it } from 'vitest'
import { shagunCsv } from './csv'
import {
  adviseFamily,
  bookTotals,
  earlierInFunction,
  familySummaries,
  findFamily,
  functionTotals,
  matchNames,
  nameKey,
  searchFamilies,
  sortFamilies,
  tidyName,
} from './engine'
import { adviceText } from './labels'
import type { ShagunEntry, ShagunFunction } from './types'

let seq = 0
function entry(patch: Partial<ShagunEntry> & Pick<ShagunEntry, 'name'>): ShagunEntry {
  seq += 1
  return { id: `e${seq}`, direction: 'received', amount: 110_000, gift: null, functionId: null, date: '2024-02-12', note: null, at: seq, ...patch }
}

const wedding: ShagunFunction = { id: 'w', name: 'Our wedding, Feb 2024', kind: 'wedding', date: '2024-02-12', mine: true, at: 1 }
const griha: ShagunFunction = { id: 'g', name: 'Our housewarming', kind: 'housewarming', date: '2025-06-01', mine: true, at: 2 }
const sharmas: ShagunFunction = { id: 's', name: 'Sharma ji’s daughter’s wedding', kind: 'wedding', date: '2023-11-20', mine: false, at: 3 }
const byId = { w: wedding, g: griha, s: sharmas }

describe('names', () => {
  it('tidies spaces and treats case and spacing as the same family', () => {
    expect(tidyName('  Sharma   ji ')).toBe('Sharma ji')
    expect(nameKey('Sharma ji')).toBe(nameKey('sharma ji '))
    const families = familySummaries([entry({ name: 'Sharma ji' }), entry({ name: 'sharma ji ', amount: 50_100 })])
    expect(families).toHaveLength(1)
    expect(families[0]?.received).toBe(160_100)
  })

  it('offers names that start with what is typed first, then ones containing it', () => {
    const names = ['Verma family', 'Sharma ji', 'Mehra', 'Sharad uncle', 'sharma ji']
    expect(matchNames(names, 'shar')).toEqual(['Sharad uncle', 'Sharma ji'])
    expect(matchNames(names, 'ma')).toEqual(['Sharma ji', 'Verma family'])
    expect(matchNames(names, '  ')).toEqual([])
  })
})

describe('what to give', () => {
  it('uses the latest amount they gave and whole years, rounded up to end in 1', () => {
    const fam = familySummaries([entry({ name: 'Gupta', amount: 50_100, date: '2019-01-01' }), entry({ name: 'Gupta', amount: 110_000, functionId: 'w', date: '2024-02-12' })])[0]!
    const advice = adviseFamily(fam, byId, '2026-11-14')
    expect(advice).toMatchObject({ kind: 'amount', gave: 110_000, years: 2, amount: 130_100, fn: wedding })
    expect(adviceText(advice)).toBe('They gave ₹1,100 at your wedding in 2024. With 2 years gone by, ₹1,301.')
  })

  it('counts whole years only: a day before the anniversary is one year fewer', () => {
    const fam = familySummaries([entry({ name: 'Gupta', amount: 100_000, date: '2021-11-15' })])[0]!
    expect(adviseFamily(fam, byId, '2026-11-14')).toMatchObject({ years: 4 })
    expect(adviseFamily(fam, byId, '2026-11-15')).toMatchObject({ years: 5 })
  })

  it('never suggests less than they gave, to the paisa', () => {
    const fam = familySummaries([entry({ name: 'Rao', amount: 510_150, date: '2026-11-01' })])[0]!
    const advice = adviseFamily(fam, byId, '2026-11-14')
    expect(advice.kind).toBe('amount')
    if (advice.kind === 'amount') expect(advice.amount).toBeGreaterThanOrEqual(510_150)
  })

  it('adds up two envelopes from the same family at the same function', () => {
    const fam = familySummaries([entry({ name: 'Iyer', amount: 50_100, functionId: 'w' }), entry({ name: 'Iyer', amount: 50_100, functionId: 'w' })])[0]!
    expect(adviseFamily(fam, byId, '2024-03-01')).toMatchObject({ gave: 100_200, amount: 110_100, years: 0 })
  })

  it('says the same year plainly', () => {
    const fam = familySummaries([entry({ name: 'Iyer', amount: 210_000, functionId: 'g', date: '2025-06-01' })])[0]!
    expect(adviceText(adviseFamily(fam, byId, '2025-09-01'))).toBe('They gave ₹2,100 at your housewarming in 2025. Give back ₹2,101.')
  })

  it('has no suggestion when they never gave you anything', () => {
    const fam = familySummaries([entry({ name: 'Kapoor', direction: 'given', amount: 50_100 })])[0]!
    expect(adviseFamily(fam, byId, '2026-11-14')).toEqual({ kind: 'none' })
    expect(adviceText({ kind: 'none' })).toBeNull()
  })

  it('a gift without money gives a reason but no amount', () => {
    const fam = familySummaries([entry({ name: 'Bose', amount: 0, gift: 'silver coin', functionId: 'w' })])[0]!
    const advice = adviseFamily(fam, byId, '2026-11-14')
    expect(advice.kind).toBe('gift')
    expect(adviceText(advice)).toBe('They gave you silver coin at your wedding in 2024, not money. Give something of about that worth.')
  })

  it('names their function when the envelope came at someone else’s', () => {
    const fam = familySummaries([entry({ name: 'Sharma ji', amount: 50_100, functionId: 's', date: '2023-11-20' })])[0]!
    expect(adviceText(adviseFamily(fam, byId, '2023-12-01'))).toBe('They gave ₹501 at Sharma ji’s daughter’s wedding in 2023. Give back ₹501.')
  })
})

describe('families', () => {
  it('nets both ways and remembers the last time each way', () => {
    const a = entry({ name: 'Mehra', amount: 110_000, date: '2024-02-12' })
    const b = entry({ name: 'Mehra', direction: 'given', amount: 210_100, date: '2025-01-05' })
    const c = entry({ name: 'Mehra', direction: 'given', amount: 50_100, date: '2023-01-05' })
    const fam = familySummaries([a, b, c])[0]!
    expect(fam).toMatchObject({ received: 110_000, given: 260_200, net: -150_200, receivedCount: 1, givenCount: 2, lastDate: '2025-01-05' })
    expect(fam.lastGiven?.id).toBe(b.id)
    expect(fam.lastReceived?.id).toBe(a.id)
    expect(fam.entries.map((e) => e.id)).toEqual([c.id, a.id, b.id])
    expect(findFamily([fam], ' MEHRA ')?.key).toBe('mehra')
    expect(findFamily([fam], '')).toBeNull()
  })

  it('searches by name and sorts by name, amount and recent (ties by name)', () => {
    const fams = familySummaries([
      entry({ name: 'Verma', amount: 50_100, date: '2024-01-01' }),
      entry({ name: 'arora', amount: 510_100, date: '2023-01-01' }),
      entry({ name: 'Bhatia', amount: 50_100, date: '2024-01-01' }),
    ])
    expect(searchFamilies(fams, 'ER').map((f) => f.name)).toEqual(['Verma'])
    expect(searchFamilies(fams, '').length).toBe(3)
    expect(sortFamilies(fams, 'name').map((f) => f.name)).toEqual(['arora', 'Bhatia', 'Verma'])
    expect(sortFamilies(fams, 'amount').map((f) => f.name)).toEqual(['arora', 'Bhatia', 'Verma'])
    expect(sortFamilies(fams, 'recent').map((f) => f.name)).toEqual(['Bhatia', 'Verma', 'arora'])
  })

  it('handles an empty book', () => {
    expect(familySummaries([])).toEqual([])
    expect(bookTotals([])).toEqual({ received: 0, given: 0, families: 0, entries: 0 })
    expect(functionTotals([], [])).toEqual([])
  })
})

describe('totals', () => {
  it('per function: collected and from how many families, newest function first', () => {
    const entries = [
      entry({ name: 'A', amount: 50_100, functionId: 'w' }),
      entry({ name: 'a ', amount: 25_100, functionId: 'w' }),
      entry({ name: 'B', amount: 110_100, functionId: 'w' }),
      entry({ name: 'C', amount: 210_100, functionId: 'g' }),
      entry({ name: 'Sharma ji', direction: 'given', amount: 50_100, functionId: 's' }),
      entry({ name: 'D', amount: 10_100, functionId: 'gone' }),
    ]
    const rows = functionTotals([wedding, griha, sharmas], entries)
    expect(rows.map((r) => r.fn.id)).toEqual(['g', 'w', 's'])
    expect(rows[1]).toMatchObject({ received: 185_300, given: 0, families: 2, entries: 3 })
    expect(rows[2]).toMatchObject({ received: 0, given: 50_100, families: 1 })
    expect(bookTotals(entries)).toEqual({ received: 405_500, given: 50_100, families: 5, entries: 6 })
  })
})

describe('duplicates in fast entry', () => {
  it('finds the earlier envelope from that name at that function, the same way round', () => {
    const first = entry({ name: 'Sharma ji', amount: 50_100, functionId: 'w' })
    const entries = [first, entry({ name: 'Sharma ji', direction: 'given', functionId: 'w' })]
    expect(earlierInFunction(entries, 'w', 'sharma JI ', 'received')?.id).toBe(first.id)
    expect(earlierInFunction(entries, 'g', 'Sharma ji', 'received')).toBeNull()
    expect(earlierInFunction(entries, 'w', '', 'received')).toBeNull()
  })

  it('without a function, only the same day counts', () => {
    const loose = entry({ name: 'Rao', date: '2026-11-10' })
    expect(earlierInFunction([loose], null, 'Rao', 'received', '2026-11-10')?.id).toBe(loose.id)
    expect(earlierInFunction([loose], null, 'Rao', 'received', '2026-11-14')).toBeNull()
  })
})

describe('CSV', () => {
  it('one row per envelope, oldest first, with the function and gifts', () => {
    const csv = shagunCsv(
      [
        entry({ name: 'Mehra, Delhi', amount: 110_100, functionId: 'w', date: '2024-02-12', gift: 'silver coin' }),
        entry({ name: '=Sharma', direction: 'given', amount: 0, gift: 'saree', date: '2023-01-01', note: 'Said "blessings"' }),
      ],
      [wedding],
    )
    const lines = csv.trimEnd().split('\r\n')
    expect(lines[0]).toBe('Date,Family,Direction,Amount,Currency,Gift,Function,Function date,Note')
    expect(lines[1]).toBe(`2023-01-01,'=Sharma,Given,,,saree,,,"Said ""blessings"""`)
    expect(lines[2]).toBe('2024-02-12,"Mehra, Delhi",Received,1101.00,INR,silver coin,"Our wedding, Feb 2024",2024-02-12,')
  })
})

describe('size', () => {
  it('2,000 envelopes from 500 families are summed, advised and sorted quickly', () => {
    const entries: ShagunEntry[] = []
    for (let i = 0; i < 2000; i++) {
      entries.push(entry({ name: `Family ${i % 500}`, amount: (101 + (i % 7) * 100) * 100, direction: i % 3 === 0 ? 'given' : 'received', date: `20${10 + (i % 15)}-0${1 + (i % 9)}-1${i % 10}`, functionId: i % 2 ? 'w' : null }))
    }
    const started = performance.now()
    const fams = familySummaries(entries)
    for (const fam of fams) adviseFamily(fam, byId, '2026-11-14')
    sortFamilies(searchFamilies(fams, 'family 1'), 'amount')
    functionTotals([wedding], entries)
    const total = bookTotals(entries)
    expect(performance.now() - started).toBeLessThan(500)
    expect(fams).toHaveLength(500)
    expect(total.received + total.given).toBe(entries.reduce((s, e) => s + e.amount, 0))
  })
})
